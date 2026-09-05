import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RoomItem,
  ScreenshotInfo,
  CandidateAgentStatus,
  ServerStatus,
  TunnelStatus,
  ToastNotification,
} from './types';
import {
  fetchRooms,
  fetchScreenshots,
  triggerCapture,
  deleteScreenshot,
  closeRoom,
  reopenRoom,
  fetchAgentStatus,
} from './utils/api';
import { HeaderBar } from './components/HeaderBar';
import { RoomSidebar } from './components/RoomSidebar';
import { RoomHeader } from './components/RoomHeader';
import { CandidateCard } from './components/CandidateCard';
import { ActionBar } from './components/ActionBar';
import { ScreenshotGallery } from './components/ScreenshotGallery';
import { CreateRoomModal } from './components/CreateRoomModal';
import { DeleteRoomModal } from './components/DeleteRoomModal';
import { QRCodeModal } from './components/QRCodeModal';
import { ImageViewerModal } from './components/ImageViewerModal';
import { ToastContainer } from './components/Toast';
import { Layers, ShieldCheck } from 'lucide-react';

export const App: React.FC = () => {
  // Server & Tunnel State
  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    status: 'running',
    port: 3000,
    url: 'http://127.0.0.1:3000',
    isEmbedded: false,
    lastChecked: Date.now(),
  });

  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus>({
    status: 'connecting',
    publicUrl: null,
    logs: [],
  });

  // Room & Gallery State
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<ScreenshotInfo[]>([]);
  const [candidateStatus, setCandidateStatus] = useState<CandidateAgentStatus | undefined>(undefined);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isLoadingScreenshots, setIsLoadingScreenshots] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');

  // Modals & Lightbox
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false);
  const [viewingScreenshot, setViewingScreenshot] = useState<ScreenshotInfo | null>(null);
  const [isClosingRoom, setIsClosingRoom] = useState(false);
  const [isReopeningRoom, setIsReopeningRoom] = useState(false);

  // Toast System
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Electron IPC Listeners
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getServerStatus().then(setServerStatus).catch(() => {});
      window.electronAPI.getTunnelStatus().then(setTunnelStatus).catch(() => {});

      const unbindServer = window.electronAPI.onServerStatusChanged((status) => {
        setServerStatus(status);
      });

      const unbindTunnel = window.electronAPI.onTunnelStatusChanged((status) => {
        setTunnelStatus(status);
      });

      return () => {
        unbindServer();
        unbindTunnel();
      };
    }
  }, []);

  // Load Rooms list
  const loadRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    try {
      const roomList = await fetchRooms();
      setRooms(roomList);

      // Auto-select first active room if none selected
      setSelectedRoomId((current) => {
        if (!current && roomList.length > 0) {
          const firstActive = roomList.find((r) => r.status !== 'closed');
          return firstActive ? firstActive.id : roomList[0].id;
        }
        return current;
      });
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  // Load Screenshots for currently selected room
  const loadScreenshots = useCallback(async (roomId: string) => {
    setIsLoadingScreenshots(true);
    try {
      const list = await fetchScreenshots(roomId);
      setScreenshots(list);

      const agent = await fetchAgentStatus(roomId);
      if (agent) setCandidateStatus(agent);
    } catch (err) {
      console.error('Failed to load screenshots:', err);
    } finally {
      setIsLoadingScreenshots(false);
    }
  }, []);

  // Polling Loop for fresh screenshots and rooms
  useEffect(() => {
    loadRooms();
    const interval = setInterval(() => {
      loadRooms();
      if (selectedRoomId) {
        loadScreenshots(selectedRoomId);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [loadRooms, loadScreenshots, selectedRoomId]);

  // When selectedRoomId changes, reload its screenshots immediately
  useEffect(() => {
    if (selectedRoomId) {
      loadScreenshots(selectedRoomId);
    } else {
      setScreenshots([]);
      setCandidateStatus(undefined);
    }
  }, [selectedRoomId, loadScreenshots]);

  // Trigger On-Demand Capture
  const handleOnDemandCapture = async () => {
    if (!selectedRoomId) return;

    setIsCapturing(true);
    addToast('📸 正在向候选人桌面端发送即时截屏指令...', 'info');

    try {
      const res = await triggerCapture(selectedRoomId);
      if (res.success) {
        addToast(`⚡ ${res.message || '截屏已成功抓取并存入时间线'}`, 'success');
        if (res.screenshot) {
          setScreenshots((prev) => {
            const exists = prev.some((s) => s.filename === res.screenshot!.filename);
            if (exists) return prev;
            return [res.screenshot!, ...prev];
          });
        }
        await loadScreenshots(selectedRoomId);
        setTimeout(() => loadScreenshots(selectedRoomId), 600);
        setTimeout(() => loadScreenshots(selectedRoomId), 1500);
      } else {
        addToast(`⚠️ ${res.message || '当前房间暂无在线的桌面监控端'}`, 'warning');
      }
    } catch (err: any) {
      addToast(`截屏异常: ${err.message || '网络连接失败'}`, 'error');
    } finally {
      setIsCapturing(false);
    }
  };

  // Delete Screenshot
  const handleDeleteScreenshot = async (filename: string) => {
    if (!selectedRoomId) return;
    try {
      const ok = await deleteScreenshot(selectedRoomId, filename);
      if (ok) {
        addToast('已删除此截图', 'info');
        setScreenshots((prev) => prev.filter((s) => s.filename !== filename));
        if (viewingScreenshot?.filename === filename) {
          setViewingScreenshot(null);
        }
      }
    } catch (err) {
      addToast('删除截图失败', 'error');
    }
  };

  // Delete / Close Room
  const handleConfirmCloseRoom = async (roomId: string) => {
    setIsClosingRoom(true);
    try {
      const res = await closeRoom(roomId);
      if (res.success) {
        addToast(`🔒 房间 ${roomId} 已安全关闭并归档，外部访问已阻断（磁盘数据完整保留）`, 'success');
        setIsDeleteModalOpen(false);
        await loadRooms();
      } else {
        addToast(`关闭房间失败: ${res.message}`, 'error');
      }
    } catch (err: any) {
      addToast(`关闭房间异常: ${err.message}`, 'error');
    } finally {
      setIsClosingRoom(false);
    }
  };

  // Reopen Room
  const handleReopenRoom = async (roomId: string) => {
    setIsReopeningRoom(true);
    try {
      const res = await reopenRoom(roomId);
      if (res.success) {
        addToast(`🔓 房间 ${roomId} 已重新开启并允许访问`, 'success');
        await loadRooms();
      } else {
        addToast(`重新开启失败: ${res.message}`, 'error');
      }
    } catch (err: any) {
      addToast(`重新开启异常: ${err.message}`, 'error');
    } finally {
      setIsReopeningRoom(false);
    }
  };

  // Selected Room Object
  const currentRoom = rooms.find((r) => r.id === selectedRoomId);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0B0F19] text-slate-100 overflow-hidden select-none">
      {/* Top Header Bar */}
      <HeaderBar
        serverStatus={serverStatus}
        tunnelStatus={tunnelStatus}
        onRefreshServer={() => window.electronAPI?.checkServerHealth()}
        onRestartTunnel={() => window.electronAPI?.restartTunnel()}
        onOpenQRCode={() => setIsQRCodeModalOpen(true)}
        onNotify={addToast}
      />

      {/* Main Workspace Layout: Sidebar + Dashboard */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <RoomSidebar
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          onSelectRoom={(id) => setSelectedRoomId(id)}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          onRefresh={loadRooms}
          isLoading={isLoadingRooms}
        />

        {/* Right Dashboard Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0B0F19] overflow-hidden">
          {currentRoom ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Room Header Info & Link Share */}
              <RoomHeader
                room={currentRoom}
                publicUrl={tunnelStatus.publicUrl}
                localUrl={serverStatus.url}
                onNotify={addToast}
                onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
                onReopenRoom={() => handleReopenRoom(currentRoom.id)}
                isReopening={isReopeningRoom}
              />

              {/* Scrollable Dashboard Body */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4 flex flex-col min-h-0">
                {/* Candidate Agent Status Card */}
                <CandidateCard
                  status={candidateStatus || currentRoom.candidateStatus}
                  roomId={currentRoom.id}
                  serverUrl={tunnelStatus.publicUrl || serverStatus.url}
                  onNotify={addToast}
                />

                {/* Control Action Bar */}
                <ActionBar
                  onCapture={handleOnDemandCapture}
                  onRefresh={() => loadScreenshots(currentRoom.id)}
                  isCapturing={isCapturing}
                  isLoading={isLoadingScreenshots}
                  count={screenshots.length}
                  viewMode={viewMode}
                  onToggleViewMode={setViewMode}
                />

                {/* Screenshot Timeline & Gallery Grid */}
                <ScreenshotGallery
                  screenshots={screenshots}
                  roomId={currentRoom.id}
                  onSelectImage={(item) => setViewingScreenshot(item)}
                  onDeleteScreenshot={handleDeleteScreenshot}
                  viewMode={viewMode}
                  onTriggerCapture={handleOnDemandCapture}
                />
              </div>
            </div>
          ) : (
            /* Empty State: No room selected */
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="p-5 bg-[#111827] border border-[#1F293D] rounded-3xl text-emerald-400 mb-4 shadow-xl">
                <Layers className="w-12 h-12 stroke-[1.5]" />
              </div>
              <h2 className="text-lg font-bold text-white mb-1">未选择或创建任何面试房间</h2>
              <p className="text-xs text-slate-400 max-w-sm mb-6">
                请在左侧侧边栏中选择一个已有房间，或点击下方的“创建新面试房间”开始协同监控。
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition-all active:scale-95"
              >
                <span>➕ 创建新房间</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Modals & Fullscreen Lightbox */}
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newRoom) => {
          setRooms((prev) => [newRoom, ...prev]);
          setSelectedRoomId(newRoom.id);
        }}
        onNotify={addToast}
      />

      <DeleteRoomModal
        isOpen={isDeleteModalOpen}
        room={currentRoom || null}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmCloseRoom}
        isProcessing={isClosingRoom}
      />

      <QRCodeModal
        isOpen={isQRCodeModalOpen}
        onClose={() => setIsQRCodeModalOpen(false)}
        publicUrl={tunnelStatus.publicUrl}
        localUrl={serverStatus.url}
        currentRoomId={selectedRoomId || undefined}
        onNotify={addToast}
      />

      <ImageViewerModal
        screenshot={viewingScreenshot}
        screenshots={screenshots}
        roomId={selectedRoomId || ''}
        onClose={() => setViewingScreenshot(null)}
        onNavigate={(item) => setViewingScreenshot(item)}
        onNotify={addToast}
      />

      {/* Floating Toast Notification Stack */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default App;
