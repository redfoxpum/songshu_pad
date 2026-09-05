import WebSocket from 'ws';
import { AgentStatus, CaptureResult, ConnectionConfig } from '../types/ipc.js';
import { captureFullScreen } from './capture.js';
import { getClickThroughState } from './shortcuts.js';

export class AgentService {
  private ws: WebSocket | null = null;
  private serverUrl: string = '';
  private roomId: string = '';
  private clientId: string = 'agent_' + Math.random().toString(36).substring(2, 9);
  private connected: boolean = false;
  private connecting: boolean = false;
  private reconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isManualDisconnect: boolean = false;
  private lastCaptureTime: number | null = null;
  private totalCaptures: number = 0;
  private lastError: string | null = null;
  private isCapturing: boolean = false;

  private scheduledTimer: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private countdownSeconds: number = 30;
  private readonly CAPTURE_INTERVAL_SECONDS = 30;
  private readonly HEARTBEAT_INTERVAL_MS = 15000; // 15s keepalive to prevent Cloudflare 100s idle timeout
  private readonly MAX_RECONNECT_DELAY_MS = 10000;

  private onStatusUpdateCb?: (status: AgentStatus) => void;
  private onOnDemandTriggerCb?: (data: { requestId: string; timestamp: number }) => void;
  private onCaptureCompletedCb?: (result: CaptureResult) => void;

  constructor() {}

  public setCallbacks(
    onStatusUpdate: (status: AgentStatus) => void,
    onOnDemandTrigger: (data: { requestId: string; timestamp: number }) => void,
    onCaptureCompleted: (result: CaptureResult) => void
  ) {
    this.onStatusUpdateCb = onStatusUpdate;
    this.onOnDemandTriggerCb = onOnDemandTrigger;
    this.onCaptureCompletedCb = onCaptureCompleted;
  }

  public getStatus(): AgentStatus {
    return {
      connected: this.connected,
      connecting: this.connecting,
      reconnecting: this.reconnecting,
      reconnectAttempt: this.reconnectAttempts,
      serverUrl: this.serverUrl,
      roomId: this.roomId,
      clickThrough: getClickThroughState(),
      lastCaptureTime: this.lastCaptureTime,
      nextScheduledCaptureIn: this.countdownSeconds,
      totalCaptures: this.totalCaptures,
      lastError: this.lastError,
      isCapturing: this.isCapturing,
    };
  }

  private emitStatus() {
    if (this.onStatusUpdateCb) {
      this.onStatusUpdateCb(this.getStatus());
    }
  }

