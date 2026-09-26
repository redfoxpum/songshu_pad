import React from 'react';
import { AgentStatus } from '../../types/ipc';
import { ShieldCheck, ChevronDown, MousePointer } from 'lucide-react';

interface FloatingHUDProps {
  status: AgentStatus;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const FloatingHUD: React.FC<FloatingHUDProps> = ({
  status,
  onToggleCollapse,
}) => {
  return (
    <div
      onClick={onToggleCollapse}
      className="dynamic-capsule px-3.5 py-2 flex items-center justify-between gap-3 cursor-pointer select-none rounded-full app-drag group shadow-2xl transition-all duration-200"
      title={status.roomId ? `当前房间: ${status.roomId} · 点击展开代码窗口` : '点击展开松鼠Pad代码窗口'}
    >
      {/* Left: Brand Mascot + Status Indicator + Room Badge */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative flex items-center justify-center">
          <span className="text-sm leading-none drop-shadow-sm select-none">🐿️</span>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black/80 ${
              status.reconnecting ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
          />
        </div>

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-white/95 font-sans tracking-tight">
            {status.reconnecting
              ? `重连中${status.reconnectAttempt ? ` (#${status.reconnectAttempt})` : ''}`
              : status.connected
              ? '协同中'
              : '松鼠伴侣'}
          </span>
          {status.connected && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 animate-pulse hidden sm:inline-block" />
          )}
        </div>
      </div>

      {/* Right: Stealth & Click-Through Micro Badges */}
      <div className="flex items-center gap-1.5 text-[11px] font-sans">
        {/* Stealth badge */}
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[10px] font-medium"
          title="防录屏隐形已激活 · 屏幕共享完全不可见"
        >
          <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
          <span className="tracking-tight">防录屏</span>
        </span>

        {/* Click through badge */}
        {status.clickThrough && (
          <span
            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/35 text-purple-200 text-[10px] font-medium shadow-[0_0_8px_rgba(168,85,247,0.3)]"
            title="鼠标穿透已激活"
          >
            <MousePointer className="w-2.5 h-2.5" />
            <span>穿透</span>
          </span>
        )}

        <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors ml-0.5">
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-100 transition-transform group-hover:translate-y-0.5" />
        </div>
      </div>
    </div>
  );
};
