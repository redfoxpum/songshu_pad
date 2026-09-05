/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    openRoomScreenshots: (roomId: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    openFolder: (folderPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    showItemInFolder: (filePath: string) => Promise<boolean>;
    getServerStatus: () => Promise<import('./types').ServerStatus>;
    checkServerHealth: () => Promise<import('./types').ServerStatus>;
    restartServer: () => Promise<import('./types').ServerStatus>;
    getTunnelStatus: () => Promise<import('./types').TunnelStatus>;
    startTunnel: () => Promise<import('./types').TunnelStatus>;
    stopTunnel: () => Promise<import('./types').TunnelStatus>;
    restartTunnel: () => Promise<import('./types').TunnelStatus>;
    copyText: (text: string) => Promise<boolean>;
    openExternal: (url: string) => Promise<boolean>;
    onServerStatusChanged: (callback: (status: import('./types').ServerStatus) => void) => () => void;
    onTunnelStatusChanged: (callback: (status: import('./types').TunnelStatus) => void) => () => void;
  };
}
