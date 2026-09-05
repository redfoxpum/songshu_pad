import * as fs from 'fs';
import * as path from 'path';
import * as Y from 'yjs';
import * as os from 'os';
import { RoomMetadata, SupportedLanguage, ScreenshotMetadata, TriggerType } from './types.js';

export function getBaseDataDir(): string {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR);
  }
  const cwd = process.cwd();
  if (!cwd || cwd === '/' || cwd.startsWith('/Applications')) {
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir() || '/tmp';
    return path.join(home, 'Documents', 'coder_pad_平替', 'data');
  }
  return path.resolve(cwd, 'data');
}

export function getDataDir(): string {
  return path.join(getBaseDataDir(), 'rooms');
}

export function getUnassignedDir(): string {
  return path.join(getBaseDataDir(), 'unassigned');
}

export function getUnassignedScreenshotsDir(): string {
  return path.join(getUnassignedDir(), 'screenshots');
}

// Ensure base data directory exists
export function ensureDataDir(): void {
  try {
    const dir = getDataDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.error('[Persistence] Failed to ensure data directory:', err);
  }
}

export function ensureUnassignedDir(): string {
  const screenshotsDir = getUnassignedScreenshotsDir();
  try {
    const unassignedDir = getUnassignedDir();
    if (!fs.existsSync(unassignedDir)) {
      fs.mkdirSync(unassignedDir, { recursive: true });
    }
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  } catch (err) {
    console.error('[Persistence] Failed to ensure unassigned directory:', err);
  }
  return screenshotsDir;
}

export function ensurePublicDir(): string {
  return ensureUnassignedDir();
}

// Sanitize roomId to prevent directory traversal
export function sanitizeRoomId(roomId: string): string {
  return roomId.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function getRoomDir(roomId: string): string {
  return path.join(getDataDir(), sanitizeRoomId(roomId));
}

export function getRoomDocPath(roomId: string): string {
  return path.join(getRoomDir(roomId), 'doc.bin');
}

export function getRoomMetaPath(roomId: string): string {
  return path.join(getRoomDir(roomId), 'meta.json');
}

export function getRoomScreenshotsDir(roomId: string): string {
  return path.join(getRoomDir(roomId), 'screenshots');
}

export function getLegacyRoomFilePath(roomId: string): string {
  return path.join(getDataDir(), `${sanitizeRoomId(roomId)}.bin`);
}

// Legacy getRoomFilePath alias for backward compatibility
export function getRoomFilePath(roomId: string): string {
  return getRoomDocPath(roomId);
}

/**
 * Migrates old ./data/rooms/<roomId>.bin to ./data/rooms/<roomId>/doc.bin if present.
 */
export function migrateLegacyRoom(roomId: string): boolean {
  const sanitized = sanitizeRoomId(roomId);
  const legacyPath = path.join(getDataDir(), `${sanitized}.bin`);
  const roomDir = getRoomDir(sanitized);
  const docPath = getRoomDocPath(sanitized);
  const screenshotsDir = getRoomScreenshotsDir(sanitized);

  if (fs.existsSync(legacyPath)) {
    try {
      const stat = fs.statSync(legacyPath);
      if (stat.isFile()) {
        if (!fs.existsSync(roomDir)) {
          fs.mkdirSync(roomDir, { recursive: true });
        }
        if (!fs.existsSync(screenshotsDir)) {
          fs.mkdirSync(screenshotsDir, { recursive: true });
        }

        // Copy / Move legacy .bin file to doc.bin
        if (!fs.existsSync(docPath)) {
          fs.copyFileSync(legacyPath, docPath);
        }

        // Create meta.json if not present
        const metaPath = getRoomMetaPath(sanitized);
        if (!fs.existsSync(metaPath)) {
          let lang: SupportedLanguage = 'python';
          if (sanitized.startsWith('cpp-')) lang = 'cpp';
          else if (sanitized.startsWith('java-')) lang = 'java';

          const initialMeta: RoomMetadata = {
            id: sanitized,
            name: sanitized,
            language: lang,
            createdAt: stat.birthtimeMs || stat.ctimeMs || Date.now(),
            lastActiveAt: stat.mtimeMs || Date.now(),
          };
          fs.writeFileSync(metaPath, JSON.stringify(initialMeta, null, 2), 'utf-8');
        }

        // Remove legacy .bin file after migration
        try {
          fs.unlinkSync(legacyPath);
        } catch {
          // Ignore unlink error if file locked
        }

        console.log(`[Persistence] Successfully migrated legacy room ${sanitized} to directory structure.`);
        return true;
      }
    } catch (err) {
      console.error(`[Persistence] Error during legacy room migration for ${sanitized}:`, err);
    }
  }
  return false;
}

/**
 * Ensures the room directory and screenshots directory exist, running legacy migration if needed.
 */
export function ensureRoomDir(roomId: string): string {
  ensureDataDir();
  const sanitized = sanitizeRoomId(roomId);
  migrateLegacyRoom(sanitized);

  const roomDir = getRoomDir(sanitized);
  const screenshotsDir = getRoomScreenshotsDir(sanitized);

  try {
    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir, { recursive: true });
    }
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  } catch (err) {
    console.error(`[Persistence] Failed to ensure room directory for ${sanitized}:`, err);
  }

  return roomDir;
}

