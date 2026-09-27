import React from 'react';
import { RoomItem } from '../types';
import { Trash2, AlertOctagon, AlertTriangle, X } from 'lucide-react';

interface BulkDeleteModalProps {
  isOpen: boolean;
  rooms: RoomItem[];
  onClose: () => void;
  onConfirm: (roomIds: string[]) => void;
  isProcessing?: boolean;
}

export const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({
  isOpen,
  rooms,
  onClose,
  onConfirm,
  isProcessing = false,
}) => {
  if (!isOpen || rooms.length === 0) return null;

  const getLanguageIcon = (lang: string) => {
    if (lang === 'cpp') return '⚡';
    if (lang === 'java') return '☕';
    return '🐍';
  };

  const totalScreenshots = rooms.reduce((acc, r) => acc + (r.screenshotCount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-[#111827] border border-rose-600/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-rose-500/20">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
              <Trash2 className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>批量彻底删除面试房间</span>
                <span className="bg-rose-950/90 text-rose-300 border border-rose-800/80 text-xs px-2 py-0.5 rounded-full font-mono font-semibold">
                  {rooms.length} 个
                </span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-600/30 text-rose-300 border border-rose-500/40">
                  不可逆
                </span>
              </h3>
              <p className="text-xs text-rose-300/80">从本地磁盘永久抹除所选房间数据与所有截图，无法恢复</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Target Rooms Summary & List */}
          <div className="bg-[#151D30] border border-slate-700/60 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800">
              <span className="font-semibold text-slate-300">目标删除房间列表 ({rooms.length})</span>
              <span>累计截图: <strong className="text-rose-400 font-mono">{totalScreenshots}</strong> 张</span>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0">{getLanguageIcon(room.language)}</span>
                    <span className="font-medium text-slate-200 truncate">{room.name || room.id}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {room.screenshotCount > 0 && (
                      <span className="text-[10px] text-slate-400">
                        {room.screenshotCount} 张图
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                      {room.id}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Danger Warning */}
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/60 border border-rose-600/50 text-xs text-rose-200">
              <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-rose-300">本地磁盘数据将被物理清空</span>
                <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                  所选 <strong>{rooms.length}</strong> 个房间的代码协同文件（<code>doc.bin</code> / <code>code.txt</code>）、累计 <strong>{totalScreenshots}</strong> 张截图及元数据均将被<strong>从本地磁盘中永久抹除，无法撤销或恢复</strong>。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-950/30 border border-amber-600/30 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300">外部连接立即切断</span>
                <p className="text-slate-300 text-[11px] mt-0.5">
                  所有正在连接的候选人网页端及桌面监控 Agent 将被立即切断断开。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#0D111D] border-t border-slate-800/80 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-xl transition-all"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onConfirm(rooms.map((r) => r.id))}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/25 transition-all active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? (
              <span>正在批量彻底删除中...</span>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>确认批量彻底删除 ({rooms.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export const BulkCloseModal = BulkDeleteModal;
export default BulkDeleteModal;
