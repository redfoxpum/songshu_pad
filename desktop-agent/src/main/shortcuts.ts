import { globalShortcut, BrowserWindow, screen } from 'electron';
import { getMainWindow } from './window.js';

let isClickThroughEnabled = false;
let onToggleCallback: ((enabled: boolean) => void) | null = null;
let onVisibilityCallback: ((visible: boolean) => void) | null = null;
let onOpacityCallback: ((delta: number) => void) | null = null;

export function getClickThroughState(): boolean {
  return isClickThroughEnabled;
}

export function setClickThroughState(window: BrowserWindow | null, enabled: boolean): boolean {
  isClickThroughEnabled = enabled;
  const win = window || getMainWindow();
  if (win && !win.isDestroyed()) {
    if (isClickThroughEnabled) {
      // In click-through mode, forward mouse events to underlying windows
      win.setIgnoreMouseEvents(true, { forward: true });
    } else {
      // Restore normal mouse interaction
      win.setIgnoreMouseEvents(false);
    }
  }

  if (onToggleCallback) {
    onToggleCallback(isClickThroughEnabled);
  }

  return isClickThroughEnabled;
}

export function toggleClickThrough(window?: BrowserWindow | null): boolean {
  return setClickThroughState(window || getMainWindow(), !isClickThroughEnabled);
}

/**
 * Toggle window visibility completely:
 * If visible -> completely hide from screen.
 * If hidden -> restore and show, preserving always-on-top level and click-through state.
 */
export function toggleWindowVisibility(window?: BrowserWindow | null): boolean {
  const win = window || getMainWindow();
  if (!win || win.isDestroyed()) return false;

  if (win.isVisible()) {
    win.hide();
    console.log('[Shortcut] Cmd+Shift+B: Window completely hidden.');
    if (onVisibilityCallback) {
      onVisibilityCallback(false);
    }
    return false;
  } else {
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    // Maintain always-on-top level on macOS and cross-desktop roaming
    try {
      win.setAlwaysOnTop(true, 'screen-saver');
      if (process.platform === 'darwin') {
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      }
      if (isClickThroughEnabled) {
        win.setIgnoreMouseEvents(true, { forward: true });
      }
    } catch (err) {
      console.error('[Shortcut] Error restoring window state on show:', err);
    }
    console.log('[Shortcut] Cmd+Shift+B: Window displayed again.');
    if (onVisibilityCallback) {
      onVisibilityCallback(true);
    }
    return true;
  }
}

/**
 * Adjust background opacity via delta sent to renderer.
 * Negative delta = lower opacity (more transparent), positive = higher opacity (less transparent).
 */
export function adjustOpacity(delta: number, window?: BrowserWindow | null): void {
  const win = window || getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('window:adjust-opacity', delta);
    console.log(`[Shortcut] Opacity adjusted with delta: ${delta > 0 ? '+' : ''}${delta}`);
  }
  if (onOpacityCallback) {
    onOpacityCallback(delta);
  }
}

/**
 * Adjust window height via delta.
 * Delta > 0 increases height, delta < 0 decreases height.
 */
export function adjustWindowHeight(delta: number, window?: BrowserWindow | null): number {
  const win = window || getMainWindow();
  if (!win || win.isDestroyed()) return 0;

  const [width, height] = win.getSize();
  let maxHeight = 1600;
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    maxHeight = Math.min(1600, primaryDisplay.workAreaSize.height - 30);
  } catch (e) {}

  const minHeight = 180;
  const newHeight = Math.max(minHeight, Math.min(maxHeight, height + delta));

  win.setSize(width, newHeight, true);
  win.webContents.send('window:adjust-height', { width, height: newHeight, delta });
  console.log(`[Shortcut] Height adjusted to ${newHeight} (delta: ${delta > 0 ? '+' : ''}${delta})`);
  return newHeight;
}

/**
 * Scroll editor/content half a page.
 */
export function scrollPage(direction: 'down' | 'up', window?: BrowserWindow | null): void {
  const win = window || getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('window:scroll-page', direction);
    console.log(`[Shortcut] Page scroll triggered: ${direction}`);
  }
}

export interface ShortcutOptions {
  onToggleClickThrough?: (enabled: boolean) => void;
  onToggleVisibility?: (visible: boolean) => void;
  onAdjustOpacity?: (delta: number) => void;
}

