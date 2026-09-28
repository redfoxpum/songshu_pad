import { ipcMain, BrowserWindow, app } from 'electron';
import { checkScreenRecordingPermission, openScreenPermissionSettings } from './permissions.js';
import {
  toggleClickThrough,
  setClickThroughState,
  getClickThroughState,
  toggleWindowVisibility,
  adjustOpacity,
  adjustWindowHeight,
  scrollPage,
} from './shortcuts.js';
import { agentService } from './agentService.js';
import { ConnectionConfig } from '../types/ipc.js';
import { getMainWindow } from './window.js';

export function setupIpcHandlers(_initialWindow?: BrowserWindow | null) {
  // Screen recording permissions
  ipcMain.handle('check-screen-permission', async () => {
    return checkScreenRecordingPermission();
  });

  ipcMain.handle('open-screen-permission-settings', async () => {
    return openScreenPermissionSettings();
  });

  // Agent connection
  ipcMain.handle('connect-agent', async (_event, config: ConnectionConfig) => {
    return agentService.connect(config);
  });

  ipcMain.handle('disconnect-agent', async () => {
    agentService.disconnect();
    return { success: true };
  });

  ipcMain.handle('get-agent-status', async () => {
    return agentService.getStatus();
  });

  ipcMain.handle('trigger-manual-capture', async () => {
    return agentService.triggerManualCapture();
  });

  ipcMain.handle('capture-and-upload-initial', async (_event, serverUrl?: string) => {
    return agentService.captureAndUploadInitial(serverUrl);
  });

  // REST Code Synchronization Handlers (Node.js fetch runs without CORS/sandbox limitations)
  ipcMain.handle(
    'fetch-room-code',
    async (
      _event,
      {
        serverUrl,
        roomId,
        sinceVersion,
        waitMs,
      }: { serverUrl: string; roomId: string; sinceVersion?: number; waitMs?: number }
    ) => {
      try {
        const cleanServer = (serverUrl || 'http://localhost:3000').trim().replace(/\/+$/, '');
        let url = `${cleanServer}/api/rooms/${encodeURIComponent(roomId)}/code`;
        const params = new URLSearchParams();
        if (sinceVersion !== undefined && sinceVersion >= 0) {
          params.append('sinceVersion', String(sinceVersion));
        }
        if (waitMs !== undefined && waitMs > 0) {
          params.append('waitMs', String(waitMs));
        }
        const qs = params.toString();
        if (qs) {
          url += `?${qs}`;
        }

        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) {
          return { success: false, error: `HTTP ${res.status} ${res.statusText}` };
        }
        const data = await res.json();
        return data;
      } catch (err: any) {
        return { success: false, error: err.message || 'Fetch room code failed' };
      }
    }
  );

  ipcMain.handle(
    'push-room-code',
    async (
      _event,
      {
        serverUrl,
        roomId,
        payload,
      }: {
        serverUrl: string;
        roomId: string;
        payload: { code: string; language?: string; clientId?: string; author?: string };
      }
    ) => {
      try {
        const cleanServer = (serverUrl || 'http://localhost:3000').trim().replace(/\/+$/, '');
        const url = `${cleanServer}/api/rooms/${encodeURIComponent(roomId)}/code`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          return { success: false, error: `HTTP ${res.status} ${res.statusText}` };
        }
        const data = await res.json();
        return data;
      } catch (err: any) {
        return { success: false, error: err.message || 'Push room code failed' };
      }
    }
  );

  // Click-through toggling
  ipcMain.handle('toggle-click-through', async () => {
    return toggleClickThrough(getMainWindow());
  });

  ipcMain.handle('set-click-through', async (_event, enabled: boolean) => {
    return setClickThroughState(getMainWindow(), enabled);
  });

  // Window visibility toggling (Cmd+H / Ctrl+H)
  ipcMain.handle('toggle-window-visibility', async () => {
    return toggleWindowVisibility(getMainWindow());
  });

  // Opacity adjustment delta (Cmd+[ / Cmd+])
  ipcMain.handle('adjust-window-opacity', async (_event, delta: number) => {
    adjustOpacity(delta, getMainWindow());
  });

  // Window height adjustment (Cmd+= / Cmd+-)
  ipcMain.handle('adjust-window-height', async (_event, delta: number) => {
    adjustWindowHeight(delta, getMainWindow());
  });

  // Half-page scroll (Cmd+Down / Cmd+Up)
  ipcMain.handle('scroll-page', async (_event, direction: 'down' | 'up') => {
    scrollPage(direction, getMainWindow());
  });

  // Window properties (Native window stays at full opacity 1.0, transparency is handled in web background)
  ipcMain.handle('set-window-opacity', async (_event, _opacity: number) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(1.0);
    }
  });

  ipcMain.handle('set-window-size', async (_event, width: number, height: number) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setSize(Math.round(Math.max(280, width)), Math.round(Math.max(40, height)), true);
    }
  });

  ipcMain.handle('get-window-size', async () => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      return mainWindow.getSize();
    }
    return [620, 480];
  });

  ipcMain.handle('set-content-protection', async (_event, enabled: boolean) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.setContentProtection(enabled);
        return true;
      } catch (err) {
        console.error('[Window] Failed to setContentProtection:', err);
        return false;
      }
    }
    return false;
  });

  ipcMain.handle('minimize-window', async () => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (process.platform === 'win32') {
        mainWindow.hide();
      } else {
        mainWindow.minimize();
      }
    }
  });

  ipcMain.handle('close-window', async () => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
    app.quit();
  });

  // Wire up AgentService callbacks to push events to Renderer
  agentService.setCallbacks(
    (status) => {
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agent:status-update', status);
      }
    },
    (data) => {
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agent:ondemand-trigger', data);
      }
    },
    (result) => {
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agent:capture-completed', result);
      }
    }
  );
}

export function notifyClickThroughChanged(window: BrowserWindow | null, enabled: boolean) {
  const mainWindow = window || getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent:click-through-toggled', enabled);
    // Also push a full status update
    mainWindow.webContents.send('agent:status-update', agentService.getStatus());
  }
}

