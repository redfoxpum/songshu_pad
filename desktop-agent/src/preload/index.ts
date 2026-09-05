import { contextBridge, ipcRenderer } from 'electron';
import { ConnectionConfig, ElectronAPI, ScreenPermissionResult, AgentStatus, CaptureResult } from '../types/ipc.js';

const api: ElectronAPI = {
  // Screen recording permission
  checkScreenPermission: (): Promise<ScreenPermissionResult> => {
    return ipcRenderer.invoke('check-screen-permission');
  },
  openScreenPermissionSettings: (): Promise<boolean> => {
    return ipcRenderer.invoke('open-screen-permission-settings');
  },

  // Agent connection
  connectAgent: (config: ConnectionConfig): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('connect-agent', config);
  },
  disconnectAgent: (): Promise<void> => {
    return ipcRenderer.invoke('disconnect-agent');
  },
  getAgentStatus: (): Promise<AgentStatus> => {
    return ipcRenderer.invoke('get-agent-status');
  },
  triggerManualCapture: (): Promise<CaptureResult> => {
    return ipcRenderer.invoke('trigger-manual-capture');
  },
  captureAndUploadInitial: (serverUrl?: string): Promise<CaptureResult> => {
    return ipcRenderer.invoke('capture-and-upload-initial', serverUrl);
  },

  // Window & Click-through controls
  toggleClickThrough: (): Promise<boolean> => {
    return ipcRenderer.invoke('toggle-click-through');
  },
  setClickThrough: (enabled: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('set-click-through', enabled);
  },
  setWindowOpacity: (opacity: number): Promise<void> => {
    return ipcRenderer.invoke('set-window-opacity', opacity);
  },
  setWindowSize: (width: number, height: number): Promise<void> => {
    return ipcRenderer.invoke('set-window-size', width, height);
  },
  getWindowSize: (): Promise<[number, number]> => {
    return ipcRenderer.invoke('get-window-size');
  },
  setContentProtection: (enabled: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('set-content-protection', enabled);
  },
  minimizeWindow: (): Promise<void> => {
    return ipcRenderer.invoke('minimize-window');
  },
  closeWindow: (): Promise<void> => {
    return ipcRenderer.invoke('close-window');
  },

  // Event Listeners from Main
  onAgentStatusUpdate: (callback: (status: AgentStatus) => void) => {
    const handler = (_event: any, status: AgentStatus) => callback(status);
    ipcRenderer.on('agent:status-update', handler);
    return () => {
      ipcRenderer.removeListener('agent:status-update', handler);
    };
  },

  onClickThroughToggled: (callback: (enabled: boolean) => void) => {
    const handler = (_event: any, enabled: boolean) => callback(enabled);
    ipcRenderer.on('agent:click-through-toggled', handler);
    return () => {
      ipcRenderer.removeListener('agent:click-through-toggled', handler);
    };
  },

  onOnDemandTriggered: (callback: (data: { requestId: string; timestamp: number }) => void) => {
    const handler = (_event: any, data: { requestId: string; timestamp: number }) => callback(data);
    ipcRenderer.on('agent:ondemand-trigger', handler);
    return () => {
      ipcRenderer.removeListener('agent:ondemand-trigger', handler);
    };
  },

  onCaptureCompleted: (callback: (result: CaptureResult) => void) => {
    const handler = (_event: any, result: CaptureResult) => callback(result);
    ipcRenderer.on('agent:capture-completed', handler);
    return () => {
      ipcRenderer.removeListener('agent:capture-completed', handler);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
