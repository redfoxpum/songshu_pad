import { ipcMain, BrowserWindow, app } from 'electron';
import { checkScreenRecordingPermission, openScreenPermissionSettings } from './permissions.js';
import { toggleClickThrough, setClickThroughState, getClickThroughState } from './shortcuts.js';
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

  // Click-through toggling
  ipcMain.handle('toggle-click-through', async () => {
    return toggleClickThrough(getMainWindow());
  });

  ipcMain.handle('set-click-through', async (_event, enabled: boolean) => {
    return setClickThroughState(getMainWindow(), enabled);
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
      mainWindow.minimize();
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

