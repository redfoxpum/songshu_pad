import React, { useState, useEffect, useCallback } from 'react';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';
import { ToastContainer } from './components/Toast';
import { ToastMessage } from './types';

export const App: React.FC = () => {
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Parse room ID from URL path (/room/:id) or query parameter (?room=:id)
  const parseRoomFromUrl = (): string | null => {
    const path = window.location.pathname;
    const match = path.match(/\/room\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return match[1];
    }

    const params = new URLSearchParams(window.location.search);
    if (params.has('room')) {
      return params.get('room');
    }

    // Check hash (#/room/:id or #:id)
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (hash.startsWith('room/')) {
      return hash.replace(/^room\//, '');
    }

    return null;
  };

  useEffect(() => {
    const initialRoom = parseRoomFromUrl();
    if (initialRoom) {
      setCurrentRoomId(initialRoom);
    }

    const handlePopState = () => {
      const room = parseRoomFromUrl();
      setCurrentRoomId(room);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleJoinRoom = (roomId: string) => {
    const cleanId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
    window.history.pushState({}, '', `/room/${cleanId}`);
    setCurrentRoomId(cleanId);
  };

  const handleBackHome = () => {
    window.history.pushState({}, '', '/');
    setCurrentRoomId(null);
  };

  const showToast = useCallback(
    (type: 'success' | 'info' | 'warning' | 'error', message: string, duration = 3000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newToast: ToastMessage = { id, type, message, duration };
      
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="w-full h-full min-h-screen bg-slate-950 text-slate-100 antialiased font-sans">
      {currentRoomId ? (
        <RoomPage
          roomId={currentRoomId}
          onBackHome={handleBackHome}
          onShowToast={showToast}
        />
      ) : (
        <HomePage
          onJoinRoom={handleJoinRoom}
          onShowToast={showToast}
        />
      )}

      {/* Global Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
export default App;
