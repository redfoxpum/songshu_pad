import { RoomItem, ScreenshotInfo, CandidateAgentStatus, SupportedLanguage } from '../types';

const BASE_URL = 'http://127.0.0.1:3000';

export async function fetchRooms(): Promise<RoomItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/rooms`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.rooms || [];
  } catch (err) {
    console.warn('[API] Error fetching rooms:', err);
    return [];
  }
}

export async function createRoom(language: SupportedLanguage, name?: string): Promise<RoomItem> {
  const res = await fetch(`${BASE_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, name }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error ${res.status}`);
  }
  return await res.json();
}

export async function fetchRoom(roomId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/rooms/${roomId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function fetchScreenshots(roomId: string): Promise<ScreenshotInfo[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/screenshots`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.screenshots || [];
  } catch (err) {
    console.warn('[API] Error fetching screenshots:', err);
    return [];
  }
}

export async function triggerCapture(
  roomId: string
): Promise<{ success: boolean; message?: string; screenshot?: ScreenshotInfo; agentConnected?: boolean }> {
  try {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 404) {
      return {
        success: false,
        message: data.message || '当前房间暂无在线的桌面监控端',
        agentConnected: false,
      };
    }
    if (!res.ok) {
      return {
        success: false,
        message: data.message || `请求失败 (HTTP ${res.status})`,
        agentConnected: false,
      };
    }
    return {
      success: true,
      message: data.message || '即时截屏已成功抓取并存入时间线',
      screenshot: data.screenshot
        ? {
            filename: data.screenshot.filename,
            url: data.screenshot.url,
            roomId: data.screenshot.roomId,
            timestamp: data.screenshot.timestamp,
            type:
              data.screenshot.triggerType === 'ondemand' || data.screenshot.triggerType === 'instant'
                ? 'instant'
                : 'interval',
            sizeBytes: data.screenshot.size || 0,
            formattedTime: new Date(data.screenshot.timestamp).toLocaleTimeString('zh-CN'),
          }
        : undefined,
      agentConnected: true,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || '网络请求失败',
      agentConnected: false,
    };
  }
}


export async function deleteScreenshot(roomId: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/screenshots/${filename}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteRoom(roomId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    return {
      success: res.ok,
      message: data.message || (res.ok ? '房间已彻底删除' : '删除房间失败'),
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || '网络请求失败',
    };
  }
}

export async function bulkDeleteRooms(
  roomIds: string[]
): Promise<{ success: boolean; deletedCount: number; deletedIds: string[]; message?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/rooms/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomIds }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP error ${res.status}`);
    }
    return {
      success: data.success ?? true,
      deletedCount: data.deletedCount ?? 0,
      deletedIds: data.deletedIds ?? [],
      message: data.message,
    };
  } catch (err: any) {
    // Fallback: iterate over rooms individually
    let successCount = 0;
    const deletedIds: string[] = [];
    for (const id of roomIds) {
      const r = await deleteRoom(id);
      if (r.success) {
        successCount++;
        deletedIds.push(id);
      }
    }
    return {
      success: successCount > 0,
      deletedCount: successCount,
      deletedIds,
      message: err.message,
    };
  }
}

// Backward-compatible aliases
export const closeRoom = deleteRoom;
export const bulkCloseRooms = async (roomIds: string[]) => {
  const res = await bulkDeleteRooms(roomIds);
  return {
    ...res,
    closedCount: res.deletedCount,
    closedIds: res.deletedIds,
  };
};

export async function reopenRoom(roomId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/reopen`, {
      method: 'POST',
    });
    const data = await res.json().catch(() => ({}));
    return {
      success: res.ok,
      message: data.message || (res.ok ? '房间已重新开启' : '重新开启失败'),
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || '网络请求失败',
    };
  }
}

export async function fetchAgentStatus(roomId: string): Promise<CandidateAgentStatus | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/agent`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 10) return '刚刚';
  if (diffSec < 60) return `${diffSec} 秒前`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
