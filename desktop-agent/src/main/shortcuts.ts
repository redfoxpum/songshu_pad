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

/**
 * Toggle whiteboard / code view in renderer.
 */
export function toggleWhiteboardView(window?: BrowserWindow | null): void {
  const win = window || getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('window:toggle-whiteboard');
    console.log('[Shortcut] Cmd+B / Ctrl+B triggered: Whiteboard view toggle sent to renderer.');
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
    'CommandOrControl+X',
    'CommandOrControl+Shift+H',
    'CommandOrControl+H',
    'CommandOrControl+Shift+B',
    'CommandOrControl+B',
    'CommandOrControl+Shift+[',
    'CommandOrControl+[',
    'CommandOrControl+Shift+]',
    'CommandOrControl+]',
    'CommandOrControl+Shift+=',
    'CommandOrControl+=',
    'CommandOrControl+Shift+-',
    'CommandOrControl+-',
    'CommandOrControl+Shift+Down',
    'CommandOrControl+Down',
    'CommandOrControl+Shift+Up',
    'CommandOrControl+Up',
    'CommandOrControl+Shift+P',
    'CommandOrControl+Shift+V',
  ];

  for (const acc of toUnregister) {
    try {
      globalShortcut.unregister(acc);
    } catch (e) {}
  }

  const registerKeys = (keys: string[], label: string, handler: () => void): string => {
    const results: string[] = [];
    for (const key of keys) {
      try {
        const ok = globalShortcut.register(key, handler);
        results.push(`${key}: ${ok ? 'OK' : 'FAILED'}`);
        if (!ok) {
          console.warn(`[Shortcut] Hotkey '${key}' registration failed (may conflict with OS/other software).`);
        }
      } catch (err) {
        console.error(`[Shortcut] Error registering '${key}':`, err);
        results.push(`${key}: ERR`);
      }
    }
    return results.join(', ');
  };

  // 1. Click-through toggling (Cmd+Shift+X, Cmd+X)
  const regX = registerKeys(
    ['CommandOrControl+Shift+X', 'CommandOrControl+X'],
    'Click-Through',
    () => {
      console.log('[Shortcut] Toggle click-through triggered');
      toggleClickThrough();
    }
  );

  // 2. Window visibility toggle (Cmd+Shift+H, Cmd+H)
  const regH = registerKeys(
    ['CommandOrControl+Shift+H', 'CommandOrControl+H'],
    'Visibility (Boss Key)',
    () => {
      console.log('[Shortcut] Toggle window visibility triggered');
      toggleWindowVisibility();
    }
  );

  // 3. Whiteboard toggle (Cmd+Shift+B, Cmd+B)
  const regB = registerKeys(
    ['CommandOrControl+Shift+B', 'CommandOrControl+B'],
    'Whiteboard Toggle',
    () => {
      console.log('[Shortcut] Toggle whiteboard view triggered');
      toggleWhiteboardView();
    }
  );

  // 4. Opacity adjustments (Cmd+Shift+[, Cmd+[, Cmd+Shift+], Cmd+])
  const regOpacityDec = registerKeys(
    ['CommandOrControl+Shift+[', 'CommandOrControl+['],
    'Decrease Opacity',
    () => adjustOpacity(-0.05)
  );
  const regOpacityInc = registerKeys(
    ['CommandOrControl+Shift+]', 'CommandOrControl+]'],
    'Increase Opacity',
    () => adjustOpacity(0.05)
  );

  // 5. Window Height adjustments (Cmd+Shift+=, Cmd+=, Cmd+Shift+-, Cmd+-)
  const regHeightInc = registerKeys(
    ['CommandOrControl+Shift+=', 'CommandOrControl+='],
    'Increase Height',
    () => adjustWindowHeight(60)
  );
  const regHeightDec = registerKeys(
    ['CommandOrControl+Shift+-', 'CommandOrControl+-'],
    'Decrease Height',
    () => adjustWindowHeight(-60)
  );

  // 6. Half-page scrolling (Cmd+Shift+Down, Cmd+Down, Cmd+Shift+Up, Cmd+Up)
  const regScrollDown = registerKeys(
    ['CommandOrControl+Shift+Down', 'CommandOrControl+Down'],
    'Scroll Down',
    () => scrollPage('down')
  );
  const regScrollUp = registerKeys(
    ['CommandOrControl+Shift+Up', 'CommandOrControl+Up'],
    'Scroll Up',
    () => scrollPage('up')
  );

  console.log('[Shortcuts] Global shortcuts registration completed:');
  console.log(`  ClickThrough: ${regX}`);
  console.log(`  Visibility:   ${regH}`);
  console.log(`  Whiteboard:   ${regB}`);
  console.log(`  OpacityDec:   ${regOpacityDec}`);
  console.log(`  OpacityInc:   ${regOpacityInc}`);
  console.log(`  HeightInc:    ${regHeightInc}`);
  console.log(`  HeightDec:    ${regHeightDec}`);
  console.log(`  ScrollDown:   ${regScrollDown}`);
  console.log(`  ScrollUp:     ${regScrollUp}`);
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}