export function registerGlobalShortcuts(
  window: BrowserWindow | null,
  options?: ((enabled: boolean) => void) | ShortcutOptions
): void {
  if (typeof options === 'function') {
    onToggleCallback = options;
  } else if (options) {
    onToggleCallback = options.onToggleClickThrough || null;
    onVisibilityCallback = options.onToggleVisibility || null;
    onOpacityCallback = options.onAdjustOpacity || null;
  }

  // Unregister existing first to prevent duplicate handler warnings
  const toUnregister = [
    'CommandOrControl+Shift+X',
    'CommandOrControl+Shift+P',
    'CommandOrControl+Shift+B',
    'CommandOrControl+Shift+V',
    'CommandOrControl+Shift+[',
    'CommandOrControl+Shift+]',
    'CommandOrControl+Shift+=',
    'CommandOrControl+Shift+-',
    'CommandOrControl+Shift+Down',
    'CommandOrControl+Shift+Up',
  ];

  for (const acc of toUnregister) {
    try {
      globalShortcut.unregister(acc);
    } catch (e) {}
  }

  // 1. Click-through toggling (Cmd+Shift+X)
  const registeredX = globalShortcut.register('CommandOrControl+Shift+X', () => {
    console.log('[Shortcut] Cmd+Shift+X triggered. Toggling click-through...');
    toggleClickThrough();
  });

  // 2. Window visibility toggle (Cmd+Shift+B: completely hide from screen, press again to show)
  const registeredB = globalShortcut.register('CommandOrControl+Shift+B', () => {
    console.log('[Shortcut] Cmd+Shift+B triggered. Toggling window visibility...');
    toggleWindowVisibility();
  });

  // 3. Opacity adjustments (Cmd+Shift+[ decrease opacity, Cmd+Shift+] increase opacity)
  const registeredBracketLeft = globalShortcut.register('CommandOrControl+Shift+[', () => {
    console.log('[Shortcut] Cmd+Shift+[ triggered. Decreasing opacity...');
    adjustOpacity(-0.05);
  });

  const registeredBracketRight = globalShortcut.register('CommandOrControl+Shift+]', () => {
    console.log('[Shortcut] Cmd+Shift+] triggered. Increasing opacity...');
    adjustOpacity(0.05);
  });

  // 4. Window Height adjustments (Cmd+Shift++ increase height, Cmd+Shift+- decrease height)
  let registeredPlus = false;
  try {
    registeredPlus = globalShortcut.register('CommandOrControl+Shift+=', () => {
      console.log('[Shortcut] Cmd+Shift++ triggered. Increasing window height...');
      adjustWindowHeight(60);
    });
  } catch (e) {}

  let registeredMinus = false;
  try {
    registeredMinus = globalShortcut.register('CommandOrControl+Shift+-', () => {
      console.log('[Shortcut] Cmd+Shift+- triggered. Decreasing window height...');
      adjustWindowHeight(-60);
    });
  } catch (e) {}

  // 5. Half-page scrolling (Cmd+Shift+Down scroll down half page, Cmd+Shift+Up scroll up half page)
  let registeredDown = false;
  try {
    registeredDown = globalShortcut.register('CommandOrControl+Shift+Down', () => {
      console.log('[Shortcut] Cmd+Shift+Down triggered. Scrolling down half page...');
      scrollPage('down');
    });
  } catch (e) {}

  let registeredUp = false;
  try {
    registeredUp = globalShortcut.register('CommandOrControl+Shift+Up', () => {
      console.log('[Shortcut] Cmd+Shift+Up triggered. Scrolling up half page...');
      scrollPage('up');
    });
  } catch (e) {}

  console.log(
    `[Shortcuts] Registered: ` +
    `Cmd+Shift+X: ${registeredX}, ` +
    `Cmd+Shift+B: ${registeredB}, ` +
    `Cmd+Shift+[: ${registeredBracketLeft}, ` +
    `Cmd+Shift+]: ${registeredBracketRight}, ` +
    `Cmd+Shift++: ${registeredPlus}, ` +
    `Cmd+Shift+-: ${registeredMinus}, ` +
    `Cmd+Shift+Down: ${registeredDown}, ` +
    `Cmd+Shift+Up: ${registeredUp}`
  );
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}


