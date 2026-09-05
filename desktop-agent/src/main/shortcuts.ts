import { globalShortcut, BrowserWindow } from 'electron';
import { getMainWindow } from './window.js';

let isClickThroughEnabled = false;
let onToggleCallback: ((enabled: boolean) => void) | null = null;

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

export function registerGlobalShortcuts(
  window: BrowserWindow | null,
  onToggle: (enabled: boolean) => void
): void {
  onToggleCallback = onToggle;

  // Unregister existing first to prevent duplicate handler warnings
  globalShortcut.unregister('CommandOrControl+Shift+X');
  globalShortcut.unregister('CommandOrControl+Shift+P');

  // Register primary Cmd+Shift+X
  const registeredX = globalShortcut.register('CommandOrControl+Shift+X', () => {
    console.log('[Shortcut] Cmd+Shift+X triggered. Toggling click-through...');
    toggleClickThrough();
  });

  // Register secondary Cmd+Shift+P
  const registeredP = globalShortcut.register('CommandOrControl+Shift+P', () => {
    console.log('[Shortcut] Cmd+Shift+P triggered. Toggling click-through...');
    toggleClickThrough();
  });

  console.log(`[Shortcuts] Registered Cmd+Shift+X: ${registeredX}, Cmd+Shift+P: ${registeredP}`);
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}

