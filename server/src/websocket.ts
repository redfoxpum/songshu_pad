import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import * as Y from 'yjs';
import { createRequire } from 'module';
import {
  ensureDataDir,
  loadRoomState,
  saveRoomState,
  debounceSaveRoomState,
  sanitizeRoomId,
  isRoomClosed,
} from './persistence.js';
import { DEFAULT_TEMPLATES } from './templates.js';
import { SupportedLanguage } from './types.js';
import { commandGateway } from './commandGateway.js';

const getRequire = () => {
  if (typeof require !== 'undefined') return require;
  return createRequire(import.meta?.url || 'file://');
};
const utils = getRequire()('y-websocket/bin/utils');

export function initWebSocketServer(wss: WebSocketServer): void {
  ensureDataDir();

  // Configure Yjs persistence with y-websocket utils
  utils.setPersistence({
    bindState: async (docName: string, ydoc: Y.Doc) => {
      const sanitized = sanitizeRoomId(docName);
      const loaded = loadRoomState(sanitized, ydoc);
      const roomMeta = ydoc.getMap<any>('room-meta');
      const yText = ydoc.getText('codemirror');

      if (!loaded) {
        // Determine language from docName slug if possible, else default to python
        let lang: SupportedLanguage = 'python';
        if (sanitized.startsWith('cpp-')) lang = 'cpp';
        else if (sanitized.startsWith('java-')) lang = 'java';
        else if (sanitized.startsWith('python-')) lang = 'python';

        ydoc.transact(() => {
          if (yText.length === 0) {
            const template = DEFAULT_TEMPLATES[lang] || DEFAULT_TEMPLATES.python;
            yText.insert(0, template);
          }
          if (!roomMeta.has('language')) {
            roomMeta.set('language', lang);
          }
          if (!roomMeta.has('id')) {
            roomMeta.set('id', sanitized);
          }
          if (!roomMeta.has('createdAt')) {
            roomMeta.set('createdAt', Date.now());
          }
          roomMeta.set('lastActiveAt', Date.now());
        });

        saveRoomState(sanitized, ydoc);
      }

      ydoc.on('update', () => {
        debounceSaveRoomState(sanitized, ydoc);
      });
    },
    writeState: async (docName: string, ydoc: Y.Doc) => {
      const sanitized = sanitizeRoomId(docName);
      saveRoomState(sanitized, ydoc);
    },
  });

  wss.on('connection', (conn: WebSocket, req: IncomingMessage) => {
    try {
      const url = req.url || '';
      const parsedUrl = new URL(url, 'http://localhost');
      const pathname = parsedUrl.pathname;

      // 1. Check if WebSocket connection is for the Command Gateway (/ws/control or /ws/agent)
      if (
        pathname.startsWith('/ws/control') ||
        pathname.startsWith('/ws/agent') ||
        pathname === '/ws/control' ||
        pathname === '/ws/agent'
      ) {
        commandGateway.handleConnection(conn, req);
        return;
      }

      // 2. Otherwise handle as Yjs Real-Time Collaboration WebSocket (/ws/:roomId or /ws?room=:roomId)
      let docName = '';
      if (parsedUrl.searchParams.has('room')) {
        docName = parsedUrl.searchParams.get('room') || '';
      } else {
        const pathPart = pathname.replace(/^\/ws\/?/, '/').replace(/^\//, '');
        docName = pathPart.split('/')[0] || '';
      }

      if (!docName) {
        docName = 'default-room';
      }

      // Sanitize docName
      docName = sanitizeRoomId(docName);

      // Check if room is closed by host
      if (isRoomClosed(docName)) {
        console.warn(`[WebSocket] Rejecting connection to closed room: ${docName}`);
        try {
          conn.close(4404, 'Room has been closed by host');
        } catch {}
        return;
      }

      utils.setupWSConnection(conn, req, { docName });
    } catch (err) {
      console.error('[WebSocket] Error setting up connection:', err);
      conn.close();
    }
  });
}

export function disconnectRoom(roomId: string): void {
  const sanitized = sanitizeRoomId(roomId);
  const yDoc = utils.docs.get(sanitized);
  if (yDoc && yDoc.conns) {
    for (const [conn] of yDoc.conns) {
      try {
        conn.close(4404, 'Room closed by host');
      } catch {}
    }
  }
  utils.docs.delete(sanitized);
  commandGateway.disconnectRoomAgents(sanitized);
}

export function getYDoc(roomId: string): Y.Doc {
  const sanitized = sanitizeRoomId(roomId);
  return utils.getYDoc(sanitized);
}

export function getAllLoadedDocs(): Map<string, Y.Doc> {
  return utils.docs;
}

export function getOnlineClientCount(roomId: string): number {
  const sanitized = sanitizeRoomId(roomId);
  const yDoc = utils.docs.get(sanitized);
  const yConns = yDoc?.conns ? (yDoc.conns.size as number) : 0;
  const agentCount = commandGateway.getActiveAgentCount(sanitized);
  const hostCount = commandGateway.getHostCount(sanitized);
  return yConns + agentCount + hostCount;
}