  public async connect(
    config: ConnectionConfig,
    isAutoRetry: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    if (!isAutoRetry) {
      this.isManualDisconnect = false;
      this.reconnectAttempts = 0;
      this.clearReconnectTimer();
      this.disconnectInternal();
    }

    this.serverUrl = config.serverUrl.trim().replace(/\/+$/, '');
    this.roomId = config.roomId.trim().replace(/[^a-zA-Z0-9_-]/g, '');

    if (!this.roomId) {
      return { success: false, error: 'Room ID 不能为空' };
    }

    if (isAutoRetry) {
      this.reconnecting = true;
      this.connecting = false;
    } else {
      this.connecting = true;
      this.reconnecting = false;
    }
    this.lastError = null;
    this.emitStatus();

    try {
      // Build WebSocket URL with clientId query param
      let wsBase = this.serverUrl.replace(/^http/, 'ws');
      const wsUrl = `${wsBase}/ws/agent?room=${encodeURIComponent(this.roomId)}&clientId=${encodeURIComponent(this.clientId)}`;

      console.log(`[AgentService] Connecting to WebSocket (${isAutoRetry ? 'AutoRetry' : 'Initial'}): ${wsUrl}`);
      this.ws = new WebSocket(wsUrl);

      return new Promise((resolve) => {
        let hasResolved = false;

        const connectTimeout = setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            this.connecting = false;
            this.lastError = '连接超时，请检查服务器地址与网络连接';
            this.emitStatus();
            if (this.ws) {
              try {
                this.ws.close();
              } catch (e) {}
            }
            if (!this.isManualDisconnect) {
              this.scheduleReconnect();
            }
            resolve({ success: false, error: this.lastError });
          }
        }, 8000);

        this.ws!.on('open', () => {
          clearTimeout(connectTimeout);
          console.log(`[AgentService] WebSocket connected successfully to room ${this.roomId}`);
          this.connected = true;
          this.connecting = false;
          this.reconnecting = false;
          this.reconnectAttempts = 0;
          this.lastError = null;
          
          // Send handshake registration
          this.ws?.send(
            JSON.stringify({
              type: 'AGENT_REGISTER',
              clientType: 'desktop-agent',
              clientId: this.clientId,
              deviceName: 'macOS Desktop Agent',
              hasScreenPermission: true,
              platform: process.platform,
              roomId: this.roomId,
              timestamp: Date.now(),
            })
          );

          this.startHeartbeatLoop();
          this.startScheduledCaptureLoop();
          this.emitStatus();

          if (!hasResolved) {
            hasResolved = true;
            resolve({ success: true });
          }
        });

        this.ws!.on('message', (raw) => {
          this.handleWebSocketMessage(raw.toString());
        });

        this.ws!.on('pong', () => {
          // Received standard WebSocket pong
        });

        this.ws!.on('error', (err) => {
          console.error('[AgentService] WebSocket error:', err.message);
          this.lastError = err.message;
          this.emitStatus();
        });

        this.ws!.on('close', (code, reason) => {
          console.log(`[AgentService] WebSocket closed (code: ${code}, reason: ${reason.toString()})`);
          this.connected = false;
          this.connecting = false;
          this.stopScheduledCaptureLoop();
          this.stopHeartbeatLoop();

          if (this.isManualDisconnect) {
            this.reconnecting = false;
            this.emitStatus();
          } else {
            this.reconnecting = true;
            this.emitStatus();
            this.scheduleReconnect();
          }

          if (!hasResolved) {
            hasResolved = true;
            resolve({ success: false, error: `连接已关闭 (code: ${code})` });
          }
        });
      });
    } catch (err: any) {
      this.connecting = false;
      this.lastError = err.message || '连接失败';
      this.emitStatus();
      if (!this.isManualDisconnect) {
        this.scheduleReconnect();
      }
      return { success: false, error: this.lastError || undefined };
    }
  }

  private startHeartbeatLoop() {
    this.stopHeartbeatLoop();
    // Send immediate heartbeat upon connection
    this.sendHeartbeat();

    // Heartbeat ticker every 15s to keep WebSocket alive through Cloudflare / proxies
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeatLoop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendHeartbeat() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      // 1. Send JSON Heartbeat message for Server Command Gateway
      this.ws.send(
        JSON.stringify({
          type: 'HEARTBEAT',
          clientId: this.clientId,
          roomId: this.roomId,
          deviceName: 'macOS Desktop Agent',
          hasScreenPermission: true,
          timestamp: Date.now(),
        })
      );

      // 2. Also send WebSocket protocol-level ping frame
      if (typeof this.ws.ping === 'function') {
        this.ws.ping();
      }
    } catch (err: any) {
      console.warn('[AgentService] Failed to send heartbeat:', err.message);
    }
  }

  private scheduleReconnect() {
    this.clearReconnectTimer();
    if (this.isManualDisconnect || !this.serverUrl || !this.roomId) {
      return;
    }

    this.reconnectAttempts += 1;
    // Exponential backoff: 2s, 3s, 4.5s, 6.75s, max 10s
    const delay = Math.min(2000 * Math.pow(1.5, Math.max(0, this.reconnectAttempts - 1)), this.MAX_RECONNECT_DELAY_MS);
    console.log(
      `[AgentService] 🔄 Scheduling auto-reconnect attempt #${this.reconnectAttempts} in ${Math.round(delay)}ms...`
    );

    this.reconnectTimer = setTimeout(() => {
      if (!this.isManualDisconnect && this.serverUrl && this.roomId) {
        console.log(`[AgentService] 🔄 Executing auto-reconnect attempt #${this.reconnectAttempts}...`);
        this.connect({ serverUrl: this.serverUrl, roomId: this.roomId }, true);
      }
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private disconnectInternal() {
    this.stopScheduledCaptureLoop();
    this.stopHeartbeatLoop();
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }
    this.connected = false;
    this.connecting = false;
  }

  public disconnect() {
    this.isManualDisconnect = true;
    this.clearReconnectTimer();
    this.disconnectInternal();
    this.reconnecting = false;
    this.reconnectAttempts = 0;
    this.emitStatus();
  }

  private handleWebSocketMessage(messageStr: string) {
    try {
      const msg = JSON.parse(messageStr);
      console.log('[AgentService] Received message:', msg.type || msg.action || msg);

      // Support various command formats: type='CAPTURE_NOW', action='capture', event='CAPTURE_NOW', type='COMMAND_SCREENSHOT'
      const isCaptureNow =
        msg.type === 'CAPTURE_NOW' ||
        msg.type === 'COMMAND_SCREENSHOT' ||
        msg.type === 'REQUEST_SCREENSHOT' ||
        msg.action === 'capture' ||
        msg.event === 'CAPTURE_NOW';

      if (isCaptureNow) {
        const requestId = msg.requestId || msg.id || `req_${Date.now()}`;
        console.log(`[AgentService] 📸 Handling ON-DEMAND capture request: ${requestId} (Room: ${this.roomId})`);

        // Notify renderer immediately for visual feedback
        if (this.onOnDemandTriggerCb) {
          this.onOnDemandTriggerCb({
            requestId,
            timestamp: Date.now(),
          });
        }

        // Execute instant capture
        this.executeCapture('ondemand', requestId);
      }
    } catch (err) {
      console.warn('[AgentService] Non-JSON or unrecognized WS message:', messageStr);
    }
  }

  private startScheduledCaptureLoop() {
    this.stopScheduledCaptureLoop();
    this.countdownSeconds = this.CAPTURE_INTERVAL_SECONDS;

    // Countdown ticker every 1s
    this.countdownTimer = setInterval(() => {
      this.countdownSeconds -= 1;
      if (this.countdownSeconds <= 0) {
        this.countdownSeconds = this.CAPTURE_INTERVAL_SECONDS;
        // Trigger scheduled capture
        this.executeCapture('scheduled');
      }
      this.emitStatus();
    }, 1000);
  }

  private stopScheduledCaptureLoop() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.scheduledTimer) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = null;
    }
    this.countdownSeconds = this.CAPTURE_INTERVAL_SECONDS;
  }

  public async triggerManualCapture(): Promise<CaptureResult> {
    return this.executeCapture('manual', `manual_${Date.now()}`);
  }

  /**
   * Captures screen immediately and uploads to server.
   * If not connected to a room yet, uploads to unassigned public screenshots endpoint.
   * If connected to a room, uploads to that room's screenshots endpoint.
   */
  public async captureAndUploadInitial(serverUrl?: string): Promise<CaptureResult> {
    const targetServer = (serverUrl || this.serverUrl || 'http://localhost:3000').trim().replace(/\/+$/, '');
    console.log(`[AgentService] captureAndUploadInitial triggered. Target server: ${targetServer}`);

    if (this.isCapturing) {
      console.warn('[AgentService] Capture already in progress during initial capture request.');
      return {
        success: false,
        timestamp: Date.now(),
        triggerType: 'initial',
        error: 'Capture already in progress',
      };
    }

    this.isCapturing = true;
    this.emitStatus();

    const timestamp = Date.now();
    try {
      console.log('[AgentService] Capturing initial full desktop screenshot...');
      const captureData = await captureFullScreen(85);

      console.log(
        `[AgentService] Initial screen captured: ${captureData.width}x${captureData.height}, size: ${(
          captureData.buffer.length / 1024
        ).toFixed(1)} KB`
      );

      let uploadUrl: string;
      if (this.connected && this.roomId) {
        uploadUrl = `${targetServer}/api/rooms/${this.roomId}/screenshots`;
      } else {
        uploadUrl = `${targetServer}/api/unassigned/screenshots`;
      }

      const uploadResultUrl = await this.uploadScreenshotMultipart({
        url: uploadUrl,
        buffer: captureData.buffer,
        triggerType: 'initial',
        timestamp,
        clientId: this.clientId,
        deviceName: 'macOS Desktop Agent',
      });

      this.lastCaptureTime = timestamp;
      this.totalCaptures += 1;
      this.lastError = null;

      const result: CaptureResult = {
        success: true,
        timestamp,
        triggerType: 'initial',
        url: uploadResultUrl,
      };

      if (this.onCaptureCompletedCb) {
        this.onCaptureCompletedCb(result);
      }

      return result;
    } catch (err: any) {
      console.error('[AgentService] Initial screen capture failed:', err);
      this.lastError = err.message || '初始截屏失败';

      const result: CaptureResult = {
        success: false,
        timestamp,
        triggerType: 'initial',
        error: this.lastError || undefined,
      };

      if (this.onCaptureCompletedCb) {
        this.onCaptureCompletedCb(result);
      }

      return result;
    } finally {
      this.isCapturing = false;
      this.emitStatus();
    }
  }

  public async executeCapture(
    triggerType: 'scheduled' | 'ondemand' | 'manual' | 'initial',
    requestId?: string
  ): Promise<CaptureResult> {
    if (this.isCapturing) {
      console.warn('[AgentService] Already capturing, skipping duplicate call.');
      return {
        success: false,
        timestamp: Date.now(),
        triggerType,
        requestId,
        error: 'Capture already in progress',
      };
    }

    this.isCapturing = true;
    this.emitStatus();

    const timestamp = Date.now();
    try {
      console.log(`[AgentService] Starting ${triggerType} screen capture...`);
      const captureData = await captureFullScreen(85);

      console.log(
        `[AgentService] Screen captured: ${captureData.width}x${captureData.height}, size: ${(
          captureData.buffer.length / 1024
        ).toFixed(1)} KB`
      );

      // Upload to server if connected
      let uploadResultUrl: string | undefined;
      if (this.serverUrl && this.roomId) {
        uploadResultUrl = await this.uploadScreenshotMultipart({
          url: `${this.serverUrl}/api/rooms/${this.roomId}/screenshots`,
          buffer: captureData.buffer,
          triggerType,
          timestamp,
          clientId: this.clientId,
          deviceName: 'macOS Desktop Agent',
        });
      }

      this.lastCaptureTime = timestamp;
      this.totalCaptures += 1;
      this.lastError = null;

      const result: CaptureResult = {
        success: true,
        timestamp,
        triggerType,
        requestId,
        url: uploadResultUrl,
      };

      // Respond over WebSocket for ondemand captures
      if (triggerType === 'ondemand' && this.ws && this.ws.readyState === WebSocket.OPEN) {
        const filename = uploadResultUrl ? uploadResultUrl.split('/').pop() : undefined;
        this.ws.send(
          JSON.stringify({
            type: 'CAPTURE_COMPLETED',
            roomId: this.roomId,
            clientId: this.clientId,
            requestId,
            filename,
            screenshotUrl: uploadResultUrl,
            triggerType: 'ondemand',
            timestamp,
            size: captureData.buffer.length,
            deviceName: 'macOS Desktop Agent',
            success: true,
            url: uploadResultUrl,
          })
        );
      }

      if (this.onCaptureCompletedCb) {
        this.onCaptureCompletedCb(result);
      }

      return result;
    } catch (err: any) {
      console.error(`[AgentService] Screen capture failed (${triggerType}):`, err);
      this.lastError = err.message || '截屏失败';

      const result: CaptureResult = {
        success: false,
        timestamp,
        triggerType,
        requestId,
        error: this.lastError || undefined,
      };

      if (triggerType === 'ondemand' && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'CAPTURE_COMPLETED',
            roomId: this.roomId,
            clientId: this.clientId,
            requestId,
            timestamp,
            triggerType: 'ondemand',
            success: false,
            error: this.lastError,
          })
        );
      }

      if (this.onCaptureCompletedCb) {
        this.onCaptureCompletedCb(result);
      }

      return result;
    } finally {
      this.isCapturing = false;
      this.emitStatus();
    }
  }

  private async uploadScreenshotMultipart(options: {
    url: string;
    buffer: Buffer;
    triggerType: string;
    timestamp: number;
    clientId: string;
    deviceName?: string;
  }): Promise<string | undefined> {
    console.log(`[AgentService] Uploading screenshot to ${options.url} (multipart)...`);

    try {
      const formData = new FormData();
      const blob = new Blob([options.buffer], { type: 'image/jpeg' });
      formData.append('triggerType', options.triggerType);
      formData.append('clientId', options.clientId);
      if (options.deviceName) {
        formData.append('deviceName', options.deviceName);
      }
      formData.append('timestamp', String(options.timestamp));
      formData.append('screenshot', blob, `${options.timestamp}_${options.triggerType}_${options.clientId}.jpg`);

      const response = await fetch(options.url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.warn(`[AgentService] Upload returned status ${response.status}: ${response.statusText}`);
        return undefined;
      }

      const resData = (await response.json()) as any;
      console.log('[AgentService] Upload response:', resData);
      return resData.screenshot?.url || resData.url || resData.screenshotUrl;
    } catch (err: any) {
      console.warn('[AgentService] Failed to upload screenshot to server:', err.message);
      return undefined;
    }
  }
}

export const agentService = new AgentService();
