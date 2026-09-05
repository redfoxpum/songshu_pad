import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import {
  AgentInfo,
  AgentRegisterMessage,
  HeartbeatMessage,
  CommandScreenshotMessage,
  CaptureCompletedMessage,
  SubscribeRoomMessage,
  ScreenshotMetadata,
} from './types.js';
import { sanitizeRoomId, isRoomClosed } from './persistence.js';

interface AgentConnection {
  ws: WebSocket;
  clientId: string;
  roomId: string;
  deviceName: string;
  hasScreenPermission: boolean;
  lastHeartbeat: number;
  connectedAt: number;
  status: 'online' | 'offline' | 'idle' | 'capturing';
}

interface HostConnection {
  ws: WebSocket;
  roomId: string;
  clientId: string;
  connectedAt: number;
}

export class CommandGateway {
  // Map<roomId, Map<clientId, AgentConnection>>
  private activeAgents = new Map<string, Map<string, AgentConnection>>();
  
  // Map<roomId, Set<HostConnection>>
  private hostListeners = new Map<string, Set<HostConnection>>();

  // Map<roomId, Array<(screenshot: ScreenshotMetadata) => void>>
  private pendingCaptureResolvers = new Map<string, Array<(screenshot: ScreenshotMetadata) => void>>();

  // Periodic heartbeat inspection timer
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeatMonitor();
  }

  private startHeartbeatMonitor(): void {
    // Check every 10 seconds for agents with expired heartbeats (> 30s)
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const heartbeatTimeout = 30000;

      for (const [roomId, agents] of this.activeAgents.entries()) {
        let changed = false;
        for (const [clientId, agent] of agents.entries()) {
          if (now - agent.lastHeartbeat > heartbeatTimeout) {
            console.log(`[CommandGateway] Agent heartbeat expired: ${clientId} in room ${roomId}`);
            agents.delete(clientId);
            changed = true;
          }
        }
        if (changed) {
          if (agents.size === 0) {
            this.activeAgents.delete(roomId);
          }
          this.broadcastAgentStatus(roomId);
        }
      }
    }, 10000);
  }

  public handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const rawUrl = req.url || '';
    const parsedUrl = new URL(rawUrl, 'http://localhost');
    const pathname = parsedUrl.pathname;

    let roomId = sanitizeRoomId(
      parsedUrl.searchParams.get('roomId') ||
      parsedUrl.searchParams.get('room') ||
      pathname.replace(/^\/ws\/(control|agent)\/?/, '').split('/')[0] ||
      ''
    );

    const rawRole = parsedUrl.searchParams.get('role') || (pathname.includes('/control') ? 'host' : 'agent');
    const role: 'agent' | 'host' = rawRole === 'host' || pathname.startsWith('/ws/control') ? 'host' : 'agent';
    const clientId = parsedUrl.searchParams.get('clientId') || `client_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    console.log(`[CommandGateway] New ${role} connection on ${pathname} (roomId: ${roomId || 'unbound'}, clientId: ${clientId})`);

    let currentHostConn: HostConnection | null = null;
    let currentAgentConn: AgentConnection | null = null;

    if (role === 'host' && roomId) {
      currentHostConn = {
        ws,
        roomId,
        clientId,
        connectedAt: Date.now(),
      };
      this.addHostListener(roomId, currentHostConn);
      // Immediately send current agent status for this room
      this.sendAgentStatusTo(ws, roomId);
    }

    ws.on('message', (data) => {
      try {
        const text = typeof data === 'string' ? data : data.toString('utf-8');
        const msg = JSON.parse(text);
        if (!msg || typeof msg.type !== 'string') {
          return;
        }

        switch (msg.type) {
          case 'AGENT_REGISTER': {
            const regMsg = msg as AgentRegisterMessage;
            const targetRoom = sanitizeRoomId(regMsg.roomId || roomId);
            const targetClient = regMsg.clientId || clientId;

            if (!targetRoom || !targetClient) {
              this.safeSend(ws, {
                type: 'REGISTER_ACK',
                success: false,
                message: 'Missing roomId or clientId in AGENT_REGISTER',
              });
              return;
            }

            if (isRoomClosed(targetRoom)) {
              this.safeSend(ws, {
                type: 'REGISTER_ACK',
                success: false,
                message: 'Room is closed or deleted by host',
              });
              try {
                ws.close(4404, 'Room is closed');
              } catch {}
              return;
            }

            roomId = targetRoom;
            currentAgentConn = {
              ws,
              clientId: targetClient,
              roomId: targetRoom,
              deviceName: regMsg.deviceName || 'Desktop Agent',
              hasScreenPermission: regMsg.hasScreenPermission ?? true,
              lastHeartbeat: Date.now(),
              connectedAt: Date.now(),
              status: 'online',
            };

            this.registerAgent(targetRoom, currentAgentConn);

            this.safeSend(ws, {
              type: 'REGISTER_ACK',
              success: true,
              clientId: targetClient,
              roomId: targetRoom,
            });

            this.broadcastAgentStatus(targetRoom);
            break;
          }

          case 'HEARTBEAT': {
            const hbMsg = msg as HeartbeatMessage;
            const targetRoom = sanitizeRoomId(hbMsg.roomId || roomId);
            const targetClient = hbMsg.clientId || clientId;

            if (targetRoom && targetClient) {
              const agent = this.getAgent(targetRoom, targetClient);
              if (agent) {
                agent.lastHeartbeat = Date.now();
                if (hbMsg.hasScreenPermission !== undefined) {
                  agent.hasScreenPermission = hbMsg.hasScreenPermission;
                }
                if (hbMsg.deviceName) {
                  agent.deviceName = hbMsg.deviceName;
                }
                agent.status = 'online';
              } else if (currentAgentConn) {
                currentAgentConn.lastHeartbeat = Date.now();
                this.registerAgent(targetRoom, currentAgentConn);
                this.broadcastAgentStatus(targetRoom);
              }
            }

            this.safeSend(ws, {
              type: 'HEARTBEAT_ACK',
              timestamp: Date.now(),
            });
            break;
          }

          case 'COMMAND_SCREENSHOT': {
            const cmdMsg = msg as CommandScreenshotMessage;
            const targetRoom = sanitizeRoomId(cmdMsg.roomId || roomId);
            if (targetRoom) {
              this.requestScreenshot(targetRoom, cmdMsg.clientId, cmdMsg.requestId);
            }
            break;
          }

          case 'CAPTURE_COMPLETED': {
            const capMsg = msg as CaptureCompletedMessage;
            const targetRoom = sanitizeRoomId(capMsg.roomId || roomId);
            const filename = capMsg.filename || '';

            const screenshotMeta: ScreenshotMetadata = {
              filename,
              url: capMsg.screenshotUrl || `/api/rooms/${targetRoom}/screenshots/${filename}`,
              roomId: targetRoom,
              timestamp: capMsg.timestamp || Date.now(),
              triggerType: capMsg.triggerType || 'ondemand',
              clientId: capMsg.clientId || clientId,
              deviceName: capMsg.deviceName,
              size: capMsg.size || 0,
              createdAt: Date.now(),
            };

            this.broadcastScreenshotNew(targetRoom, screenshotMeta);
            break;
          }

          case 'SUBSCRIBE_ROOM': {
            const subMsg = msg as SubscribeRoomMessage;
            const targetRoom = sanitizeRoomId(subMsg.roomId || roomId);
            if (targetRoom) {
              roomId = targetRoom;
              if (currentHostConn) {
                this.removeHostListener(currentHostConn.roomId, currentHostConn);
              }
              currentHostConn = {
                ws,
                roomId: targetRoom,
                clientId: subMsg.clientId || clientId,
                connectedAt: Date.now(),
              };
              this.addHostListener(targetRoom, currentHostConn);
              this.sendAgentStatusTo(ws, targetRoom);
            }
            break;
          }

          default:
            console.log(`[CommandGateway] Unrecognized message type: ${msg.type}`);
        }
      } catch (err) {
        console.error('[CommandGateway] Error parsing message:', err);
      }
    });

    const cleanup = () => {
      if (currentAgentConn && roomId) {
        this.removeAgent(roomId, currentAgentConn.clientId);
        this.broadcastAgentStatus(roomId);
      }
      if (currentHostConn && roomId) {
        this.removeHostListener(roomId, currentHostConn);
      }
    };

    ws.on('close', cleanup);
    ws.on('error', (err) => {
      console.error(`[CommandGateway] WebSocket error (${role}, room: ${roomId}):`, err);
      cleanup();
    });
  }

  private registerAgent(roomId: string, agent: AgentConnection): void {
    if (!this.activeAgents.has(roomId)) {
      this.activeAgents.set(roomId, new Map());
    }
    this.activeAgents.get(roomId)!.set(agent.clientId, agent);
    console.log(`[CommandGateway] Registered agent ${agent.clientId} in room ${roomId} (Device: ${agent.deviceName})`);
  }

  private removeAgent(roomId: string, clientId: string): void {
    const agents = this.activeAgents.get(roomId);
    if (agents) {
      agents.delete(clientId);
      if (agents.size === 0) {
        this.activeAgents.delete(roomId);
      }
      console.log(`[CommandGateway] Removed agent ${clientId} from room ${roomId}`);
    }
  }

  private getAgent(roomId: string, clientId: string): AgentConnection | undefined {
    return this.activeAgents.get(roomId)?.get(clientId);
  }

  private addHostListener(roomId: string, host: HostConnection): void {
    if (!this.hostListeners.has(roomId)) {
      this.hostListeners.set(roomId, new Set());
    }
    this.hostListeners.get(roomId)!.add(host);
    console.log(`[CommandGateway] Host subscribed to room ${roomId} (Total hosts: ${this.hostListeners.get(roomId)!.size})`);
  }

  private removeHostListener(roomId: string, host: HostConnection): void {
    const hosts = this.hostListeners.get(roomId);
    if (hosts) {
      hosts.delete(host);
      if (hosts.size === 0) {
        this.hostListeners.delete(roomId);
      }
      console.log(`[CommandGateway] Host unsubscribed from room ${roomId}`);
    }
  }

  public getAgentsForRoom(roomId: string): AgentInfo[] {
    const sanitized = sanitizeRoomId(roomId);
    const agents = this.activeAgents.get(sanitized);
    if (!agents) return [];

    const result: AgentInfo[] = [];
    for (const agent of agents.values()) {
      result.push({
        clientId: agent.clientId,
        roomId: agent.roomId,
        deviceName: agent.deviceName,
        hasScreenPermission: agent.hasScreenPermission,
        lastHeartbeat: agent.lastHeartbeat,
        connectedAt: agent.connectedAt,
        status: agent.status,
      });
    }
    return result;
  }

  public getAllActiveAgents(): AgentInfo[] {
    const result: AgentInfo[] = [];
    for (const agents of this.activeAgents.values()) {
      for (const agent of agents.values()) {
        result.push({
          clientId: agent.clientId,
          roomId: agent.roomId,
          deviceName: agent.deviceName,
          hasScreenPermission: agent.hasScreenPermission,
          lastHeartbeat: agent.lastHeartbeat,
          connectedAt: agent.connectedAt,
          status: agent.status,
        });
      }
    }
    return result;
  }

  public getActiveAgentCount(roomId: string): number {
    const sanitized = sanitizeRoomId(roomId);
    return this.activeAgents.get(sanitized)?.size || 0;
  }

  public getHostCount(roomId: string): number {
    const sanitized = sanitizeRoomId(roomId);
    return this.hostListeners.get(sanitized)?.size || 0;
  }

  public broadcastAgentStatus(roomId: string): void {
    const sanitized = sanitizeRoomId(roomId);
    const agents = this.getAgentsForRoom(sanitized);
    const payload = {
      type: 'AGENT_STATUS_UPDATE',
      roomId: sanitized,
      agents,
    };
    this.broadcastToHosts(sanitized, payload);
  }

  public sendAgentStatusTo(ws: WebSocket, roomId: string): void {
    const sanitized = sanitizeRoomId(roomId);
    const agents = this.getAgentsForRoom(sanitized);
    this.safeSend(ws, {
      type: 'AGENT_STATUS_UPDATE',
      roomId: sanitized,
      agents,
    });
  }

  public broadcastScreenshotNew(roomId: string, screenshot: ScreenshotMetadata): void {
    const sanitized = sanitizeRoomId(roomId);
    const payload = {
      type: 'SCREENSHOT_NEW',
      roomId: sanitized,
      screenshot,
    };
    this.broadcastToHosts(sanitized, payload);

    // Resolve any awaiting HTTP callers for this room
    const resolvers = this.pendingCaptureResolvers.get(sanitized);
    if (resolvers && resolvers.length > 0) {
      this.pendingCaptureResolvers.delete(sanitized);
      for (const resolve of resolvers) {
        try {
          resolve(screenshot);
        } catch (e) {
          console.error('[CommandGateway] Error in pending capture resolver:', e);
        }
      }
    }
  }

  public broadcastToHosts(roomId: string, message: any): void {
    const sanitized = sanitizeRoomId(roomId);
    const hosts = this.hostListeners.get(sanitized);
    if (!hosts || hosts.size === 0) return;

    const data = JSON.stringify(message);
    for (const host of hosts) {
      if (host.ws.readyState === WebSocket.OPEN) {
        try {
          host.ws.send(data);
        } catch (err) {
          console.error(`[CommandGateway] Failed to send message to host in room ${sanitized}:`, err);
        }
      }
    }
  }

  public requestScreenshot(
    roomId: string,
    targetClientId?: string,
    requestId?: string
  ): { success: boolean; agentCount: number; error?: string } {
    const sanitized = sanitizeRoomId(roomId);
    const agentsMap = this.activeAgents.get(sanitized);

    if (!agentsMap || agentsMap.size === 0) {
      return { success: false, agentCount: 0, error: '当前房间暂无在线的桌面监控端' };
    }

    const commandPayload = {
      type: 'COMMAND_SCREENSHOT',
      roomId: sanitized,
      requestId: requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      triggerType: 'ondemand',
      timestamp: Date.now(),
    };

    let dispatched = 0;
    if (targetClientId) {
      const agent = agentsMap.get(targetClientId);
      if (agent && agent.ws.readyState === WebSocket.OPEN) {
        this.safeSend(agent.ws, commandPayload);
        dispatched++;
      } else {
        return { success: false, agentCount: 0, error: `Agent ${targetClientId} not found or disconnected` };
      }
    } else {
      for (const agent of agentsMap.values()) {
        if (agent.ws.readyState === WebSocket.OPEN) {
          this.safeSend(agent.ws, commandPayload);
          dispatched++;
        }
      }
    }

    return { success: dispatched > 0, agentCount: dispatched };
  }

  public async requestScreenshotAndWait(
    roomId: string,
    targetClientId?: string,
    requestId?: string,
    timeoutMs = 5000
  ): Promise<{ success: boolean; agentCount: number; screenshot?: ScreenshotMetadata; error?: string }> {
    const sanitized = sanitizeRoomId(roomId);
    const reqId = requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const dispatchResult = this.requestScreenshot(sanitized, targetClientId, reqId);

    if (!dispatchResult.success) {
      return dispatchResult;
    }

    return new Promise((resolve) => {
      let isCompleted = false;

      const resolver = (screenshot: ScreenshotMetadata) => {
        if (!isCompleted) {
          isCompleted = true;
          clearTimeout(timer);
          resolve({
            success: true,
            agentCount: dispatchResult.agentCount,
            screenshot,
          });
        }
      };

      const timer = setTimeout(() => {
        if (!isCompleted) {
          isCompleted = true;
          // Clean up resolver from map
          const list = this.pendingCaptureResolvers.get(sanitized) || [];
          const idx = list.indexOf(resolver);
          if (idx !== -1) list.splice(idx, 1);
          if (list.length === 0) this.pendingCaptureResolvers.delete(sanitized);

          resolve({
            success: true,
            agentCount: dispatchResult.agentCount,
          });
        }
      }, timeoutMs);

      const list = this.pendingCaptureResolvers.get(sanitized) || [];
      list.push(resolver);
      this.pendingCaptureResolvers.set(sanitized, list);
    });
  }

  private safeSend(ws: WebSocket, payload: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(payload));
      } catch (err) {
        console.error('[CommandGateway] Error sending message to websocket:', err);
      }
    }
  }

  public disconnectRoomAgents(roomId: string): void {
    const sanitized = sanitizeRoomId(roomId);
    const agents = this.activeAgents.get(sanitized);
    if (agents) {
      for (const [clientId, agent] of agents.entries()) {
        try {
          this.safeSend(agent.ws, {
            type: 'ERROR',
            message: 'Room has been closed by host',
          });
          agent.ws.close(4404, 'Room closed by host');
        } catch {}
      }
      this.activeAgents.delete(sanitized);
      this.broadcastAgentStatus(sanitized);
    }
  }

  public cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export const commandGateway = new CommandGateway();
