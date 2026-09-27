export type SupportedLanguage = 'python' | 'cpp' | 'java';

export type EditorTheme = 'dark' | 'light';

export type ActiveView = 'code' | 'whiteboard';

export interface UserProfile {
  name: string;
  color: string;
}

export interface RemoteParticipant {
  clientId: number;
  user: UserProfile;
  isSelf?: boolean;
}

export interface RecentRoom {
  id: string;
  name: string;
  language: SupportedLanguage;
  visitedAt: number;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  duration?: number;
}
