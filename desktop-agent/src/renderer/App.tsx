import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgentStatus, ScreenPermissionResult } from '../types/ipc';
import { HeaderBar } from './components/HeaderBar';
import { PermissionGate } from './components/PermissionGate';
import { ConnectionForm } from './components/ConnectionForm';
import { FloatingHUD } from './components/FloatingHUD';
import { PadViewer } from './components/PadViewer';
import { Eye } from 'lucide-react';

const STORAGE_OPACITY = 'squirrel_agent_opacity';
const STORAGE_SIZE = 'squirrel_agent_window_size';

interface WindowDimension {
  width: number;
  height: number;
}

export const App: React.FC = () => {
  const [permissionGranted, setPermissionGranted] = useState<boolean>(true);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [opacity, setOpacity] = useState<number>(0.35);
  const [opacityToast, setOpacityToast] = useState<{ visible: boolean; opacity: number } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showOpacityToast = useCallback((val: number) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setOpacityToast({ visible: true, opacity: val });
    toastTimerRef.current = setTimeout(() => {
      setOpacityToast(null);
    }, 1200);
  }, []);

  const [isOnDemandActive, setIsOnDemandActive] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>('python');
  const [fontSize, setFontSize] = useState<number>(13);
  const [wrapLines, setWrapLines] = useState<boolean>(true);
  const initialCaptureDoneRef = useRef<boolean>(false);

  // Saved window size state (defaults to 640x520)
  const [windowDimension, setWindowDimension] = useState<WindowDimension>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SIZE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.width && parsed.height) {
          return {
            width: Math.max(360, Math.min(2560, parsed.width)),
            height: Math.max(200, Math.min(1600, parsed.height)),
          };
        }
      }
    } catch (e) {}
    return { width: 640, height: 520 };
  });

  const isResizingRef = useRef<boolean>(false);
  const dimensionRef = useRef<WindowDimension>(windowDimension);
  dimensionRef.current = windowDimension;

  const [status, setStatus] = useState<AgentStatus>({
    connected: false,
    connecting: false,
    serverUrl: '',
    roomId: '',
    clickThrough: false,
    lastCaptureTime: null,
    nextScheduledCaptureIn: 30,
    totalCaptures: 0,
    lastError: null,
    isCapturing: false,
  });

  const getSavedServerUrl = (): string => {
    try {
      const saved = localStorage.getItem('squirrel_agent_server_url');
      if (saved && saved.trim()) return saved.trim();
    } catch (e) {
      // ignore
    }
    return 'http://localhost:3000';
  };

  const triggerInitialCapture = useCallback(async () => {
    if (initialCaptureDoneRef.current) return;
    initialCaptureDoneRef.current = true;

    if (window.electronAPI) {
      try {
        const serverUrl = getSavedServerUrl();
        console.log('[Renderer] Immediate screen capture triggered on startup / authorization to:', serverUrl);
        const res = await window.electronAPI.captureAndUploadInitial(serverUrl);
        console.log('[Renderer] Immediate screen capture completed:', res);
      } catch (err) {
        console.error('[Renderer] Immediate screen capture failed:', err);
      }
    }
  }, []);

  // Check screen recording permissions on startup
  const checkPermissions = useCallback(async () => {
    if (window.electronAPI) {
      try {
        const res: ScreenPermissionResult = await window.electronAPI.checkScreenPermission();
        setPermissionGranted(res.granted);
        if (res.granted) {
          triggerInitialCapture();
        }
        return res.granted;
      } catch (err) {
        console.error('Error checking permission:', err);
        return false;
      }
    }
    return true;
  }, [triggerInitialCapture]);

  const handlePermissionGranted = useCallback(() => {
    setPermissionGranted(true);
    triggerInitialCapture();
  }, [triggerInitialCapture]);

  useEffect(() => {
    checkPermissions();

    // Load saved opacity
    try {
      const savedOp = localStorage.getItem(STORAGE_OPACITY);
      if (savedOp) {
        const num = parseFloat(savedOp);
        if (!isNaN(num)) {
          setOpacity(num);
        }
      }
    } catch (e) {}

    // Subscribe to IPC events from main process
    if (window.electronAPI) {
      const unsubStatus = window.electronAPI.onAgentStatusUpdate((newStatus) => {
        setStatus(newStatus);
      });

      const unsubClickThrough = window.electronAPI.onClickThroughToggled((enabled) => {
        setStatus((prev) => ({ ...prev, clickThrough: enabled }));
      });

      const unsubOnDemand = window.electronAPI.onOnDemandTriggered(() => {
        setIsOnDemandActive(true);
        setTimeout(() => setIsOnDemandActive(false), 3500);
      });

      const unsubCaptureDone = window.electronAPI.onCaptureCompleted((result) => {
        console.log('[Renderer] Capture completed:', result);
      });

      const unsubAdjustOpacity = window.electronAPI.onAdjustOpacity((delta) => {
        setOpacity((prev) => {
          const next = Math.max(0.05, Math.min(1.0, Math.round((prev + delta) * 100) / 100));
          try {
            localStorage.setItem(STORAGE_OPACITY, String(next));
          } catch (e) {}
          showOpacityToast(next);
          return next;
        });
      });

      return () => {
        unsubStatus();
        unsubClickThrough();
        unsubOnDemand();
        unsubCaptureDone();
        unsubAdjustOpacity();
      };
    }
  }, [checkPermissions, showOpacityToast]);

  // Handle in-window keyboard shortcuts fallback when window has focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.shiftKey) {
        if (e.code === 'KeyB') {
          e.preventDefault();
          window.electronAPI?.toggleWindowVisibility();
        } else if (e.code === 'BracketLeft' || e.key === '[' || e.key === '{') {
          e.preventDefault();
          setOpacity((prev) => {
            const next = Math.max(0.05, Math.min(1.0, Math.round((prev - 0.05) * 100) / 100));
            try {
              localStorage.setItem(STORAGE_OPACITY, String(next));
            } catch (err) {}
            showOpacityToast(next);
            return next;
          });
        } else if (e.code === 'BracketRight' || e.key === ']' || e.key === '}') {
          e.preventDefault();
          setOpacity((prev) => {
            const next = Math.max(0.05, Math.min(1.0, Math.round((prev + 0.05) * 100) / 100));
            try {
              localStorage.setItem(STORAGE_OPACITY, String(next));
            } catch (err) {}
            showOpacityToast(next);
            return next;
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showOpacityToast]);

  const isSessionActive = status.connected || (Boolean(status.reconnecting) && Boolean(status.roomId));

  // Adjust window size only on major mode changes (collapse/expand/connection), preserving user custom size
  useEffect(() => {
    if (!window.electronAPI) return;

    if (isCollapsed) {
      window.electronAPI.setWindowSize(320, 42);
    } else if (!permissionGranted) {
      window.electronAPI.setWindowSize(400, 380);
    } else if (!isSessionActive) {
      window.electronAPI.setWindowSize(400, 370);
    } else {
      // Use user's custom width and height
      window.electronAPI.setWindowSize(dimensionRef.current.width, dimensionRef.current.height);
    }
  }, [isCollapsed, permissionGranted, isSessionActive]);

  const handleOpacityChange = (newOpacity: number) => {
    setOpacity(newOpacity);
    try {
      localStorage.setItem(STORAGE_OPACITY, String(newOpacity));
    } catch (e) {}
    showOpacityToast(newOpacity);
  };

  const handleConnect = async (serverUrl: string, roomId: string) => {
    if (window.electronAPI) {
      setStatus((prev) => ({ ...prev, connecting: true, lastError: null }));
      const res = await window.electronAPI.connectAgent({ serverUrl, roomId });
      if (!res.success) {
        setStatus((prev) => ({ ...prev, connecting: false, lastError: res.error || '连接失败' }));
      }
    }
  };

  const handleDisconnect = async () => {
    if (window.electronAPI) {
      await window.electronAPI.disconnectAgent();
    }
    setStatus((prev) => ({
      ...prev,
      connected: false,
      connecting: false,
      reconnecting: false,
      roomId: '',
    }));
  };

  const handleToggleClickThrough = async () => {
    if (window.electronAPI) {
      const newState = await window.electronAPI.toggleClickThrough();
      setStatus((prev) => ({ ...prev, clickThrough: newState }));
    }
  };

  const handleFontSizeChange = (delta: number) => {
    setFontSize((prev) => Math.max(10, Math.min(22, prev + delta)));
  };

  // Interactive Drag-to-Resize Handlers
  const handleResizeStart = (
    e: React.MouseEvent,
    direction: 'corner' | 'bottom' | 'right'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;

    const startX = e.screenX;
    const startY = e.screenY;
    const startW = dimensionRef.current.width;
    const startH = dimensionRef.current.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = moveEvent.screenX - startX;
      const deltaY = moveEvent.screenY - startY;

      let newWidth = startW;
      let newHeight = startH;

      if (direction === 'corner' || direction === 'right') {
        newWidth = Math.max(360, Math.min(2560, Math.round(startW + deltaX)));
      }
      if (direction === 'corner' || direction === 'bottom') {
        newHeight = Math.max(200, Math.min(1600, Math.round(startH + deltaY)));
      }

      const updated = { width: newWidth, height: newHeight };
      setWindowDimension(updated);
      window.electronAPI?.setWindowSize(newWidth, newHeight);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      try {
        localStorage.setItem(STORAGE_SIZE, JSON.stringify(dimensionRef.current));
      } catch (e) {}
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="w-full h-full flex flex-col justify-start overflow-hidden rounded-2xl relative select-none">
      {/* Subtle Flash Overlay during server on-demand capture */}
      {isOnDemandActive && (
        <div className="camera-flash-overlay rounded-2xl z-50 pointer-events-none" />
      )}

      {/* Opacity Adjustment HUD Toast */}
      {opacityToast && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95">
          <div className="px-3.5 py-1.5 rounded-full bg-slate-900/95 border border-white/20 shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs font-sans text-white/95">
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium text-slate-300">底板透明度</span>
            <span className="font-mono font-bold text-emerald-400">{Math.round(opacityToast.opacity * 100)}%</span>
            <div className="w-16 h-1.5 bg-slate-700/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-150"
                style={{ width: `${Math.round(opacityToast.opacity * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {isCollapsed ? (
        <FloatingHUD
          status={status}
          isCollapsed={true}
          onToggleCollapse={() => setIsCollapsed(false)}
        />
      ) : (
        <div
          className="liquid-glass w-full h-full flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative transition-colors duration-200"
          style={{
            backgroundColor: `rgba(10, 15, 26, ${Math.max(0.08, opacity)})`,
            backdropFilter: 'blur(28px) saturate(190%)',
            WebkitBackdropFilter: 'blur(28px) saturate(190%)',
          }}
        >
          {/* Top Floating Control Bar */}
          <HeaderBar
            isCollapsed={false}
            onToggleCollapse={() => setIsCollapsed(true)}
            opacity={opacity}
            onOpacityChange={handleOpacityChange}
            isConnected={status.connected}
            isReconnecting={status.reconnecting}
            reconnectAttempt={status.reconnectAttempt}
            roomId={status.roomId}
            language={language}
            clickThrough={status.clickThrough}
            onToggleClickThrough={handleToggleClickThrough}
            fontSize={fontSize}
            onFontSizeChange={handleFontSizeChange}
            wrapLines={wrapLines}
            onToggleWrapLines={() => setWrapLines((prev) => !prev)}
            onDisconnect={handleDisconnect}
          />

          {/* Middle Main Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col relative bg-transparent font-sans">
            {!permissionGranted ? (
              <div className="flex-1 overflow-y-auto bg-transparent">
                <PermissionGate onPermissionGranted={handlePermissionGranted} />
              </div>
            ) : !isSessionActive ? (
              <div className="flex-1 overflow-y-auto bg-transparent">
                <ConnectionForm
                  onConnect={handleConnect}
                  isConnecting={status.connecting}
                  error={status.lastError}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden relative bg-transparent">
                <PadViewer
                  serverUrl={status.serverUrl || getSavedServerUrl()}
                  roomId={status.roomId}
                  fontSize={fontSize}
                  wrapLines={wrapLines}
                  opacity={opacity}
                  onLanguageChange={setLanguage}
                />
              </div>
            )}
          </div>

          {/* Interactive Invisible Edge/Corner Resize Drag Bars (for smooth mouse edge dragging) */}
          {isSessionActive && !isCollapsed && (
            <>
              {/* Bottom Edge Resize Bar */}
              <div
                onMouseDown={(e) => handleResizeStart(e, 'bottom')}
                className="absolute bottom-0 inset-x-0 h-2 cursor-ns-resize z-40 hover:bg-blue-500/20 transition-colors"
                title="按住拖拽调整高度"
              />
              {/* Right Edge Resize Bar */}
              <div
                onMouseDown={(e) => handleResizeStart(e, 'right')}
                className="absolute right-0 inset-y-0 w-2 cursor-ew-resize z-40 hover:bg-blue-500/20 transition-colors"
                title="按住拖拽调整宽度"
              />
              {/* Bottom-Right Corner Resize Bar */}
              <div
                onMouseDown={(e) => handleResizeStart(e, 'corner')}
                className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 hover:bg-blue-500/40 transition-colors"
                title="按住拖拽调整宽高"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};
