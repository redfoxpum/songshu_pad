import * as Y from 'yjs';
import { SupportedLanguage, RoomMetadata, RoomListItem, RoomInfoResponse, ScreenshotMetadata } from './types.js';
import { DEFAULT_TEMPLATES } from './templates.js';
import { generateRoomId, generateRoomSlug } from './slug.js';
import {
  ensureDataDir,
  ensureRoomDir,
  roomExists,
  loadRoomState,
  saveRoomState,
  debounceSaveRoomState,
  loadRoomMeta,
  saveRoomMeta,
  listAllRoomIds,
  getScreenshotCount,
  listRoomScreenshots,
  sanitizeRoomId,
  isRoomClosed,
  closeRoomMeta,
  reopenRoomMeta,
} from './persistence.js';
import { getYDoc, getAllLoadedDocs, disconnectRoom } from './websocket.js';

export class RoomManager {
  constructor() {
    ensureDataDir();
  }

  public getOrCreateDoc(roomId: string, initialLanguage: SupportedLanguage = 'python', initialName?: string): Y.Doc {
    const sanitized = sanitizeRoomId(roomId);
    ensureRoomDir(sanitized);

    const doc = getYDoc(sanitized);
    const roomMeta = doc.getMap<any>('room-meta');
    const yText = doc.getText('codemirror');

    doc.transact(() => {
      if (initialLanguage) {
        roomMeta.set('language', initialLanguage);
      }
      if (yText.length === 0) {
        const template = DEFAULT_TEMPLATES[initialLanguage] || DEFAULT_TEMPLATES.python;
        yText.insert(0, template);
      }
      if (!roomMeta.has('id')) {
        roomMeta.set('id', sanitized);
      }
      if (!roomMeta.has('name')) {
        roomMeta.set('name', initialName || sanitized);
      }
      if (!roomMeta.has('createdAt')) {
        roomMeta.set('createdAt', Date.now());
      }
      roomMeta.set('lastActiveAt', Date.now());
      roomMeta.set('status', 'active');
    });

    saveRoomState(sanitized, doc);
    return doc;
  }

  public createRoom(language: SupportedLanguage = 'python', customName?: string): RoomMetadata {
    let roomId = generateRoomId();
    let attempts = 0;
    while ((getAllLoadedDocs().has(roomId) || roomExists(roomId)) && attempts < 10) {
      roomId = generateRoomId();
      attempts++;
    }

    const doc = this.getOrCreateDoc(roomId, language, customName);
    const meta = doc.getMap<any>('room-meta');

    return {
      id: roomId,
      name: meta.get('name') || customName || roomId,
      language: (meta.get('language') as SupportedLanguage) || language,
      createdAt: meta.get('createdAt') || Date.now(),
      lastActiveAt: meta.get('lastActiveAt') || Date.now(),
      status: 'active',
    };
  }

  public getRoomInfo(roomId: string, onlineClients = 0, includeClosed = false): RoomInfoResponse | null {
    const sanitized = sanitizeRoomId(roomId);
    const loadedDocs = getAllLoadedDocs();
    if (!loadedDocs.has(sanitized) && !roomExists(sanitized)) {
      return null;
    }

    const diskMeta = loadRoomMeta(sanitized);
    const status = diskMeta?.status || 'active';
    const screenshotCount = getScreenshotCount(sanitized);

    if (!includeClosed && status === 'closed') {
      return {
        id: sanitized,
        name: diskMeta?.name || sanitized,
        language: diskMeta?.language || 'python',
        createdAt: diskMeta?.createdAt || Date.now(),
        lastActiveAt: diskMeta?.lastActiveAt || Date.now(),
        status: 'closed',
        closedAt: diskMeta?.closedAt,
        exists: false,
        screenshotCount,
        onlineClients: 0,
      };
    }

    let language: SupportedLanguage = diskMeta?.language || 'python';
    let name: string = diskMeta?.name || sanitized;
    let createdAt = diskMeta?.createdAt || Date.now();
    let lastActiveAt = diskMeta?.lastActiveAt || Date.now();

    if (loadedDocs.has(sanitized)) {
      const doc = loadedDocs.get(sanitized)!;
      const meta = doc.getMap<any>('room-meta');
      language = (meta.get('language') as SupportedLanguage) || language;
      name = meta.get('name') || name;
      createdAt = meta.get('createdAt') || createdAt;
      lastActiveAt = meta.get('lastActiveAt') || lastActiveAt;
    }

    return {
      id: sanitized,
      name,
      language,
      createdAt,
      lastActiveAt,
      status,
      closedAt: diskMeta?.closedAt,
      exists: status !== 'closed',
      screenshotCount,
      onlineClients,
    };
  }

