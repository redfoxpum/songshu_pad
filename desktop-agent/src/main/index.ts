import { app, BrowserWindow } from 'electron';
import { createFloatingWindow, getMainWindow } from './window.js';
import { setupIpcHandlers, notifyClickThroughChanged } from './ipc.js';
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from './shortcuts.js';
import { agentService } from './agentService.js';

// Enforce single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    let win = getMainWindow();
    if (!win || win.isDestroyed()) {
      win = createFloatingWindow();
    } else {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
}

app.whenReady().then(() => {
  console.log('[Main] App starting...');

  // Setup IPC handlers
  setupIpcHandlers();

  // Create floating HUD window
  const mainWindow = createFloatingWindow();

  // Register Cmd+Shift+X & Cmd+Shift+P global shortcuts
  registerGlobalShortcuts(mainWindow, (enabled) => {
    notifyClickThroughChanged(getMainWindow(), enabled);
  });

  app.on('activate', () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) {
      createFloatingWindow();
    } else {
      win.show();
      win.focus();
    }
  });
});

app.on('will-quit', () => {
  unregisterGlobalShortcuts();
  agentService.disconnect();
});

app.on('window-all-closed', () => {
  app.quit();
});

