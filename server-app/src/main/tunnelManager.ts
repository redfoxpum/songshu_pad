import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import { TunnelStatus } from './types';

export class TunnelManager {
  private tunnelProcess: ChildProcess | null = null;
  private localPort = 3000;
  private status: TunnelStatus = {
    status: 'disconnected',
    publicUrl: null,
    logs: [],
  };
  private statusListeners: Array<(status: TunnelStatus) => void> = [];
  private logBuffer: string[] = [];

  constructor(localPort = 3000) {
    this.localPort = localPort;
  }

  public onStatusChange(listener: (status: TunnelStatus) => void): () => void {
    this.statusListeners.push(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyStatus(): void {
    const status = this.getStatus();
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('[TunnelManager] Error in status listener:', err);
      }
    }
  }

  public getStatus(): TunnelStatus {
    return {
      ...this.status,
      logs: [...this.logBuffer],
    };
  }

  /**
   * Locate cloudflared binary
   */
  public findCloudflaredBinary(): string | null {
    const candidatePaths = [
      '/opt/homebrew/bin/cloudflared',
      '/usr/local/bin/cloudflared',
      '/usr/bin/cloudflared',
      'cloudflared',
    ];

    for (const candidate of candidatePaths) {
      if (candidate === 'cloudflared') {
        return candidate;
      }
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return 'cloudflared';
  }

  /**
   * Start Cloudflare quick tunnel
   */
  public async start(): Promise<TunnelStatus> {
    if (this.tunnelProcess) {
      return this.getStatus();
    }

    const binary = this.findCloudflaredBinary() || 'cloudflared';
    this.status = {
      status: 'connecting',
      publicUrl: null,
      binaryPath: binary,
      logs: [],
    };
    this.logBuffer = [];
    this.notifyStatus();

    const args = ['tunnel', '--url', `http://127.0.0.1:${this.localPort}`];
    console.log(`[TunnelManager] Spawning ${binary} ${args.join(' ')}`);

    try {
      this.tunnelProcess = spawn(binary, args, {
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;

      const handleOutput = (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          this.logBuffer.push(trimmed);
          if (this.logBuffer.length > 50) this.logBuffer.shift();

          console.log(`[cloudflared] ${trimmed}`);

          // Parse trycloudflare public URL
          const match = trimmed.match(urlRegex);
          if (match) {
            const publicUrl = match[0];
            console.log(`[TunnelManager] 🚀 Cloudflare Tunnel Ready: ${publicUrl}`);
            this.status = {
              status: 'connected',
              publicUrl,
              binaryPath: binary,
              logs: [...this.logBuffer],
            };
            this.notifyStatus();
          }
        }
      };

      this.tunnelProcess.stdout?.on('data', handleOutput);
      this.tunnelProcess.stderr?.on('data', handleOutput);

      this.tunnelProcess.on('error', (err) => {
        console.error('[TunnelManager] Failed to run cloudflared:', err);
        this.status = {
          status: 'error',
          publicUrl: null,
          error: `cloudflared 启动失败: ${err.message}. 请确保安装了 cloudflared (brew install cloudflared)`,
          binaryPath: binary,
          logs: [...this.logBuffer],
        };
        this.tunnelProcess = null;
        this.notifyStatus();
      });

      this.tunnelProcess.on('exit', (code, signal) => {
        console.log(`[TunnelManager] cloudflared exited with code ${code}, signal ${signal}`);
        this.tunnelProcess = null;
        this.status = {
          status: 'disconnected',
          publicUrl: null,
          binaryPath: binary,
          logs: [...this.logBuffer],
        };
        this.notifyStatus();
      });

      return this.getStatus();
    } catch (err: any) {
      console.error('[TunnelManager] Exception starting tunnel:', err);
      this.status = {
        status: 'error',
        publicUrl: null,
        error: err.message || 'Error starting tunnel',
        logs: [...this.logBuffer],
      };
      this.notifyStatus();
      return this.getStatus();
    }
  }

  /**
   * Stop cloudflared tunnel
   */
  public stop(): void {
    if (this.tunnelProcess) {
      console.log('[TunnelManager] Stopping cloudflared tunnel process...');
      this.tunnelProcess.kill('SIGTERM');
      this.tunnelProcess = null;
    }
    this.status = {
      status: 'disconnected',
      publicUrl: null,
      logs: [...this.logBuffer],
    };
    this.notifyStatus();
  }

  /**
   * Restart tunnel
   */
  public async restart(): Promise<TunnelStatus> {
    this.stop();
    await new Promise((r) => setTimeout(r, 800));
    return this.start();
  }
}

export const tunnelManager = new TunnelManager(3000);
