import { RecentRoom, SupportedLanguage } from '../types';

const RECENT_ROOMS_KEY = 'coderpad_recent_rooms';
const MAX_RECENT_ROOMS = 10;

export function getRecentRooms(): RecentRoom[] {
  try {
    const raw = localStorage.getItem(RECENT_ROOMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse recent rooms:', e);
  }
  return [];
}

export function saveRecentRoom(room: { id: string; name?: string; language?: SupportedLanguage }): void {
  try {
    const list = getRecentRooms();
    const updated = list.filter((r) => r.id !== room.id);
    const item: RecentRoom = {
      id: room.id,
      name: room.name || room.id,
      language: room.language || 'python',
      visitedAt: Date.now(),
    };
    updated.unshift(item);
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(updated.slice(0, MAX_RECENT_ROOMS)));
  } catch (e) {
    console.error('Failed to save recent room:', e);
  }
}

export function removeRecentRoom(id: string): RecentRoom[] {
  try {
    const list = getRecentRooms().filter((r) => r.id !== id);
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.error('Failed to remove recent room:', e);
    return [];
  }
}

export function clearRecentRooms(): void {
  localStorage.removeItem(RECENT_ROOMS_KEY);
}
