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
import { disconnectRoom } from './websocket.js';

export class RoomManager {
  private docs = new Map<string, Y.Doc>();

  constructor() {
    ensureDataDir();
  }

  public getOrCreateDoc(roomId: string, initialLanguage: SupportedLanguage = 'python', initialName?: string): Y.Doc {
    const sanitized = sanitizeRoomId(roomId);
    let doc = this.docs.get(sanitized);
    if (doc) {
      return doc;
    }

    // Ensure room and screenshots directory exist
    ensureRoomDir(sanitized);

    doc = new Y.Doc();
    const loaded = loadRoomState(sanitized, doc);

    const roomMeta = doc.getMap<any>('room-meta');
    const yText = doc.getText('codemirror');

    if (!loaded) {
      // Initialize new room content and metadata
      doc.transact(() => {
        const template = DEFAULT_TEMPLATES[initialLanguage] || DEFAULT_TEMPLATES.python;
        if (yText.length === 0) {
          yText.insert(0, template);
        }
        if (!roomMeta.has('language')) {
          roomMeta.set('language', initialLanguage);
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

      // Save initial state to disk
      saveRoomState(sanitized, doc);
    }

    // Attach persistence update listener
    doc.on('update', () => {
      debounceSaveRoomState(sanitized, doc!);
    });

    this.docs.set(sanitized, doc);
    return doc;
  }

  public createRoom(language: SupportedLanguage = 'python', customName?: string): RoomMetadata {
    let roomId = generateRoomId();
    let attempts = 0;
    while ((this.docs.has(roomId) || roomExists(roomId)) && attempts < 10) {
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
    if (!this.docs.has(sanitized) && !roomExists(sanitized)) {
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

    if (this.docs.has(sanitized)) {
      const doc = this.docs.get(sanitized)!;
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
    const allIds = new Set<string>([...listAllRoomIds(), ...this.docs.keys()]);
    const results: RoomListItem[] = [];

    for (const roomId of allIds) {
      const sanitized = sanitizeRoomId(roomId);
      if (!sanitized) continue;

      let meta: RoomMetadata | null = null;
      const loadedDoc = this.docs.get(sanitized);
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
    if (!this.docs.has(sanitized) && !roomExists(sanitized)) {
      return false;
    }

    const doc = this.docs.get(sanitized);
    if (doc) {
      saveRoomState(sanitized, doc);
      this.docs.delete(sanitized);
    }

    closeRoomMeta(sanitized);
    disconnectRoom(sanitized);
    return true;
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
    return this.docs;
  }
}

export const roomManager = new RoomManager();

