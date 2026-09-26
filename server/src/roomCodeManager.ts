import fs from 'fs';
import path from 'path';
import { ensureRoomDir, getRoomDir, sanitizeRoomId, loadRoomMeta, saveRoomMeta } from './persistence.js';
import { DEFAULT_TEMPLATES } from './templates.js';
import { SupportedLanguage } from './types.js';

export interface RoomCodeState {
  roomId: string;
  code: string;
  language: SupportedLanguage;
  version: number;
  updatedAt: number;
  lastUpdatedBy?: string;
  clientId?: string;
}

type UpdateListener = (state: RoomCodeState) => void;

class RoomCodeManager {
  private cache = new Map<string, RoomCodeState>();
  private listeners = new Map<string, Set<UpdateListener>>();

  private getCodeFilePath(roomId: string): string {
    const sanitized = sanitizeRoomId(roomId);
    return path.join(getRoomDir(sanitized), 'code.txt');
  }

  /**
   * Loads or gets the current room code state
   */
  public getRoomCodeState(roomId: string): RoomCodeState {
    const sanitized = sanitizeRoomId(roomId);
    const cached = this.cache.get(sanitized);
    if (cached) {
      return cached;
    }

    ensureRoomDir(sanitized);
    const filePath = this.getCodeFilePath(sanitized);
    const meta = loadRoomMeta(sanitized);
    const language: SupportedLanguage = (meta?.language as SupportedLanguage) || 'python';

    let code = '';
    if (fs.existsSync(filePath)) {
      try {
        code = fs.readFileSync(filePath, 'utf-8');
      } catch {
        code = '';
      }
    }

    if (!code) {
      code = DEFAULT_TEMPLATES[language] || DEFAULT_TEMPLATES.python;
      try {
        fs.writeFileSync(filePath, code, 'utf-8');
      } catch {}
    }

    const state: RoomCodeState = {
      roomId: sanitized,
      code,
      language,
      version: 1,
      updatedAt: Date.now(),
      lastUpdatedBy: 'System',
    };

    this.cache.set(sanitized, state);
    return state;
  }

  /**
   * Updates room code state, persists to disk, and notifies all waiting long-poll listeners
   */
  public updateRoomCode(
    roomId: string,
    code: string,
    language?: SupportedLanguage,
    clientId?: string,
    author?: string
  ): RoomCodeState {
    const sanitized = sanitizeRoomId(roomId);
    const current = this.getRoomCodeState(sanitized);

    const nextLang = language && ['python', 'cpp', 'java'].includes(language) ? language : current.language;
    const isCodeChanged = current.code !== code;
    const isLangChanged = current.language !== nextLang;

    if (!isCodeChanged && !isLangChanged) {
      return current;
    }

    const nextState: RoomCodeState = {
      roomId: sanitized,
      code,
      language: nextLang,
      version: current.version + 1,
      updatedAt: Date.now(),
      clientId,
      lastUpdatedBy: author || clientId || 'Anonymous',
    };

    this.cache.set(sanitized, nextState);

    // Save to disk asynchronously
    try {
      const filePath = this.getCodeFilePath(sanitized);
      fs.writeFileSync(filePath, code, 'utf-8');
      saveRoomMeta(sanitized, { id: sanitized, language: nextLang, lastActiveAt: Date.now() });
    } catch (err) {
      console.error(`[RoomCodeManager] Failed to persist code for ${sanitized}:`, err);
    }

    // Notify all waiting long-poll listeners
    const roomListeners = this.listeners.get(sanitized);
    if (roomListeners && roomListeners.size > 0) {
      for (const listener of roomListeners) {
        try {
          listener(nextState);
        } catch (e) {}
      }
      roomListeners.clear();
    }

    return nextState;
  }

  /**
   * Long-polling wait for update
   */
  public async waitForUpdate(
    roomId: string,
    sinceVersion: number,
    timeoutMs = 10000
  ): Promise<RoomCodeState> {
    const sanitized = sanitizeRoomId(roomId);
    const current = this.getRoomCodeState(sanitized);

    if (current.version > sinceVersion) {
      return current;
    }

    return new Promise<RoomCodeState>((resolve) => {
      let resolved = false;

      const listener: UpdateListener = (updatedState) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(updatedState);
        }
      };

      if (!this.listeners.has(sanitized)) {
        this.listeners.set(sanitized, new Set());
      }
      this.listeners.get(sanitized)!.add(listener);

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          const set = this.listeners.get(sanitized);
          if (set) {
            set.delete(listener);
          }
          resolve(this.getRoomCodeState(sanitized));
        }
      }, Math.max(500, Math.min(30000, timeoutMs)));
    });
  }
}

export const roomCodeManager = new RoomCodeManager();