/**
 * Check if a room exists either as a directory (with doc.bin or meta.json) or as legacy .bin file.
 */
export function roomExists(roomId: string): boolean {
  const sanitized = sanitizeRoomId(roomId);
  if (!sanitized) return false;

  const roomDir = getRoomDir(sanitized);
  const docPath = getRoomDocPath(sanitized);
  const metaPath = getRoomMetaPath(sanitized);
  const legacyPath = getLegacyRoomFilePath(sanitized);

  if (fs.existsSync(docPath) || fs.existsSync(metaPath)) {
    return true;
  }
  if (fs.existsSync(roomDir)) {
    return true;
  }
  if (fs.existsSync(legacyPath)) {
    return true;
  }

  return false;
}

export function roomFileExists(roomId: string): boolean {
  return roomExists(roomId);
}

/**
 * Loads room metadata from meta.json if available.
 */
export function loadRoomMeta(roomId: string): RoomMetadata | null {
  const sanitized = sanitizeRoomId(roomId);
  migrateLegacyRoom(sanitized);
  const metaPath = getRoomMetaPath(sanitized);

  if (fs.existsSync(metaPath)) {
    try {
      const data = fs.readFileSync(metaPath, 'utf-8');
      return JSON.parse(data) as RoomMetadata;
    } catch (err) {
      console.error(`[Persistence] Failed to read meta.json for room ${sanitized}:`, err);
    }
  }

  // Fallback if room exists without meta.json
  if (roomExists(sanitized)) {
    let lang: SupportedLanguage = 'python';
    if (sanitized.startsWith('cpp-')) lang = 'cpp';
    else if (sanitized.startsWith('java-')) lang = 'java';

    return {
      id: sanitized,
      name: sanitized,
      language: lang,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };
  }

  return null;
}

/**
 * Saves or updates room metadata in meta.json.
 */
