import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { apiRouter } from './routes.js';
import { initWebSocketServer, getAllLoadedDocs } from './websocket.js';
import { flushAllSaves } from './persistence.js';
import { commandGateway } from './commandGateway.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API routes
app.use('/api', apiRouter);

// Resolve client dist path
const possibleClientPaths = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(__dirname, '../client/dist'),
];

let clientDistPath = possibleClientPaths.find((p) => fs.existsSync(p));

if (clientDistPath) {
  console.log(`[Server] Serving static client build from ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  // SPA fallback for all non-API GET requests
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath!, 'index.html'));
  });
} else {
  console.log('[Server] Client dist folder not found. Running in API/WS mode.');
  app.get('/', (_req, res) => {
    res.send({
      name: '松鼠Pad 协同服务器 (Squirrel Pad Server)',
      status: 'running',
      wsUrl: `ws://localhost:${PORT}/ws`,
      apiDocs: {
        'GET /api/rooms': 'List all created rooms with metadata',
        'POST /api/rooms': 'Create new room',
        'GET /api/rooms/:id': 'Get room information',
        'POST /api/rooms/:roomId/screenshots': 'Upload screenshot',
        'GET /api/rooms/:roomId/screenshots': 'List room screenshots',
        'GET /api/rooms/:roomId/screenshots/:filename': 'Serve screenshot image',
        'POST /api/rooms/:roomId/request-screenshot': 'Trigger on-demand screenshot',
      },
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
  // Accept WebSocket upgrades on /ws, /ws/* or root /*
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Start Server
server.listen(PORT, HOST, () => {
  console.log(`===========================================`);
  console.log(`🐿️ 松鼠Pad 服务已启动: http://${HOST}:${PORT}`);
  console.log(`🔌 WebSocket 协同网关: ws://${HOST}:${PORT}/ws`);
  console.log(`📡 Agent 指令控制网关: ws://${HOST}:${PORT}/ws/control & /ws/agent`);
  console.log(`===========================================`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n[Server] Shutting down gracefully...');
  commandGateway.cleanup();
  flushAllSaves(getAllLoadedDocs());
  server.close(() => {
    console.log('[Server] Closed all connections.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

