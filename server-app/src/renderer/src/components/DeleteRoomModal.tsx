import React from 'react';
import { RoomItem } from '../types';
import { Trash2, AlertOctagon, AlertTriangle, X } from 'lucide-react';

interface DeleteRoomModalProps {
  isOpen: boolean;
  room: RoomItem | null;
  onClose: () => void;
  onConfirm: (roomId: string) => void;
  isProcessing?: boolean;
}

export const DeleteRoomModal: React.FC<DeleteRoomModalProps> = ({
  isOpen,
  room,
  onClose,
  onConfirm,
  isProcessing = false,
}) => {
  if (!isOpen || !room) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-[#111827] border border-rose-600/40 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden ring-1 ring-rose-500/20">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
              <Trash2 className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>彻底删除面试房间</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-600/30 text-rose-300 border border-rose-500/40">
                  不可逆
                </span>
              </h3>
              <p className="text-xs text-rose-300/80">永久抹除本地磁盘数据与所有截屏记录</p>
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

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Target Room Card */}
          <div className="bg-[#151D30] border border-slate-700/60 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">目标房间:</span>
              <span className="text-xs font-semibold text-white truncate max-w-[200px]">
                {room.name || room.id}
              </span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
              <span>房间 ID:</span>
              <span className="bg-slate-900 px-2 py-0.5 rounded text-amber-300 border border-slate-800">
                {room.id}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>包含截图:</span>
              <span className="text-sky-400 font-medium">{room.screenshotCount} 张</span>
            </div>
          </div>

          {/* Key Danger Warning */}
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/60 border border-rose-600/50 text-xs text-rose-200">
              <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-rose-300">本地磁盘数据将被物理清空</span>
                <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                  该房间的专属目录（<code>./data/rooms/{room.id}/</code>）、协同代码快照（<code>doc.bin</code>）、所有候选人桌面监控截图及元数据文件将被<strong>永久删除，无法找回</strong>。
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
        <div className="p-4 bg-[#0D111D] border-t border-slate-800/80 flex items-center justify-end gap-2.5">
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
            onClick={() => onConfirm(room.id)}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/25 transition-all active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? (
              <span>正在彻底删除...</span>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>确认彻底删除</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
