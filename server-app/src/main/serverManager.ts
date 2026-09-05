import path from 'path';
import fs from 'fs';
import http from 'http';
import { app } from 'electron';
import { ServerStatus } from './types';
import { startServer, ServerInstance } from '../../../server/src/serverApp.js';

export class ServerManager {
  private serverInstance: ServerInstance | null = null;
  private port = 3000;
  private isEmbedded = false;
  private lastStatus: ServerStatus = {
    status: 'stopped',
    port: 3000,
    url: 'http://127.0.0.1:3000',
    isEmbedded: false,
    lastChecked: Date.now(),
  };
  private statusListeners: Array<(status: ServerStatus) => void> = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(port = 3000) {
    this.port = port;
  }

  public onStatusChange(listener: (status: ServerStatus) => void): () => void {
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
        console.error('[ServerManager] Error in status listener:', err);
      }
    }
  }

  public getStatus(): ServerStatus {
    return { ...this.lastStatus };
  }

  /**
   * Check if backend server is responsive on port 3000
   */
  public async checkHealth(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${this.port}/api/health`, { timeout: 1500 }, (res) => {
        if (res.statusCode === 200) {
          this.lastStatus = {
            status: 'running',
            port: this.port,
            url: `http://127.0.0.1:${this.port}`,
            isEmbedded: this.isEmbedded,
            lastChecked: Date.now(),
          };
          this.notifyStatus();
          resolve(true);
        } else {
          resolve(false);
        }
      });

      req.on('error', () => {
        this.lastStatus = {
          status: this.isEmbedded ? 'starting' : 'stopped',
          port: this.port,
          url: `http://127.0.0.1:${this.port}`,
          isEmbedded: this.isEmbedded,
          lastChecked: Date.now(),
        };
        this.notifyStatus();
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Start or ensure backend server is running
   */
  public async ensureServerRunning(): Promise<ServerStatus> {
    const isAlreadyRunning = await this.checkHealth();
    if (isAlreadyRunning) {
      console.log(`[ServerManager] Existing server detected on port ${this.port}`);
      this.startHealthCheckPolling();
      return this.getStatus();
    }

    console.log(`[ServerManager] Starting embedded in-process server on port ${this.port}...`);
    this.lastStatus.status = 'starting';
    this.notifyStatus();

    try {
      // Determine base data directory for persistence
      let dataDir: string;
      if (process.env.DATA_DIR) {
        dataDir = process.env.DATA_DIR;
      } else if (app && app.isPackaged) {
        dataDir = path.join(app.getPath('documents'), 'coder_pad_平替', 'data');
      } else {
        const cwd = process.cwd();
        if (!cwd || cwd === '/' || cwd.startsWith('/Applications')) {
          dataDir = path.join(app?.getPath ? app.getPath('documents') : (process.env.HOME || '/tmp'), 'coder_pad_平替', 'data');
        } else {
          dataDir = path.resolve(cwd, 'data');
        }
      }

      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.serverInstance = await startServer(this.port, '0.0.0.0', dataDir);
      this.isEmbedded = true;
      this.lastStatus = {
        status: 'running',
        port: this.port,
        url: `http://127.0.0.1:${this.port}`,
        isEmbedded: true,
        lastChecked: Date.now(),
      };
      this.notifyStatus();
      console.log(`[ServerManager] Embedded server successfully running on http://127.0.0.1:${this.port} (DataDir: ${dataDir})`);
    } catch (err: any) {
      console.error('[ServerManager] Failed to start in-process server:', err);
      this.lastStatus = {
        status: 'error',
        port: this.port,
        url: `http://127.0.0.1:${this.port}`,
        isEmbedded: false,
        error: err.message || 'Failed to start server',
        lastChecked: Date.now(),
      };
      this.notifyStatus();
    }

    this.startHealthCheckPolling();
    return this.getStatus();
  }

  private startHealthCheckPolling(): void {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, 4000);
  }

  public async stop(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.serverInstance) {
      console.log('[ServerManager] Closing in-process server...');
      try {
        await this.serverInstance.close();
      } catch (err) {
        console.error('[ServerManager] Error closing server:', err);
      }
      this.serverInstance = null;
      this.isEmbedded = false;
    }
    this.lastStatus.status = 'stopped';
    this.notifyStatus();
  }
}

export const serverManager = new ServerManager(3000);