  public getAllRooms(onlineClientsResolver?: (roomId: string) => number, includeClosed = true): RoomListItem[] {
    const loadedDocs = getAllLoadedDocs();
    const allIds = new Set<string>([...listAllRoomIds(), ...loadedDocs.keys()]);
    const results: RoomListItem[] = [];

    for (const roomId of allIds) {
      const sanitized = sanitizeRoomId(roomId);
      if (!sanitized) continue;

      let meta: RoomMetadata | null = null;
      const loadedDoc = loadedDocs.get(sanitized);
      if (loadedDoc) {
        const docMeta = loadedDoc.getMap<any>('room-meta');
        meta = {
          id: sanitized,
          name: docMeta.get('name') || sanitized,
          language: (docMeta.get('language') as SupportedLanguage) || 'python',
          createdAt: docMeta.get('createdAt') || Date.now(),
          lastActiveAt: docMeta.get('lastActiveAt') || Date.now(),
          status: docMeta.get('status') || 'active',
        };
      } else {
        meta = loadRoomMeta(sanitized);
      }

      if (!meta) {
        meta = {
          id: sanitized,
          name: sanitized,
          language: 'python',
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
          status: 'active',
        };
      }

      const status = meta.status || 'active';
      if (!includeClosed && status === 'closed') {
        continue;
      }

      const screenshotCount = getScreenshotCount(sanitized);
      const onlineClients = onlineClientsResolver ? onlineClientsResolver(sanitized) : 0;

      results.push({
        id: meta.id,
        name: meta.name || meta.id,
        language: meta.language,
        createdAt: meta.createdAt,
        lastActiveAt: meta.lastActiveAt,
        status,
        closedAt: meta.closedAt,
        screenshotCount,
        onlineClients,
      });
    }

    // Sort active rooms first, then by lastActiveAt descending, fallback to createdAt descending
    results.sort((a, b) => {
      const statusA = a.status === 'closed' ? 1 : 0;
      const statusB = b.status === 'closed' ? 1 : 0;
      if (statusA !== statusB) return statusA - statusB;
      return (b.lastActiveAt || b.createdAt) - (a.lastActiveAt || a.createdAt);
    });
    return results;
  }

  public closeRoom(roomId: string): boolean {
    const sanitized = sanitizeRoomId(roomId);
    const loadedDocs = getAllLoadedDocs();
    if (!loadedDocs.has(sanitized) && !roomExists(sanitized)) {
      return false;
    }

    const doc = loadedDocs.get(sanitized);
    if (doc) {
      saveRoomState(sanitized, doc);
    }

    closeRoomMeta(sanitized);
    disconnectRoom(sanitized);
    return true;
  }

  public bulkCloseRooms(roomIds: string[]): {
    success: boolean;
    closedCount: number;
    closedIds: string[];
    failedIds: string[];
  } {
    const closedIds: string[] = [];
    const failedIds: string[] = [];

    for (const rawId of roomIds) {
      const id = sanitizeRoomId(rawId);
      if (!id) {
        failedIds.push(rawId);
        continue;
      }
      const ok = this.closeRoom(id);
      if (ok) {
        closedIds.push(id);
      } else {
        failedIds.push(id);
      }
    }

    return {
      success: true,
      closedCount: closedIds.length,
      closedIds,
      failedIds,
    };
  }

  public reopenRoom(roomId: string): boolean {
    const sanitized = sanitizeRoomId(roomId);
    if (!roomExists(sanitized)) {
      return false;
    }
    return reopenRoomMeta(sanitized);
  }

  public isClosed(roomId: string): boolean {
    return isRoomClosed(roomId);
  }

  public getRoomScreenshots(roomId: string): ScreenshotMetadata[] {
    const sanitized = sanitizeRoomId(roomId);
    return listRoomScreenshots(sanitized);
  }

  public getAllDocs(): Map<string, Y.Doc> {
    return getAllLoadedDocs();
  }
}

export const roomManager = new RoomManager();

