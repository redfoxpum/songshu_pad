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
    console.log('[Shortcut] Cmd+H: Window completely hidden.');
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
      win.setSkipTaskbar(true);
    } catch (err) {
      console.error('[Shortcut] Error restoring window state on show:', err);
    }
    console.log('[Shortcut] Window displayed again.');
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
    'CommandOrControl+X',
    'CommandOrControl+H',
    'CommandOrControl+[',
    'CommandOrControl+]',
    'CommandOrControl+=',
    'CommandOrControl+-',
    'CommandOrControl+Down',
    'CommandOrControl+Up',
  ];

  for (const acc of toUnregister) {
    try {
      globalShortcut.unregister(acc);
    } catch (e) {}
  }

  // 1. Click-through toggling (Cmd+X / Ctrl+X, Cmd+Shift+X / Ctrl+Shift+X)
  const registeredX = globalShortcut.register('CommandOrControl+X', () => {
    console.log('[Shortcut] Cmd+X / Ctrl+X triggered. Toggling click-through...');
    toggleClickThrough();
  });
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    console.log('[Shortcut] Cmd+Shift+X / Ctrl+Shift+X triggered. Toggling click-through...');
    toggleClickThrough();
  });

  // 2. Window visibility toggle (Cmd+H / Ctrl+H, Cmd+Shift+B / Ctrl+Shift+B, Cmd+B / Ctrl+B)
  const registeredH = globalShortcut.register('CommandOrControl+H', () => {
    console.log('[Shortcut] Cmd+H / Ctrl+H triggered. Toggling window visibility...');
    toggleWindowVisibility();
  });
  globalShortcut.register('CommandOrControl+Shift+B', () => {
    console.log('[Shortcut] Cmd+Shift+B / Ctrl+Shift+B triggered. Toggling window visibility...');
    toggleWindowVisibility();
  });
  globalShortcut.register('CommandOrControl+B', () => {
    console.log('[Shortcut] Cmd+B / Ctrl+B triggered. Toggling window visibility...');
    toggleWindowVisibility();
  });

  // 3. Opacity adjustments (Cmd+[ / Ctrl+[, Cmd+] / Ctrl+], with or without Shift)
  const registeredBracketLeft = globalShortcut.register('CommandOrControl+[', () => {
    adjustOpacity(-0.05);
  });
  globalShortcut.register('CommandOrControl+Shift+[', () => {
    adjustOpacity(-0.05);
  });

  const registeredBracketRight = globalShortcut.register('CommandOrControl+]', () => {
    adjustOpacity(0.05);
  });
  globalShortcut.register('CommandOrControl+Shift+]', () => {
    adjustOpacity(0.05);
  });

  // 4. Window Height adjustments (Cmd+= / Cmd++ / Ctrl+=, Cmd+- / Ctrl+-)
  let registeredPlus = false;
  try {
    registeredPlus = globalShortcut.register('CommandOrControl+=', () => {
      adjustWindowHeight(60);
    });
    globalShortcut.register('CommandOrControl+Shift+=', () => {
      adjustWindowHeight(60);
    });
  } catch (e) {}

  let registeredMinus = false;
  try {
    registeredMinus = globalShortcut.register('CommandOrControl+-', () => {
      adjustWindowHeight(-60);
    });
    globalShortcut.register('CommandOrControl+Shift+-', () => {
      adjustWindowHeight(-60);
    });
  } catch (e) {}

  // 5. Half-page scrolling (Cmd+Down / Ctrl+Down, Cmd+Up / Ctrl+Up)
  let registeredDown = false;
  try {
    registeredDown = globalShortcut.register('CommandOrControl+Down', () => {
      scrollPage('down');
    });
    globalShortcut.register('CommandOrControl+Shift+Down', () => {
      scrollPage('down');
    });
  } catch (e) {}

  let registeredUp = false;
  try {
    registeredUp = globalShortcut.register('CommandOrControl+Up', () => {
      scrollPage('up');
    });
    globalShortcut.register('CommandOrControl+Shift+Up', () => {
      scrollPage('up');
    });
  } catch (e) {}

  console.log(
    `[Shortcuts] Registered: ` +
    `Cmd/Ctrl+X: ${registeredX}, ` +
    `Cmd/Ctrl+H: ${registeredH}, ` +
    `Cmd/Ctrl+[: ${registeredBracketLeft}, ` +
    `Cmd/Ctrl+]: ${registeredBracketRight}, ` +
    `Cmd/Ctrl+=: ${registeredPlus}, ` +
    `Cmd/Ctrl+-: ${registeredMinus}, ` +
    `Cmd/Ctrl+Down: ${registeredDown}, ` +
    `Cmd/Ctrl+Up: ${registeredUp}`
  );
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}


