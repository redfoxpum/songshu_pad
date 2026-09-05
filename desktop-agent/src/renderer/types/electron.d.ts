import { ElectronAPI } from '../../types/ipc';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
