import React from 'react';
import { RoomItem } from '../types';
import { AlertTriangle, ShieldCheck, Lock, X } from 'lucide-react';

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
      <div className="bg-[#111827] border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">关闭 / 归档面试房间</h3>
              <p className="text-xs text-slate-400">阻断外部访问并保留全部历史数据</p>
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
              <span>已记录截图:</span>
              <span className="text-sky-400 font-medium">{room.screenshotCount} 张</span>
            </div>
          </div>

          {/* Key Notice Callout */}
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-300">数据安全完整保留</span>
                <p className="text-slate-300 text-[11px] mt-0.5">
                  所有代码文件（<code>doc.bin</code>）、截图图片与元数据均保存在本地磁盘中，绝不丢失。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-rose-300">立即切断并阻断访问</span>
                <p className="text-slate-300 text-[11px] mt-0.5">
                  已连接的候选人与桌面监控端将被立即断开，后续外部打开链接将显示「房间已关闭」。
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
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? (
              <span>处理中...</span>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>确认关闭房间</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
