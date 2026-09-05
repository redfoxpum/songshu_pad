import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { roomManager } from './roomManager.js';
import { commandGateway } from './commandGateway.js';
import { getOnlineClientCount } from './websocket.js';
import {
  ensureRoomDir,
  getRoomScreenshotsDir,
  getScreenshotCount,
  sanitizeRoomId,
  ensureUnassignedDir,
  getUnassignedScreenshotsDir,
  listUnassignedScreenshots,
  getUnassignedScreenshotFilePath,
} from './persistence.js';
import { SupportedLanguage, TriggerType, ScreenshotMetadata } from './types.js';

export const apiRouter = Router();

// Multer Disk Storage Configuration for Room Screenshot Uploads
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const roomId = sanitizeRoomId(req.params.roomId || req.params.id || '');
    ensureRoomDir(roomId);
    const dest = getRoomScreenshotsDir(roomId);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const rawTrigger = (req.body?.triggerType || 'scheduled').toString().toLowerCase();
    let triggerType: TriggerType = 'scheduled';
    if (rawTrigger === 'ondemand' || rawTrigger === 'instant') triggerType = 'ondemand';
    else if (rawTrigger === 'initial') triggerType = 'initial';
    else if (rawTrigger === 'manual') triggerType = 'manual';
    else triggerType = 'scheduled';

    const rawClient = (req.body?.clientId || 'agent').toString();
    const clientId = rawClient.replace(/[^a-zA-Z0-9_-]/g, '') || 'agent';

    let ext = '.webp';
    if (file.mimetype === 'image/png' || file.originalname.endsWith('.png')) {
      ext = '.png';
    } else if (
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/jpg' ||
      file.originalname.endsWith('.jpg') ||
      file.originalname.endsWith('.jpeg')
    ) {
      ext = '.jpg';
    } else if (file.mimetype === 'image/webp' || file.originalname.endsWith('.webp')) {
      ext = '.webp';
    }

    const filename = `${timestamp}_${triggerType}_${clientId}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

// Multer Disk Storage Configuration for Unassigned Screenshot Uploads
const unassignedStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUnassignedDir();
    const dest = getUnassignedScreenshotsDir();
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const rawTrigger = (req.body?.triggerType || req.body?.type || 'initial').toString().toLowerCase();
    let triggerType: TriggerType = 'initial';
    if (rawTrigger === 'ondemand' || rawTrigger === 'instant') triggerType = 'ondemand';
    else if (rawTrigger === 'scheduled' || rawTrigger === 'interval') triggerType = 'scheduled';
    else if (rawTrigger === 'manual') triggerType = 'manual';
    else triggerType = 'initial';

    const rawClient = (req.body?.clientId || 'agent').toString();
    const clientId = rawClient.replace(/[^a-zA-Z0-9_-]/g, '') || 'agent';

    let ext = '.webp';
    if (file.mimetype === 'image/png' || file.originalname.endsWith('.png')) {
      ext = '.png';
    } else if (
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/jpg' ||
      file.originalname.endsWith('.jpg') ||
      file.originalname.endsWith('.jpeg')
    ) {
      ext = '.jpg';
    } else if (file.mimetype === 'image/webp' || file.originalname.endsWith('.webp')) {
      ext = '.webp';
    }

    const filename = `${timestamp}_${triggerType}_${clientId}${ext}`;
    cb(null, filename);
  },
});

const uploadUnassigned = multer({
  storage: unassignedStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Health check
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// List all created rooms with metadata (id, name, language, createdAt, lastActiveAt, screenshotCount, onlineClients)
apiRouter.get('/rooms', (req: Request, res: Response) => {
  try {
    const includeClosed = req.query.includeClosed !== 'false' && req.query.all !== 'false';
    const rooms = roomManager.getAllRooms((roomId) => getOnlineClientCount(roomId), includeClosed);

    // Attach live candidateStatus to each room item
    for (const room of rooms) {
      const agents = commandGateway.getAgentsForRoom(room.id);
      const isConnected = agents.length > 0;
      const primaryAgent = isConnected ? agents[0] : null;
      room.candidateStatus = {
        roomId: room.id,
        connected: isConnected,
        agentName: primaryAgent?.deviceName || (isConnected ? '候选人桌面监控端' : '桌面端未连接'),
        permissionStatus: isConnected
          ? primaryAgent?.hasScreenPermission
            ? 'normal'
            : 'unauthorized'
          : 'unknown',
        lastSeen: primaryAgent?.lastHeartbeat || Date.now(),
        ip: '127.0.0.1',
        latencyMs: isConnected ? 12 : undefined,
      };
    }

    res.json({ rooms });
  } catch (error) {
    console.error('[API] Failed to list rooms:', error);
    res.status(500).json({ error: 'Failed to list rooms' });
  }
});

// Create a new room with optional name and language, creating directory structure ./data/rooms/<roomId>/screenshots
apiRouter.post('/rooms', (req: Request, res: Response) => {
  try {
    const { language = 'python', name } = req.body as { language?: SupportedLanguage; name?: string };
    const validLanguage: SupportedLanguage = ['python', 'cpp', 'java'].includes(language) ? language : 'python';

    const roomMeta = roomManager.createRoom(validLanguage, name);
    const onlineClients = getOnlineClientCount(roomMeta.id);
    const screenshotCount = getScreenshotCount(roomMeta.id);

    res.status(201).json({
      id: roomMeta.id,
      name: roomMeta.name || name || roomMeta.id,
      language: roomMeta.language,
      createdAt: roomMeta.createdAt,
      lastActiveAt: roomMeta.lastActiveAt,
      status: 'active',
      exists: true,
      screenshotCount,
      onlineClients,
    });
  } catch (error) {
    console.error('[API] Failed to create room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get detailed room info including screenshotCount and onlineClients
apiRouter.get('/rooms/:id', (req: Request, res: Response) => {
  try {
    const roomId = sanitizeRoomId(req.params.id);
    const includeClosed = req.query.includeClosed === 'true' || req.query.all === 'true';
    const onlineClients = getOnlineClientCount(roomId);
    const info = roomManager.getRoomInfo(roomId, onlineClients, includeClosed);

    if (!info || (!includeClosed && info.status === 'closed')) {
      return res.status(404).json({
        error: 'Room not found or has been closed by host',
        exists: false,
        isClosed: info?.status === 'closed',
      });
    }

    res.json(info);
  } catch (error) {
    console.error('[API] Failed to get room info:', error);
    res.status(500).json({ error: 'Failed to get room information' });
  }
});

// Soft-delete / Close room (disconnects all participants and prevents new joins, preserves disk data)
apiRouter.delete(['/rooms/:id', '/rooms/:id/close'], (req: Request, res: Response) => {
  try {
    const roomId = sanitizeRoomId(req.params.id);
    if (!roomId) {
      return res.status(400).json({ error: 'Invalid room id' });
    }
    const success = roomManager.closeRoom(roomId);
    if (!success) {
      return res.status(404).json({ error: 'Room not found' });
    }
    console.log(`[API] Room ${roomId} has been safely closed by host.`);
    res.json({ success: true, message: 'Room closed successfully', roomId });
  } catch (error) {
    console.error('[API] Failed to close room:', error);
    res.status(500).json({ error: 'Failed to close room' });
  }
});

apiRouter.post('/rooms/:id/close', (req: Request, res: Response) => {
  try {
    const roomId = sanitizeRoomId(req.params.id);
    if (!roomId) {
      return res.status(400).json({ error: 'Invalid room id' });
    }
    const success = roomManager.closeRoom(roomId);
    if (!success) {
      return res.status(404).json({ error: 'Room not found' });
    }
    console.log(`[API] Room ${roomId} has been safely closed by host.`);
    res.json({ success: true, message: 'Room closed successfully', roomId });
  } catch (error) {
    console.error('[API] Failed to close room:', error);
    res.status(500).json({ error: 'Failed to close room' });
  }
});

// Reopen / Restore a closed room
apiRouter.post('/rooms/:id/reopen', (req: Request, res: Response) => {
  try {
    const roomId = sanitizeRoomId(req.params.id);
    if (!roomId) {
      return res.status(400).json({ error: 'Invalid room id' });
    }
    const success = roomManager.reopenRoom(roomId);
    if (!success) {
      return res.status(404).json({ error: 'Room not found' });
    }
    console.log(`[API] Room ${roomId} has been reopened by host.`);
    res.json({ success: true, message: 'Room reopened successfully', roomId });
  } catch (error) {
    console.error('[API] Failed to reopen room:', error);
    res.status(500).json({ error: 'Failed to reopen room' });
  }
});

// Upload screenshot file (multipart/form-data, field `screenshot`, supports triggerType, clientId, deviceName)
apiRouter.post(
  ['/rooms/:roomId/screenshots', '/rooms/:id/screenshots'],
  upload.single('screenshot'),
  (req: Request, res: Response) => {
    try {
      const roomId = sanitizeRoomId(req.params.roomId || req.params.id || '');
      if (!roomId) {
        return res.status(400).json({ error: 'Invalid roomId' });
      }

      let filename = '';
      let size = 0;
      let triggerType: TriggerType = 'scheduled';
      let clientId = 'agent';
      let deviceName = req.body?.deviceName;
      let timestamp = Date.now();

      if (req.file) {
        const rawTrigger = (req.body?.triggerType || '').toString().toLowerCase();
        triggerType = rawTrigger === 'ondemand' ? 'ondemand' : 'scheduled';
        clientId = (req.body?.clientId || 'agent').toString().replace(/[^a-zA-Z0-9_-]/g, '') || 'agent';
        deviceName = req.body?.deviceName;

        const ext = path.extname(req.file.originalname) || path.extname(req.file.filename) || '.webp';
        const targetFilename = `${timestamp}_${triggerType}_${clientId}${ext}`;
        const targetPath = path.join(getRoomScreenshotsDir(roomId), targetFilename);

        if (req.file.path !== targetPath) {
          try {
            fs.renameSync(req.file.path, targetPath);
          } catch (e) {
            // fallback if already at targetPath
          }
        }
        filename = targetFilename;
        size = req.file.size;
      } else if (req.body?.imageBase64) {
        // Support base64 JSON payload as fallback
        const rawTrigger = (req.body?.type || req.body?.triggerType || 'scheduled').toString().toLowerCase();
        triggerType = rawTrigger === 'instant' || rawTrigger === 'ondemand' ? 'ondemand' : 'scheduled';
        clientId = (req.body?.clientId || 'agent').toString().replace(/[^a-zA-Z0-9_-]/g, '') || 'agent';
        timestamp = req.body?.timestamp || Date.now();
        deviceName = req.body?.deviceName;

        const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        size = buffer.length;

        ensureRoomDir(roomId);
        const screenshotsDir = getRoomScreenshotsDir(roomId);
        filename = `${timestamp}_${triggerType}_${clientId}.webp`;
        const filePath = path.join(screenshotsDir, filename);
        fs.writeFileSync(filePath, buffer);
      } else {
        return res.status(400).json({ error: 'No screenshot file or imageBase64 provided in request' });
      }

      const screenshotMeta: ScreenshotMetadata = {
        filename,
        url: `/api/rooms/${roomId}/screenshots/${filename}`,
        roomId,
        timestamp,
        triggerType,
        clientId,
        deviceName,
        size,
        createdAt: timestamp,
      };

      // Broadcast new screenshot notification to connected host listeners via command gateway
      commandGateway.broadcastScreenshotNew(roomId, screenshotMeta);

      return res.status(201).json({
        success: true,
        screenshot: screenshotMeta,
      });
    } catch (error) {
      console.error('[API] Failed to upload screenshot:', error);
      return res.status(500).json({ error: 'Failed to upload screenshot' });
    }
  }
);

// Return JSON list of all screenshots in the room sorted by timestamp descending
apiRouter.get(['/rooms/:roomId/screenshots', '/rooms/:id/screenshots'], (req: Request, res: Response) => {
  try {
    const roomId = sanitizeRoomId(req.params.roomId || req.params.id || '');
    const screenshots = roomManager.getRoomScreenshots(roomId);
    res.json({ screenshots });
  } catch (error) {
    console.error('[API] Failed to list screenshots:', error);
    res.status(500).json({ error: 'Failed to list screenshots' });
  }
});

// Serve the screenshot image file directly with proper Content-Type headers
apiRouter.get(
  ['/rooms/:roomId/screenshots/:filename', '/rooms/:id/screenshots/:filename'],
  (req: Request, res: Response) => {
    try {
      const roomId = sanitizeRoomId(req.params.roomId || req.params.id || '');
      const filename = path.basename(req.params.filename);
      const screenshotsDir = getRoomScreenshotsDir(roomId);
      const filePath = path.join(screenshotsDir, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Screenshot not found' });
      }

      const ext = path.extname(filename).toLowerCase();
      let contentType = 'image/webp';
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.svg') contentType = 'image/svg+xml';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.sendFile(filePath);
    } catch (error) {
      console.error('[API] Failed to serve screenshot:', error);
      res.status(500).json({ error: 'Failed to serve screenshot' });
    }
  }
);

// Delete individual screenshot
apiRouter.delete(
  ['/rooms/:roomId/screenshots/:filename', '/rooms/:id/screenshots/:filename'],
  (req: Request, res: Response) => {
    try {
      const roomId = sanitizeRoomId(req.params.roomId || req.params.id || '');
      const filename = path.basename(req.params.filename);
      const screenshotsDir = getRoomScreenshotsDir(roomId);
      const filePath = path.join(screenshotsDir, filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return res.json({ success: true, message: 'Screenshot deleted' });
      }

      res.status(404).json({ error: 'Screenshot not found' });
    } catch (error) {
      console.error('[API] Failed to delete screenshot:', error);
      res.status(500).json({ error: 'Failed to delete screenshot' });
    }
  }
);

// Trigger an on-demand screenshot for connected desktop agents in this room via the command gateway
apiRouter.post(
  [
    '/rooms/:roomId/request-screenshot',
    '/rooms/:id/request-screenshot',
    '/rooms/:roomId/capture',
    '/rooms/:id/capture',
  ],
  async (req: Request, res: Response) => {
    try {
      const roomId = sanitizeRoomId(req.params.roomId || req.params.id || '');
      const { clientId } = req.body || {};

      const result = await commandGateway.requestScreenshotAndWait(roomId, clientId, undefined, 5000);
      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: result.error || '当前房间暂无在线的桌面监控端',
          agentCount: 0,
        });
      }

      return res.json({
        success: true,
        message: result.screenshot
          ? '即时截屏已成功抓取并存入时间线'
          : `截屏指令已下发至 ${result.agentCount} 个桌面端`,
        screenshot: result.screenshot,
        agentCount: result.agentCount,
      });
    } catch (error) {
      console.error('[API] Failed to request screenshot:', error);
      res.status(500).json({ error: 'Failed to request screenshot' });
    }
  }
);

// Candidate Agents Status endpoint
apiRouter.get(
  ['/rooms/:roomId/agents', '/rooms/:id/agents', '/rooms/:roomId/agent', '/rooms/:id/agent'],
  (req: Request, res: Response) => {
    try {
      const roomId = sanitizeRoomId(req.params.roomId || req.params.id || '');
      const agents = commandGateway.getAgentsForRoom(roomId);
      const isConnected = agents.length > 0;
      const primaryAgent = isConnected ? agents[0] : null;

      res.json({
        roomId,
        connected: isConnected,
        agentName: primaryAgent?.deviceName || (isConnected ? '候选人桌面监控端' : '桌面端未连接'),
        permissionStatus: isConnected
          ? primaryAgent?.hasScreenPermission
            ? 'normal'
            : 'unauthorized'
          : 'unknown',
        lastSeen: primaryAgent?.lastHeartbeat || Date.now(),
        ip: '127.0.0.1',
        latencyMs: isConnected ? 12 : undefined,
        agents,
        activeCount: agents.length,
      });
    } catch (error) {
      console.error('[API] Failed to get agents status:', error);
      res.status(500).json({ error: 'Failed to get agent status' });
    }
  }
);

// =========================================================================
// UNASSIGNED / PUBLIC SCREENSHOTS ENDPOINTS (Pre-room / Initial captures)
// =========================================================================

// Upload unassigned screenshot file (multipart/form-data, field `screenshot`, supports triggerType, clientId, deviceName)
apiRouter.post(
  ['/unassigned/screenshots', '/screenshots/unassigned'],
  uploadUnassigned.single('screenshot'),
  (req: Request, res: Response) => {
    try {
      ensureUnassignedDir();
      const destDir = getUnassignedScreenshotsDir();

      let filename = '';
      let size = 0;
      let triggerType: TriggerType = 'initial';
      let clientId = 'agent';
      let deviceName = req.body?.deviceName;
      let timestamp = Date.now();

      const rawTrigger = (req.body?.triggerType || req.body?.type || 'initial').toString().toLowerCase();
      if (rawTrigger === 'ondemand' || rawTrigger === 'instant') triggerType = 'ondemand';
      else if (rawTrigger === 'scheduled' || rawTrigger === 'interval') triggerType = 'scheduled';
      else if (rawTrigger === 'manual') triggerType = 'manual';
      else triggerType = 'initial';

      clientId = (req.body?.clientId || 'agent').toString().replace(/[^a-zA-Z0-9_-]/g, '') || 'agent';
      deviceName = req.body?.deviceName;

      if (req.file) {
        const ext = path.extname(req.file.originalname) || path.extname(req.file.filename) || '.webp';
        const targetFilename = `${timestamp}_${triggerType}_${clientId}${ext}`;
        const targetPath = path.join(destDir, targetFilename);

        if (req.file.path !== targetPath) {
          try {
            fs.renameSync(req.file.path, targetPath);
          } catch (e) {
            // fallback if already at targetPath
          }
        }
        filename = targetFilename;
        size = req.file.size;
      } else if (req.body?.imageBase64 || req.body?.imageBufferBase64) {
        const base64Str = req.body.imageBase64 || req.body.imageBufferBase64;
        timestamp = req.body?.timestamp || Date.now();
        const base64Data = base64Str.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        size = buffer.length;

        filename = `${timestamp}_${triggerType}_${clientId}.webp`;
        const filePath = path.join(destDir, filename);
        fs.writeFileSync(filePath, buffer);
      } else {
        return res.status(400).json({ error: 'No screenshot file or imageBase64 provided in request' });
      }

      const screenshotMeta: ScreenshotMetadata = {
        filename,
        url: `/api/unassigned/screenshots/${filename}`,
        timestamp,
        triggerType,
        clientId,
        deviceName,
        size,
        createdAt: timestamp,
      };

      console.log(`[API] Saved unassigned screenshot: ${filename} (${size} bytes)`);

      return res.status(201).json({
        success: true,
        screenshot: screenshotMeta,
      });
    } catch (error) {
      console.error('[API] Failed to upload unassigned screenshot:', error);
      return res.status(500).json({ error: 'Failed to upload screenshot' });
    }
  }
);

// Return JSON list of all unassigned screenshots sorted by timestamp descending
apiRouter.get(['/unassigned/screenshots', '/screenshots/unassigned'], (_req: Request, res: Response) => {
  try {
    const screenshots = listUnassignedScreenshots();
    res.json({ screenshots, count: screenshots.length });
  } catch (error) {
    console.error('[API] Failed to list unassigned screenshots:', error);
    res.status(500).json({ error: 'Failed to list unassigned screenshots' });
  }
});

// Serve the unassigned screenshot image file directly with proper Content-Type headers
apiRouter.get(
  ['/unassigned/screenshots/:filename', '/screenshots/unassigned/:filename'],
  (req: Request, res: Response) => {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = getUnassignedScreenshotFilePath(filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Screenshot not found' });
      }

      const ext = path.extname(filename).toLowerCase();
      let contentType = 'image/webp';
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.svg') contentType = 'image/svg+xml';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.sendFile(filePath);
    } catch (error) {
      console.error('[API] Failed to serve unassigned screenshot:', error);
      res.status(500).json({ error: 'Failed to serve screenshot' });
    }
  }
);

// Delete individual unassigned screenshot
apiRouter.delete(
  ['/unassigned/screenshots/:filename', '/screenshots/unassigned/:filename'],
  (req: Request, res: Response) => {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = getUnassignedScreenshotFilePath(filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return res.json({ success: true, message: 'Screenshot deleted' });
      }

      res.status(404).json({ error: 'Screenshot not found' });
    } catch (error) {
      console.error('[API] Failed to delete unassigned screenshot:', error);
      res.status(500).json({ error: 'Failed to delete screenshot' });
    }
  }
);

