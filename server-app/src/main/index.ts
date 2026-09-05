import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { serverManager } from './serverManager';
import { tunnelManager } from './tunnelManager';
import { registerIpcHandlers } from './ipcHandlers';

let mainWindow: BrowserWindow | null = null;

// Enforce single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
}

async function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 1000,
    minHeight: 660,
    title: '松鼠Pad 主控端',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: '#0B0F19',
    webPreferences: {
      preload: path.resolve(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    console.log(`[Main] Loading dev server: ${devServerUrl}`);
    await mainWindow.loadURL(devServerUrl);
  } else {
    const indexPath = path.resolve(__dirname, '../renderer/index.html');
    console.log(`[Main] Loading production index: ${indexPath}`);
    await mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Relay status changes to renderer
  serverManager.onStatusChange((status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-status-changed', status);
    }
  });

  tunnelManager.onStatusChange((status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tunnel-status-changed', status);
    }
  });

  return mainWindow;
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  await createWindow();

  // Automatically ensure server and tunnel are active
  console.log('[Main] Initializing Embedded Server and Cloudflare Tunnel...');
  serverManager.ensureServerRunning().catch((err) => {
    console.error('[Main] Error launching server:', err);
  });

  // Start tunnel after server is ready
  setTimeout(() => {
    tunnelManager.start().catch((err) => {
      console.error('[Main] Error starting tunnel:', err);
    });
  }, 1000);

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

// Clean shutdown
let isQuitting = false;
app.on('before-quit', (e) => {
  if (!isQuitting) {
    isQuitting = true;
    console.log('[Main] App quitting, cleaning up tunnel and server...');
    tunnelManager.stop();
    serverManager.stop();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

