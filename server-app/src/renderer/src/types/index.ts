export type SupportedLanguage = 'python' | 'cpp' | 'java';

export interface ScreenshotInfo {
  filename: string;
  url: string;
  roomId?: string;
  timestamp: number;
  type: 'interval' | 'instant';
  sizeBytes: number;
  formattedTime?: string;
}

export interface CandidateAgentStatus {
  roomId: string;
  connected: boolean;
  agentName: string;
  ip?: string;
  latencyMs?: number;
  permissionStatus: 'normal' | 'unauthorized' | 'unknown';
  lastSeen: number;
}

export interface RoomItem {
  id: string;
  name: string;
  language: SupportedLanguage;
  createdAt: number;
  lastActiveAt?: number;
  status?: 'active' | 'closed';
  closedAt?: number;
  screenshotCount: number;
  latestScreenshot?: ScreenshotInfo;
  candidateStatus?: CandidateAgentStatus;
}

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

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}
