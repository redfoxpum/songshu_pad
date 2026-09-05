export type SupportedLanguage = 'python' | 'cpp' | 'java';

export type TriggerType = 'scheduled' | 'ondemand' | 'initial' | 'manual';
export type ScreenshotTriggerType = 'scheduled' | 'ondemand' | 'interval' | 'instant' | 'initial' | 'manual';

export interface RoomMetadata {
  id: string;
  name?: string;
  language: SupportedLanguage;
  createdAt: number;
  lastActiveAt: number;
  status?: 'active' | 'closed';
  closedAt?: number;
}

export interface CreateRoomRequest {
  language?: SupportedLanguage;
  name?: string;
}

export interface RoomListItem extends RoomMetadata {
  screenshotCount: number;
  onlineClients: number;
  latestScreenshot?: ScreenshotMetadata;
  candidateStatus?: CandidateAgentStatus;
}

export interface RoomInfoResponse {
  id: string;
  name?: string;
  language: SupportedLanguage;
  createdAt: number;
  lastActiveAt: number;
  status?: 'active' | 'closed';
  closedAt?: number;
  exists: boolean;
  screenshotCount: number;
  onlineClients: number;
  candidateStatus?: CandidateAgentStatus;
}

export interface ScreenshotMetadata {
  filename: string;
  url: string;
  roomId?: string;
  timestamp: number;
  triggerType: TriggerType;
  clientId: string;
  deviceName?: string;
  size: number;
  createdAt?: number;
}

export interface ScreenshotInfo {
  filename: string;
  url: string;
  roomId?: string;
  timestamp: number;
  type?: 'interval' | 'instant';
  triggerType?: TriggerType;
  sizeBytes?: number;
  size?: number;
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

export interface AgentInfo {
  clientId: string;
  roomId: string;
  deviceName: string;
  hasScreenPermission: boolean;
  lastHeartbeat: number;
  connectedAt: number;
  status: 'online' | 'offline' | 'idle' | 'capturing';
}

// WebSocket Command Gateway Protocol Types
export type GatewayMessageType =
  | 'AGENT_REGISTER'
  | 'REGISTER_ACK'
  | 'HEARTBEAT'
  | 'HEARTBEAT_ACK'
  | 'COMMAND_SCREENSHOT'
  | 'CAPTURE_COMPLETED'
  | 'SCREENSHOT_NEW'
  | 'AGENT_STATUS_UPDATE'
  | 'SUBSCRIBE_ROOM'
  | 'ERROR';

export interface AgentRegisterMessage {
  type: 'AGENT_REGISTER';
  roomId: string;
  clientId: string;
  deviceName?: string;
  hasScreenPermission?: boolean;
}

export interface RegisterAckMessage {
  type: 'REGISTER_ACK';
  success: boolean;
  clientId: string;
  roomId: string;
  message?: string;
}

export interface HeartbeatMessage {
  type: 'HEARTBEAT';
  roomId: string;
  clientId: string;
  deviceName?: string;
  hasScreenPermission?: boolean;
}

export interface HeartbeatAckMessage {
  type: 'HEARTBEAT_ACK';
  timestamp: number;
}

export interface CommandScreenshotMessage {
  type: 'COMMAND_SCREENSHOT';
  roomId: string;
  clientId?: string;
  requestId?: string;
  reason?: string;
  triggerType?: TriggerType;
}

export interface CaptureCompletedMessage {
  type: 'CAPTURE_COMPLETED';
  roomId: string;
  clientId: string;
  filename?: string;
  screenshotUrl?: string;
  triggerType?: TriggerType;
  timestamp?: number;
  deviceName?: string;
  size?: number;
}

export interface SubscribeRoomMessage {
  type: 'SUBSCRIBE_ROOM';
  roomId: string;
  clientId?: string;
}

export interface ScreenshotNewMessage {
  type: 'SCREENSHOT_NEW';
  roomId: string;
  screenshot: ScreenshotMetadata;
}

export interface AgentStatusUpdateMessage {
  type: 'AGENT_STATUS_UPDATE';
  roomId: string;
  agents: AgentInfo[];
}

export interface ErrorMessage {
  type: 'ERROR';
  message: string;
}


