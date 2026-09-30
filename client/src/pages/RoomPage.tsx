import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import {
  SupportedLanguage,
  EditorTheme,
  UserProfile,
  RemoteParticipant,
  ConnectionStatus,
  ActiveView,
} from '../types';
import { Header } from '../components/Header';
import { CodeEditor } from '../components/CodeEditor';
import { Whiteboard } from '../components/Whiteboard';
import { UserModal } from '../components/UserModal';
import { getStoredUser, saveStoredUser } from '../utils/user';
import { saveRecentRoom } from '../utils/storage';
import { LANGUAGES } from '../utils/languages';

interface RoomPageProps {
  roomId: string;
  onBackHome: () => void;
  onShowToast: (type: 'success' | 'info' | 'warning' | 'error', msg: string) => void;
}

export const RoomPage: React.FC<RoomPageProps> = ({
  roomId,
  onBackHome,
  onShowToast,
}) => {
  const [theme, setTheme] = useState<EditorTheme>(() => {
    return (localStorage.getItem('coderpad_theme') as EditorTheme) || 'dark';
  });
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => getStoredUser());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [language, setLanguage] = useState<SupportedLanguage>('python');
  const [roomName, setRoomName] = useState<string>(roomId);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [isRoomClosed, setIsRoomClosed] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('code');

  // Toggle between code and whiteboard using Cmd+B / Ctrl+B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'b' || e.code === 'KeyB')) {
        e.preventDefault();
        setActiveView((prev) => (prev === 'code' ? 'whiteboard' : 'code'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Validate that the room was actually created by host and is not closed
  useEffect(() => {
    let isMounted = true;
    const checkRoom = () => {
      fetch(`/api/rooms/${encodeURIComponent(roomId)}`)
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (isMounted) {
              if (data.isClosed) {
                setIsRoomClosed(true);
              } else {
                setRoomNotFound(true);
              }
            }
            return;
          }
          const data = await res.json();
          if (isMounted) {
            if (!data.exists) {
              if (data.status === 'closed' || data.isClosed) {
                setIsRoomClosed(true);
              } else {
                setRoomNotFound(true);
              }
            } else if (data.status === 'closed') {
              setIsRoomClosed(true);
            }
          }
        })
        .catch(() => {});
    };

    checkRoom();
    const interval = setInterval(checkRoom, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [roomId]);

  // Setup Yjs Doc and WebsocketProvider with proper lifecycle management
  const [yjsState, setYjsState] = useState<{
    doc: Y.Doc;
    provider: WebsocketProvider;
    yText: Y.Text;
    roomMeta: Y.Map<any>;
  } | null>(null);

  // Immediately disconnect WebSocket if room is closed or not found
  useEffect(() => {
    if (isRoomClosed || roomNotFound) {
      if (yjsState?.provider) {
        try {
          yjsState.provider.disconnect();
        } catch {}
      }
    }
  }, [isRoomClosed, roomNotFound, yjsState]);

  useEffect(() => {
    const ydoc = new Y.Doc();

    // Determine WebSocket endpoint
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    const wsProvider = new WebsocketProvider(wsUrl, roomId, ydoc, { disableBc: true });
    const text = ydoc.getText('codemirror');
    const meta = ydoc.getMap<any>('room-meta');

    setYjsState({
      doc: ydoc,
      provider: wsProvider,
      yText: text,
      roomMeta: meta,
    });

    return () => {
      wsProvider.destroy();
      ydoc.destroy();
      setYjsState(null);
    };
  }, [roomId]);

  // Handle awareness & user profile
  useEffect(() => {
    if (!yjsState) return;
    const { provider } = yjsState;

    // Set current user awareness
    provider.awareness.setLocalStateField('user', currentUser);

    const updateParticipants = () => {
      const states = provider.awareness.getStates();
      const list: RemoteParticipant[] = [];

      states.forEach((state, clientId) => {
        if (state.user) {
          list.push({
            clientId,
            user: {
              name: state.user.name || 'Anonymous',
              color: state.user.color || '#3b82f6',
            },
            isSelf: clientId === provider.awareness.clientID,
          });
        }
      });

      setParticipants(list);
    };

    updateParticipants();
    provider.awareness.on('change', updateParticipants);

    return () => {
      provider.awareness.off('change', updateParticipants);
    };
  }, [yjsState, currentUser]);

  // Handle provider connection status
  useEffect(() => {
    if (!yjsState) return;
    const { provider } = yjsState;

    const handleStatus = (event: { status: ConnectionStatus }) => {
      setConnectionStatus(event.status);
      if (event.status === 'connected') {
        onShowToast('success', 'Connected to real-time collaboration server.');
      } else if (event.status === 'disconnected') {
        onShowToast('warning', 'Disconnected from server. Reconnecting...');
      }
    };

    provider.on('status', handleStatus);

    return () => {
      provider.off('status', handleStatus);
    };
  }, [yjsState, onShowToast]);

  // Handle room metadata synchronization
  useEffect(() => {
    if (!yjsState) return;
    const { roomMeta } = yjsState;

    const handleMetaUpdate = () => {
      const currentLang = roomMeta.get('language') as SupportedLanguage;
      if (currentLang && ['python', 'cpp', 'java'].includes(currentLang)) {
        setLanguage(currentLang);
      }
      const name = roomMeta.get('name') as string;
      if (name) {
        setRoomName(name);
      }

      // Save to recent rooms in localStorage
      saveRecentRoom({
        id: roomId,
        name: name || roomId,
        language: currentLang || 'python',
      });
    };

    // Initial read
    handleMetaUpdate();

    roomMeta.observe(handleMetaUpdate);

    return () => {
      roomMeta.unobserve(handleMetaUpdate);
    };
  }, [yjsState, roomId]);

  // Save theme
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('coderpad_theme', next);
  };

  // Language change handler (syncs over CRDT to all users)
  const handleLanguageChange = (newLang: SupportedLanguage) => {
    if (yjsState) {
      yjsState.doc.transact(() => {
        yjsState.roomMeta.set('language', newLang);
      });
    }
    setLanguage(newLang);
    const langConfig = LANGUAGES[newLang];
    onShowToast('info', `Switched room language to ${langConfig.name}`);
  };

  // Save profile changes
  const handleSaveProfile = (profile: UserProfile) => {
    saveStoredUser(profile);
    setCurrentUser(profile);
    if (yjsState) {
      yjsState.provider.awareness.setLocalStateField('user', profile);
    }
    onShowToast('success', 'Profile updated successfully.');
  };

  const currentCodeRef = useRef<string>('');

  // Copy all code
  const handleCopyAllCode = useCallback(() => {
    const code = currentCodeRef.current;
    navigator.clipboard.writeText(code);
    onShowToast('success', 'Full code copied to clipboard!');
  }, [onShowToast]);

  // Export code as file
  const handleExportCode = useCallback(() => {
    const code = currentCodeRef.current;
    const langConfig = LANGUAGES[language] || LANGUAGES.python;
    const filename = `${roomName || roomId}${langConfig.extension}`;
    const blob = new Blob([code], { type: `${langConfig.mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast('success', `Exported ${filename}`);
  }, [language, roomName, roomId, onShowToast]);

  if (isRoomClosed) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-3xl mb-4 shadow-lg shadow-rose-500/10">
          🔒
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">面试房间已关闭</h1>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          房间 <code className="text-rose-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-mono">{roomId}</code> 已由主持人结束或关闭。所有实时协同编辑已终止。若有疑问，请联系面试官。
        </p>
        <button
          onClick={onBackHome}
          className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all"
        >
          返回首页
        </button>
      </div>
    );
  }

  if (roomNotFound) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-3xl mb-4 shadow-lg shadow-amber-500/10">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">协同房间未找到</h1>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          房间 <code className="text-amber-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-mono">{roomId}</code> 尚未在 <strong>macOS 主控端 App</strong> 中创建或链接有误。请联系主持人获取有效房间链接。
        </p>
        <button
          onClick={onBackHome}
          className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all"
        >
          返回首页输入其他房间
        </button>
      </div>
    );
  }

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Room Header */}
      <Header
        roomId={roomId}
        roomName={roomName}
        language={language}
        onLanguageChange={handleLanguageChange}
        theme={theme}
        onThemeToggle={toggleTheme}
        currentUser={currentUser}
        participants={participants}
        connectionStatus={connectionStatus}
        activeView={activeView}
        onActiveViewChange={setActiveView}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onCopyAllCode={handleCopyAllCode}
        onExportCode={handleExportCode}
        onBackHome={onBackHome}
        onShowToast={onShowToast}
      />

      {/* Editor & Whiteboard Canvas (DOM Keep-Alive) */}
      <main className="flex-1 w-full h-full relative overflow-hidden">
        {/* Code Editor View */}
        <div className={`w-full h-full ${activeView === 'code' ? 'block' : 'hidden'}`}>
          <CodeEditor
            key={roomId}
            roomId={roomId}
            language={language}
            theme={theme}
            currentUser={currentUser}
            onLanguageChange={handleLanguageChange}
            onCodeChange={(code) => {
              currentCodeRef.current = code;
            }}
            onSyncStatus={(status) => {
              setConnectionStatus(status === 'error' ? 'disconnected' : 'connected');
            }}
          />
        </div>

        {/* Whiteboard Canvas View */}
        {yjsState && (
          <div className={`w-full h-full ${activeView === 'whiteboard' ? 'block' : 'hidden'}`}>
            <Whiteboard
              doc={yjsState.doc}
              provider={yjsState.provider}
              currentUser={currentUser}
              theme={theme}
              isVisible={activeView === 'whiteboard'}
            />
          </div>
        )}
      </main>

      {/* User Customization Modal */}
      <UserModal
        isOpen={isProfileModalOpen}
        currentUser={currentUser}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={handleSaveProfile}
      />
    </div>
  );
};