export function saveRoomMeta(roomId: string, meta: Partial<RoomMetadata> & { id: string }): void {
  const sanitized = sanitizeRoomId(roomId);
  ensureRoomDir(sanitized);

  const metaPath = getRoomMetaPath(sanitized);
  let existing: Partial<RoomMetadata> = {};

  if (fs.existsSync(metaPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch {
      existing = {};
    }
  }

  const updated: RoomMetadata = {
    id: sanitized,
    name: meta.name || existing.name || sanitized,
    language: meta.language || existing.language || 'python',
    createdAt: existing.createdAt || meta.createdAt || Date.now(),
    lastActiveAt: meta.lastActiveAt || existing.lastActiveAt || Date.now(),
    status: meta.status !== undefined ? meta.status : (existing.status || 'active'),
    closedAt: meta.closedAt !== undefined ? meta.closedAt : existing.closedAt,
  };

  const tempPath = `${metaPath}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(updated, null, 2), 'utf-8');
    fs.renameSync(tempPath, metaPath);
  } catch (err) {
    console.error(`[Persistence] Failed to save meta.json for room ${sanitized}:`, err);
  }
}

/**
 * Checks if a room is marked as closed/deleted.
 */
export function isRoomClosed(roomId: string): boolean {
  const meta = loadRoomMeta(roomId);
  return meta?.status === 'closed';
}

/**
 * Soft-deletes / closes a room by marking its status as 'closed' in meta.json.
 * Does NOT delete the underlying doc.bin, screenshots, or meta.json data.
 */
export function closeRoomMeta(roomId: string): boolean {
  const sanitized = sanitizeRoomId(roomId);
  if (!roomExists(sanitized)) return false;
  saveRoomMeta(sanitized, { id: sanitized, status: 'closed', closedAt: Date.now() });
  return true;
}

/**
 * Re-opens a closed room.
 */
export function reopenRoomMeta(roomId: string): boolean {
  const sanitized = sanitizeRoomId(roomId);
  if (!roomExists(sanitized)) return false;
  saveRoomMeta(sanitized, { id: sanitized, status: 'active', closedAt: undefined });
  return true;
}

/**
 * Loads Yjs room state from doc.bin.
 */
export function loadRoomState(roomId: string, ydoc: Y.Doc): boolean {
  const sanitized = sanitizeRoomId(roomId);
  migrateLegacyRoom(sanitized);

  const docPath = getRoomDocPath(sanitized);
  if (fs.existsSync(docPath)) {
    try {
      const buffer = fs.readFileSync(docPath);
      Y.applyUpdate(ydoc, new Uint8Array(buffer));

      // Sync metadata from meta.json if doc room-meta is missing fields
      const meta = loadRoomMeta(sanitized);
      if (meta) {
        const roomMeta = ydoc.getMap<any>('room-meta');
        if (!roomMeta.has('language') && meta.language) {
          roomMeta.set('language', meta.language);
        }
        if (!roomMeta.has('name') && meta.name) {
          roomMeta.set('name', meta.name);
        }
        if (!roomMeta.has('createdAt') && meta.createdAt) {
          roomMeta.set('createdAt', meta.createdAt);
        }
        roomMeta.set('lastActiveAt', meta.lastActiveAt || Date.now());
      }

      return true;
    } catch (err) {
      console.error(`[Persistence] Failed to load state for room ${sanitized}:`, err);
    }
  }
  return false;
}

/**
 * Saves Yjs room state to doc.bin and updates meta.json.
 */
export function saveRoomState(roomId: string, ydoc: Y.Doc): void {
  const sanitized = sanitizeRoomId(roomId);
  ensureRoomDir(sanitized);

  const docPath = getRoomDocPath(sanitized);
  try {
    const state = Y.encodeStateAsUpdate(ydoc);
    const tempPath = `${docPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, Buffer.from(state));
    fs.renameSync(tempPath, docPath);

    // Also persist metadata to meta.json
    const metaMap = ydoc.getMap<any>('room-meta');
    const meta: RoomMetadata = {
      id: sanitized,
      name: metaMap.get('name') || sanitized,
      language: (metaMap.get('language') as SupportedLanguage) || 'python',
      createdAt: metaMap.get('createdAt') || Date.now(),
      lastActiveAt: Date.now(),
    };
    saveRoomMeta(sanitized, meta);
  } catch (err) {
    console.error(`[Persistence] Failed to save state for room ${sanitized}:`, err);
  }
}

// Debounced savers map
const saveTimeouts = new Map<string, NodeJS.Timeout>();

export function debounceSaveRoomState(roomId: string, ydoc: Y.Doc, delayMs = 1000): void {
  const sanitized = sanitizeRoomId(roomId);
  const existing = saveTimeouts.get(sanitized);
  if (existing) {
    clearTimeout(existing);
  }

  const timeout = setTimeout(() => {
    saveRoomState(sanitized, ydoc);
    saveTimeouts.delete(sanitized);
  }, delayMs);

  saveTimeouts.set(sanitized, timeout);
}

export function flushAllSaves(docs: Map<string, Y.Doc>): void {
  for (const [roomId, timeout] of saveTimeouts.entries()) {
    clearTimeout(timeout);
    const doc = docs.get(roomId);
    if (doc) {
      saveRoomState(roomId, doc);
    }
  }
  saveTimeouts.clear();
}

/**
 * Lists all existing room IDs discovered on disk.
 */
export function listAllRoomIds(): string[] {
  ensureDataDir();
  const roomIds = new Set<string>();

  try {
    const entries = fs.readdirSync(getDataDir(), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      if (entry.isDirectory()) {
        const sanitized = sanitizeRoomId(entry.name);
        if (sanitized) {
          roomIds.add(sanitized);
        }
      } else if (entry.isFile() && entry.name.endsWith('.bin') && !entry.name.endsWith('.tmp')) {
        const rawId = entry.name.replace(/\.bin$/, '');
        const sanitized = sanitizeRoomId(rawId);
        if (sanitized) {
          roomIds.add(sanitized);
          // Trigger lazy migration
          migrateLegacyRoom(sanitized);
        }
      }
    }
  } catch (err) {
    console.error('[Persistence] Failed to list room directories:', err);
  }

  return Array.from(roomIds);
}

