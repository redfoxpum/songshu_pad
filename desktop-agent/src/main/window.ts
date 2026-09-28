import { BrowserWindow, screen, app } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createFloatingWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Window default dimensions: compact floating widget
  const defaultWidth = 420;
  const defaultHeight = 420;

  // Position at top-right corner with 24px padding
  const initialX = Math.max(0, screenWidth - defaultWidth - 24);
  const initialY = 48;

  // Window icon path
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../../build/icon.ico')
    : path.join(__dirname, '../../build/icon.png');

  mainWindow = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    x: initialX,
    y: initialY,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: true,
    minWidth: 280,
    minHeight: 40,
    movable: true,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    title: '松鼠Pad 桌面端',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
  });

  // 1. Screen Share Invisibility (防录屏 / 防截屏)
  // On macOS: [window setSharingType:NSWindowSharingNone]
  // On Windows: SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)
  try {
    mainWindow.setContentProtection(true);
    console.log('[Window] setContentProtection(true) successfully enabled.');
  } catch (err) {
    console.error('[Window] Failed to enable setContentProtection:', err);
  }

  // 2. Hide from Taskbar (Windows / macOS 任务栏完全隐形，不出现在任务栏中)
  try {
    mainWindow.setSkipTaskbar(true);
    console.log('[Window] setSkipTaskbar(true) successfully enabled.');
  } catch (err) {
    console.error('[Window] Failed to setSkipTaskbar:', err);
  }

  // 3. Always On Top with highest overlay level
  try {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    if (process.platform === 'darwin') {
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    console.log('[Window] setAlwaysOnTop enabled.');
  } catch (err) {
    console.error('[Window] Failed to set always-on-top level:', err);
  }

  // Load URL (Dev server or built static files)
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}
