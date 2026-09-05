import React, { useState } from 'react';
import { RoomItem } from '../types';
import { formatRelativeTime } from '../utils/api';
import { Plus, Search, Layers, Image as ImageIcon, RefreshCw, Lock, Radio } from 'lucide-react';

interface RoomSidebarProps {
  rooms: RoomItem[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onOpenCreateModal: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const RoomSidebar: React.FC<RoomSidebarProps> = ({
  rooms,
  selectedRoomId,
  onSelectRoom,
  onOpenCreateModal,
  onRefresh,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusTab, setStatusTab] = useState<'all' | 'active' | 'closed'>('active');

  const activeCount = rooms.filter((r) => r.status !== 'closed').length;
  const closedCount = rooms.filter((r) => r.status === 'closed').length;

  const filteredRooms = rooms.filter((r) => {
    if (statusTab === 'active' && r.status === 'closed') return false;
    if (statusTab === 'closed' && r.status !== 'closed') return false;

    const term = searchTerm.toLowerCase();
    return (
      r.id.toLowerCase().includes(term) ||
      (r.name && r.name.toLowerCase().includes(term)) ||
      r.language.toLowerCase().includes(term)
    );
  });

  const getLanguageIcon = (lang: string) => {
    if (lang === 'cpp') return '⚡';
    if (lang === 'java') return '☕';
    return '🐍';
  };

  return (
    <aside className="w-80 bg-[#0D111D] border-r border-[#1F293D] flex flex-col shrink-0 select-none">
      {/* Top Action & Search */}
      <div className="p-3.5 border-b border-[#1F293D] space-y-3">
        {/* Create Room Button */}
        <button
          onClick={onOpenCreateModal}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>创建新面试房间</span>
        </button>

        {/* Search Bar & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索候选人或房间号..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#151D30] border border-slate-700/60 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 bg-[#151D30] border border-slate-700/60 hover:bg-slate-700/60 text-slate-400 hover:text-white rounded-lg transition-colors"
            title="刷新房间列表"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        {/* Filter Tabs: 全部 / 进行中 / 已归档 */}
        <div className="grid grid-cols-3 gap-1 bg-[#151D30] p-1 rounded-xl border border-slate-700/50 text-[11px] font-medium">
          <button
            onClick={() => setStatusTab('all')}
            className={`py-1 rounded-lg text-center transition-all ${
              statusTab === 'all'
                ? 'bg-[#1E293B] text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            全部 ({rooms.length})
          </button>
          <button
            onClick={() => setStatusTab('active')}
            className={`py-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
              statusTab === 'active'
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>进行中 ({activeCount})</span>
          </button>
          <button
            onClick={() => setStatusTab('closed')}
            className={`py-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
              statusTab === 'closed'
                ? 'bg-slate-800 text-slate-300 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-2.5 h-2.5" />
            <span>已归档 ({closedCount})</span>
          </button>
        </div>
      </div>

      {/* Room List Header */}
      <div className="px-4 py-2 flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-[#0B0F19]/40 border-b border-[#1F293D]/50">
        <span>房间列表 ({filteredRooms.length})</span>
        <span>状态 / 截图</span>
      </div>

      {/* Room List Scrollable */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredRooms.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
            <p className="text-xs text-slate-400 font-medium">
              {searchTerm ? '未匹配到任何房间' : statusTab === 'closed' ? '暂无已归档房间' : '暂无进行中的房间'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              点击上方按钮立即创建新面试空间
            </p>
          </div>
        ) : (
          filteredRooms.map((room) => {
            const isSelected = selectedRoomId === room.id;
            const isClosed = room.status === 'closed';
            const isAgentConnected = !isClosed && (room.candidateStatus?.connected || false);

            return (
              <div
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className={`group p-3 rounded-xl cursor-pointer transition-all border ${
                  isSelected
                    ? isClosed
                      ? 'bg-[#151D30] border-slate-600 shadow-md ring-1 ring-slate-500/30'
                      : 'bg-[#151D30] border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                    : isClosed
                    ? 'bg-[#111827]/40 border-transparent opacity-75 hover:opacity-100 hover:bg-[#151D30]/60 hover:border-slate-800'
                    : 'bg-[#111827]/60 border-transparent hover:bg-[#151D30]/80 hover:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base shrink-0">{getLanguageIcon(room.language)}</span>
                    <h4
                      className={`text-xs font-semibold truncate ${
                        isSelected ? 'text-white' : isClosed ? 'text-slate-400' : 'text-slate-200 group-hover:text-white'
                      }`}
                    >
                      {room.name || room.id}
                    </h4>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isClosed ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                        <Lock className="w-2.5 h-2.5 text-slate-400" />
                        <span>已归档</span>
                      </span>
                    ) : (
                      <div
                        className="flex items-center gap-1"
                        title={isAgentConnected ? '候选人监控端在线' : '监控端离线'}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isAgentConnected
                              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                              : 'bg-slate-600'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Slug Badge & Screenshot Count */}
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <div className="font-mono text-slate-400 truncate bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800/80">
                    {room.id}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {room.screenshotCount > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-sky-400 bg-sky-950/50 px-1.5 py-0.5 rounded border border-sky-800/40">
                        <ImageIcon className="w-2.5 h-2.5" />
                        <span>{room.screenshotCount}</span>
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500">
                      {formatRelativeTime(room.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
