import { contextBridge, ipcRenderer } from 'electron';

export interface ServerStatus {
  status: 'running' | 'stopped' | 'starting' | 'error';
  port: number;
  url: string;
  isEmbedded: boolean;
  pid?: number;
  error?: string;
  lastChecked: number;
}

export interface TunnelStatus {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  publicUrl: string | null;
  error?: string;
  binaryPath?: string;
  logs: string[];
}

export interface ElectronAPI {
  openRoomScreenshots: (roomId: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  openFolder: (folderPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  showItemInFolder: (filePath: string) => Promise<boolean>;
  getServerStatus: () => Promise<ServerStatus>;
  checkServerHealth: () => Promise<ServerStatus>;
  restartServer: () => Promise<ServerStatus>;
  getTunnelStatus: () => Promise<TunnelStatus>;
  startTunnel: () => Promise<TunnelStatus>;
  stopTunnel: () => Promise<TunnelStatus>;
  restartTunnel: () => Promise<TunnelStatus>;
  copyText: (text: string) => Promise<boolean>;
  openExternal: (url: string) => Promise<boolean>;
  onServerStatusChanged: (callback: (status: ServerStatus) => void) => () => void;
  onTunnelStatusChanged: (callback: (status: TunnelStatus) => void) => () => void;
}

const electronAPI: ElectronAPI = {
  openRoomScreenshots: (roomId: string) => ipcRenderer.invoke('open-room-screenshots', roomId),
  openFolder: (folderPath: string) => ipcRenderer.invoke('open-folder', folderPath),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('show-item-in-folder', filePath),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  checkServerHealth: () => ipcRenderer.invoke('check-server-health'),
  restartServer: () => ipcRenderer.invoke('restart-server'),
  getTunnelStatus: () => ipcRenderer.invoke('get-tunnel-status'),
  startTunnel: () => ipcRenderer.invoke('start-tunnel'),
  stopTunnel: () => ipcRenderer.invoke('stop-tunnel'),
  restartTunnel: () => ipcRenderer.invoke('restart-tunnel'),
  copyText: (text: string) => ipcRenderer.invoke('copy-text', text),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  onServerStatusChanged: (callback: (status: ServerStatus) => void) => {
    const handler = (_event: any, status: ServerStatus) => callback(status);
    ipcRenderer.on('server-status-changed', handler);
    return () => ipcRenderer.removeListener('server-status-changed', handler);
  },
  onTunnelStatusChanged: (callback: (status: TunnelStatus) => void) => {
    const handler = (_event: any, status: TunnelStatus) => callback(status);
    ipcRenderer.on('tunnel-status-changed', handler);
    return () => ipcRenderer.removeListener('tunnel-status-changed', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
