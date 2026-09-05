import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { apiRouter } from './routes.js';
import { initWebSocketServer, getAllLoadedDocs } from './websocket.js';
import { flushAllSaves } from './persistence.js';
import { commandGateway } from './commandGateway.js';

const getDirname = () => {
  if (typeof __dirname !== 'undefined') return __dirname;
  return path.dirname(fileURLToPath(import.meta?.url || 'file://'));
};

export interface ServerInstance {
  server: http.Server;
  wss: WebSocketServer;
  port: number;
  host: string;
  close: () => Promise<void>;
}

export async function startServer(
  port = 3000,
  host = '0.0.0.0',
  customDataDir?: string
): Promise<ServerInstance> {
  if (customDataDir) {
    process.env.DATA_DIR = customDataDir;
  }

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API routes
  app.use('/api', apiRouter);

  // Resolve client dist path
  const dir = getDirname();
  const possibleClientPaths = [
    path.resolve(dir, '../client'),
    path.resolve(dir, '../../client/dist'),
    path.resolve(process.cwd(), '../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(dir, '../client/dist'),
  ];

  const clientDistPath = possibleClientPaths.find((p) => fs.existsSync(p));

  if (clientDistPath) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
        return next();
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.send({
        name: '松鼠Pad 协同服务器 (Squirrel Pad Server)',
        status: 'running',
        wsUrl: `ws://${host}:${port}/ws`,
      });
    });
  }

  // Create HTTP Server
  const server = http.createServer(app);

  // Create WebSocket Server
  const wss = new WebSocketServer({ noServer: true });
  initWebSocketServer(wss);

  // Handle HTTP upgrade for WebSockets
  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(port, host, () => {
      console.log(`[Server] Listening on http://${host}:${port}`);
      resolve();
    });
    server.once('error', reject);
  });

  const close = async (): Promise<void> => {
    return new Promise((resolve) => {
      commandGateway.cleanup();
      flushAllSaves(getAllLoadedDocs());
      server.close(() => {
        resolve();
      });
    });
  };

  return {
    server,
    wss,
    port,
    host,
    close,
  };
}
