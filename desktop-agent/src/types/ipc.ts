export type MediaAccessStatus = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown';

export interface ScreenPermissionResult {
  status: MediaAccessStatus;
  granted: boolean;
  platform: string;
}

export interface ConnectionConfig {
  serverUrl: string;
  roomId: string;
}

export interface AgentStatus {
  connected: boolean;
  connecting: boolean;
  reconnecting?: boolean;
  reconnectAttempt?: number;
  serverUrl: string;
  roomId: string;
  clickThrough: boolean;
  lastCaptureTime: number | null;
  nextScheduledCaptureIn: number; // in seconds (0-30)
  totalCaptures: number;
  lastError: string | null;
  isCapturing: boolean;
}

export interface CapturePayload {
  roomId?: string;
  triggerType: 'scheduled' | 'ondemand' | 'manual' | 'initial';
  requestId?: string;
  timestamp: number;
  imageBufferBase64: string;
  width: number;
  height: number;
  clientId?: string;
  deviceName?: string;
}

export interface CaptureResult {
  success: boolean;
  timestamp: number;
  triggerType: 'scheduled' | 'ondemand' | 'manual' | 'initial';
  requestId?: string;
  error?: string;
  url?: string;
}

export interface ElectronAPI {
  // Platform metadata
  platform: string;
  arch: string;
  isMac: boolean;
  isWindows: boolean;

  // Screen permission APIs
  checkScreenPermission: () => Promise<ScreenPermissionResult>;
  openScreenPermissionSettings: () => Promise<boolean>;

  // Agent connection APIs
  connectAgent: (config: ConnectionConfig) => Promise<{ success: boolean; error?: string }>;
  disconnectAgent: () => Promise<void>;
  getAgentStatus: () => Promise<AgentStatus>;
  triggerManualCapture: () => Promise<CaptureResult>;
  captureAndUploadInitial: (serverUrl?: string) => Promise<CaptureResult>;

  // Window & Overlay controls
  toggleClickThrough: () => Promise<boolean>;
  setClickThrough: (enabled: boolean) => Promise<boolean>;
  toggleWindowVisibility: () => Promise<boolean>;
  adjustWindowOpacity: (delta: number) => Promise<void>;
  setWindowOpacity: (opacity: number) => Promise<void>;
  setWindowSize: (width: number, height: number) => Promise<void>;
  getWindowSize: () => Promise<[number, number]>;
  setContentProtection: (enabled: boolean) => Promise<boolean>;
  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  // Code Synchronization REST APIs (IPC-based bypasses all web sandbox/CORS restrictions)
  fetchRoomCode: (
    serverUrl: string,
    roomId: string,
    sinceVersion?: number,
    waitMs?: number
  ) => Promise<{ success: boolean; code?: string; language?: string; version?: number; error?: string }>;
  pushRoomCode: (
    serverUrl: string,
    roomId: string,
    payload: { code: string; language?: string; clientId?: string; author?: string }
  ) => Promise<{ success: boolean; version?: number; error?: string }>;

  // Event Listeners from Main Process
  onAgentStatusUpdate: (callback: (status: AgentStatus) => void) => () => void;
  onClickThroughToggled: (callback: (enabled: boolean) => void) => () => void;
  onOnDemandTriggered: (callback: (data: { requestId: string; timestamp: number }) => void) => () => void;
  onCaptureCompleted: (callback: (result: CaptureResult) => void) => () => void;
  onAdjustOpacity: (callback: (delta: number) => void) => () => void;
  onVisibilityChanged: (callback: (visible: boolean) => void) => () => void;
}
