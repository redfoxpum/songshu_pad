import { app, ipcMain, shell, clipboard } from 'electron';
import path from 'path';
import fs from 'fs';
import { serverManager } from './serverManager';
import { tunnelManager } from './tunnelManager';
import { OpenFolderResult } from './types';

export function registerIpcHandlers(): void {
  // Get Workspace root directory
  const getWorkspaceRoot = (): string => {
    // In dev: __dirname is server-app/dist/main -> ../../../ is coder_pad_平替
    return path.resolve(process.cwd(), '../');
  };

  // Open Room Screenshots in Finder
  ipcMain.handle('open-room-screenshots', async (_event, roomId: string): Promise<OpenFolderResult> => {
    try {
      if (!roomId) {
        return { success: false, error: 'Room ID is required' };
      }
      const sanitized = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
      
      // Look in configured data dir, app documents, and workspace data
      const possiblePaths = [
        process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'rooms', sanitized, 'screenshots') : '',
        app && app.isPackaged ? path.join(app.getPath('documents'), 'coder_pad_平替', 'data', 'rooms', sanitized, 'screenshots') : '',
        path.resolve(process.cwd(), 'data', 'rooms', sanitized, 'screenshots'),
        path.resolve(process.cwd(), '..', 'data', 'rooms', sanitized, 'screenshots'),
      ].filter(Boolean);

      let targetDir = possiblePaths[0];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          targetDir = p;
          break;
        }
      }

      // Ensure directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      console.log(`[IPC] Opening screenshots folder in Finder: ${targetDir}`);
      const err = await shell.openPath(targetDir);
      if (err) {
        return { success: false, error: err };
      }

      return { success: true, path: targetDir };
    } catch (err: any) {
      console.error('[IPC] Failed to open room screenshots folder:', err);
      return { success: false, error: err.message };
    }
  });

  // Open generic folder path in Finder
  ipcMain.handle('open-folder', async (_event, folderPath: string): Promise<OpenFolderResult> => {
    try {
      if (!folderPath) {
        return { success: false, error: 'Folder path required' };
      }
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      const err = await shell.openPath(folderPath);
      if (err) {
        return { success: false, error: err };
      }
      return { success: true, path: folderPath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Show specific item in Finder
  ipcMain.handle('show-item-in-folder', async (_event, filePath: string): Promise<boolean> => {
    try {
      if (fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  // Server Control
  ipcMain.handle('get-server-status', () => {
    return serverManager.getStatus();
  });

  ipcMain.handle('check-server-health', async () => {
    await serverManager.checkHealth();
    return serverManager.getStatus();
  });

  ipcMain.handle('restart-server', async () => {
    serverManager.stop();
    await new Promise((r) => setTimeout(r, 1000));
    return serverManager.ensureServerRunning();
  });

  // Tunnel Control
  ipcMain.handle('get-tunnel-status', () => {
    return tunnelManager.getStatus();
  });

  ipcMain.handle('start-tunnel', async () => {
    return tunnelManager.start();
  });

  ipcMain.handle('stop-tunnel', () => {
    tunnelManager.stop();
    return tunnelManager.getStatus();
  });

  ipcMain.handle('restart-tunnel', async () => {
    return tunnelManager.restart();
  });

  // Native Utilities
  ipcMain.handle('copy-text', (_event, text: string) => {
    clipboard.writeText(text);
    return true;
  });

  ipcMain.handle('open-external', (_event, url: string) => {
    shell.openExternal(url);
    return true;
  });
}
