import React from 'react';
import { AgentStatus } from '../../types/ipc';
import { ShieldCheck, ChevronDown } from 'lucide-react';

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
      className="dynamic-capsule px-3 py-2 flex items-center justify-between gap-2.5 cursor-pointer select-none rounded-full app-drag group shadow-lg"
      title="点击展开代码窗口"
    >
      {/* Left: Brand Icon + Pulse Dot + Room ID */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm leading-none drop-shadow">🐿️</span>
        <div className="relative flex items-center justify-center">
          <span
            className={`w-2 h-2 rounded-full ${
              status.reconnecting ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
          ></span>
          <span
            className={`absolute w-3.5 h-3.5 rounded-full ${
              status.reconnecting
                ? 'bg-amber-400/40 animate-ping'
                : 'bg-emerald-400/40 animate-ping'
            }`}
          ></span>
        </div>
        <span className="text-[11px] font-mono font-medium text-slate-200 truncate max-w-[100px] tracking-tight">
          {status.reconnecting
            ? `重连中${status.reconnectAttempt ? `(#${status.reconnectAttempt})` : ''}`
            : status.roomId || '伴侣在线'}
        </span>
      </div>

      {/* Right: Stealth & Click-Through Status */}
      <div className="flex items-center gap-1.5 text-[10px]">
        {/* Stealth badge */}
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[9px] font-medium"
          title="防录屏隐形已激活"
        >
          <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
          <span>隐形</span>
        </span>

        {/* Mouse click through badge */}
        <span
          className={`px-1.5 py-0.5 rounded-full font-mono text-[9px] font-medium border transition-colors ${
            status.clickThrough
              ? 'bg-purple-950/80 text-purple-300 border-purple-500/40 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
              : 'bg-slate-800/80 text-slate-400 border-slate-700/60'
          }`}
        >
          {status.clickThrough ? '🖱️ 穿透' : '🖱️ 交互'}
        </span>

        <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-200 transition-colors" />
      </div>
    </div>
  );
};