/**
 * Gets count of screenshots stored for a room.
 */
export function getScreenshotCount(roomId: string): number {
  const screenshotsDir = getRoomScreenshotsDir(roomId);
  if (!fs.existsSync(screenshotsDir)) {
    return 0;
  }

  try {
    const files = fs.readdirSync(screenshotsDir);
    return files.filter((f) => !f.startsWith('.') && /\.(webp|png|jpe?g)$/i.test(f)).length;
  } catch {
    return 0;
  }
}

/**
 * Lists all screenshots for a room, sorted by timestamp descending.
 */
export function listRoomScreenshots(roomId: string): ScreenshotMetadata[] {
  const sanitized = sanitizeRoomId(roomId);
  const screenshotsDir = getRoomScreenshotsDir(sanitized);

  if (!fs.existsSync(screenshotsDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(screenshotsDir);
    const screenshots: ScreenshotMetadata[] = [];

    for (const filename of files) {
      if (filename.startsWith('.')) continue;
      if (!/\.(webp|png|jpe?g)$/i.test(filename)) continue;

      const filePath = path.join(screenshotsDir, filename);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }

      // Format: <timestamp>_<triggerType>_<clientId>.<ext>
      const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
      const parts = nameWithoutExt.split('_');

      let timestamp = Math.floor(stat.mtimeMs || stat.ctimeMs || Date.now());
      let triggerType: TriggerType = 'scheduled';
      let clientId = 'agent';

      if (parts.length >= 3) {
        const parsedTs = parseInt(parts[0], 10);
        if (!isNaN(parsedTs)) {
          timestamp = parsedTs;
        }
        triggerType = parts[1].toLowerCase() === 'ondemand' || parts[1].toLowerCase() === 'instant' ? 'ondemand' : 'scheduled';
        clientId = parts.slice(2).join('_');
      } else if (parts.length === 2) {
        const parsedTs = parseInt(parts[0], 10);
        if (!isNaN(parsedTs)) {
          timestamp = parsedTs;
        }
        clientId = parts[1];
      } else {
        const match = filename.match(/\d{10,13}/);
        if (match) {
          timestamp = parseInt(match[0], 10);
        }
        if (filename.startsWith('instant-') || filename.includes('ondemand')) {
          triggerType = 'ondemand';
        }
      }

      screenshots.push({
        filename,
        url: `/api/rooms/${sanitized}/screenshots/${filename}`,
        roomId: sanitized,
        timestamp,
        triggerType,
        clientId,
        size: stat.size,
        createdAt: Math.floor(stat.birthtimeMs || stat.mtimeMs),
      });
    }

    screenshots.sort((a, b) => b.timestamp - a.timestamp);
    return screenshots;
  } catch (err) {
    console.error(`[Persistence] Failed to list screenshots for room ${sanitized}:`, err);
    return [];
  }
}

export function saveScreenshotFile(
  roomId: string,
  buffer: Buffer,
  triggerType: TriggerType = 'scheduled',
  timestamp = Date.now(),
  clientId = 'agent',
  deviceName?: string
): ScreenshotMetadata {
  const sanitized = sanitizeRoomId(roomId);
  ensureRoomDir(sanitized);
  const dir = getRoomScreenshotsDir(sanitized);
  const ext = 'webp';
  const filename = `${timestamp}_${triggerType}_${clientId}.${ext}`;
  const filePath = path.join(dir, filename);

  fs.writeFileSync(filePath, buffer);
  const stat = fs.statSync(filePath);

  return {
    filename,
    url: `/api/rooms/${sanitized}/screenshots/${filename}`,
    roomId: sanitized,
    timestamp,
    triggerType,
    clientId,
    deviceName,
    size: stat.size,
    createdAt: Math.floor(stat.birthtimeMs || stat.mtimeMs),
  };
}

