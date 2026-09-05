export type ServerStatusState = 'running' | 'stopped' | 'starting' | 'error';

export interface ServerStatus {
  status: ServerStatusState;
  port: number;
  url: string;
  isEmbedded: boolean;
  pid?: number;
  error?: string;
  lastChecked: number;
}

export type TunnelStatusState = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface TunnelStatus {
  status: TunnelStatusState;
  publicUrl: string | null;
  error?: string;
  binaryPath?: string;
  logs: string[];
}

export interface OpenFolderResult {
  success: boolean;
  path?: string;
  error?: string;
}