export function getScreenshotFilePath(roomId: string, filename: string): string {
  const sanitizedRoom = sanitizeRoomId(roomId);
  const sanitizedFile = path.basename(filename);
  return path.join(getDataDir(), sanitizedRoom, 'screenshots', sanitizedFile);
}

export function ensureRoomScreenshotsDir(roomId: string): string {
  const sanitized = sanitizeRoomId(roomId);
  ensureRoomDir(sanitized);
  return getRoomScreenshotsDir(sanitized);
}

/**
 * Lists all unassigned screenshots stored in ./data/unassigned/screenshots, sorted by timestamp descending.
 */
export function listUnassignedScreenshots(): ScreenshotMetadata[] {
  ensureUnassignedDir();
  const dir = getUnassignedScreenshotsDir();

  if (!fs.existsSync(dir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(dir);
    const screenshots: ScreenshotMetadata[] = [];

    for (const filename of files) {
      if (filename.startsWith('.')) continue;
      if (!/\.(webp|png|jpe?g)$/i.test(filename)) continue;

      const filePath = path.join(dir, filename);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }

      // Format: <timestamp>_<triggerType>_<clientId>.<ext>
      const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
      const parts = nameWithoutExt.split('_');

      let timestamp = Math.floor(stat.mtimeMs || stat.ctimeMs || Date.now());
      let triggerType: TriggerType = 'initial';
      let clientId = 'agent';

      if (parts.length >= 3) {
        const parsedTs = parseInt(parts[0], 10);
        if (!isNaN(parsedTs)) {
          timestamp = parsedTs;
        }
        const rawTrigger = parts[1].toLowerCase();
        if (rawTrigger === 'ondemand' || rawTrigger === 'instant') triggerType = 'ondemand';
        else if (rawTrigger === 'scheduled' || rawTrigger === 'interval') triggerType = 'scheduled';
        else if (rawTrigger === 'manual') triggerType = 'manual';
        else triggerType = 'initial';

        clientId = parts.slice(2).join('_');
      } else if (parts.length === 2) {
        const parsedTs = parseInt(parts[0], 10);
        if (!isNaN(parsedTs)) {
          timestamp = parsedTs;
        }
        clientId = parts[1];
      } else {
        const match = filename.match(/\d{10,13}/);
        if (match) {
          timestamp = parseInt(match[0], 10);
        }
      }

      screenshots.push({
        filename,
        url: `/api/unassigned/screenshots/${filename}`,
        timestamp,
        triggerType,
        clientId,
        size: stat.size,
        createdAt: Math.floor(stat.birthtimeMs || stat.mtimeMs),
      });
    }

    screenshots.sort((a, b) => b.timestamp - a.timestamp);
    return screenshots;
  } catch (err) {
    console.error('[Persistence] Failed to list unassigned screenshots:', err);
    return [];
  }
}

/**
 * Saves an unassigned screenshot file to ./data/unassigned/screenshots.
 */
export function saveUnassignedScreenshotFile(
  buffer: Buffer,
  triggerType: TriggerType = 'initial',
  timestamp = Date.now(),
  clientId = 'agent',
  deviceName?: string,
  ext: string = 'webp'
): ScreenshotMetadata {
  ensureUnassignedDir();
  const dir = getUnassignedScreenshotsDir();
  const cleanExt = ext.replace(/^\./, '') || 'webp';
  const filename = `${timestamp}_${triggerType}_${clientId}.${cleanExt}`;
  const filePath = path.join(dir, filename);

  fs.writeFileSync(filePath, buffer);
  const stat = fs.statSync(filePath);

  return {
    filename,
    url: `/api/unassigned/screenshots/${filename}`,
    timestamp,
    triggerType,
    clientId,
    deviceName,
    size: stat.size,
    createdAt: Math.floor(stat.birthtimeMs || stat.mtimeMs),
  };
}

export function getUnassignedScreenshotFilePath(filename: string): string {
  const sanitizedFile = path.basename(filename);
  return path.join(getUnassignedScreenshotsDir(), sanitizedFile);
}

export function getUnassignedScreenshotCount(): number {
  const dir = getUnassignedScreenshotsDir();
  if (!fs.existsSync(dir)) return 0;
  try {
    const files = fs.readdirSync(dir);
    return files.filter((f) => !f.startsWith('.') && /\.(webp|png|jpe?g)$/i.test(f)).length;
  } catch {
    return 0;
  }
}

export const getAllRoomIds = listAllRoomIds;
