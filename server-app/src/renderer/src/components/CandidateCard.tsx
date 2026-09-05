import React, { useState } from 'react';
import { CandidateAgentStatus } from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  Wifi,
  Laptop,
  KeyRound,
  Check,
} from 'lucide-react';
import { encodeConnectionToken } from '../utils/token';

interface CandidateCardProps {
  status?: CandidateAgentStatus;
  roomId?: string;
  serverUrl?: string;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({
  status,
  roomId,
  serverUrl = 'http://127.0.0.1:3000',
  onNotify,
}) => {
  const [copiedToken, setCopiedToken] = useState(false);
  const isConnected = status?.connected || false;
  const agentName = status?.agentName || '桌面端未连接';
  const permission = status?.permissionStatus || 'unknown';
  const ip = status?.ip || '127.0.0.1';
  const latency = status?.latencyMs ?? (isConnected ? 12 : null);

  const handleCopyToken = async () => {
    if (!roomId) return;
    try {
      const token = encodeConnectionToken(serverUrl, roomId);
      if (window.electronAPI?.copyText) {
        await window.electronAPI.copyText(token);
      } else {
        await navigator.clipboard.writeText(token);
      }
      setCopiedToken(true);
      onNotify?.('🛡️ 已复制被控端无痕口令 (已安全加密隐藏服务器地址)', 'success');
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      onNotify?.('复制口令失败', 'error');
    }
  };

  const getPermissionBadge = () => {
    if (!isConnected) {
      return (
        <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium bg-slate-800 text-slate-400 border border-slate-700">
          <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
          <span>等待连接</span>
        </span>
      );
    }

    if (permission === 'normal' || permission === 'unknown') {
      return (
        <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>录屏权限: ✅ 正常</span>
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium bg-rose-950/60 text-rose-300 border border-rose-500/40">
        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
        <span>录屏权限: ⚠️ 未授权</span>
      </span>
    );
  };

  return (
    <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-4 shadow-sm select-none">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Device & Candidate Agent Name */}
        <div className="flex items-center gap-3.5">
          <div
            className={`p-3 rounded-xl border ${
              isConnected
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            <Laptop className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                {isConnected ? agentName : '候选人桌面监控端'}
              </h3>
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : 'bg-slate-600'
                }`}
              />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isConnected
                ? '桌面监控代理在线 · 30秒自动截屏中'
                : '候选人可通过桌面被控端输入单一口令接入此房间'}
            </p>
          </div>
        </div>

        {/* Right: Metrics & Badges & Quick Action */}
        <div className="flex items-center gap-3">
          {/* Quick Copy Token Button when not connected */}
          {!isConnected && roomId && (
            <button
              onClick={handleCopyToken}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                copiedToken
                  ? 'bg-amber-950/80 border-amber-500/70 text-amber-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:text-amber-100 hover:bg-amber-500/20'
              }`}
              title="一键复制被控端单一加密口令"
            >
              {copiedToken ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>已复制口令</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>复制被控端口令</span>
                </>
              )}
            </button>
          )}

          {/* IP & Latency */}
          {isConnected && (
            <div className="flex items-center gap-2 bg-[#151D30] border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs text-slate-300">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono">{ip}</span>
              {latency !== null && (
                <span className="text-[11px] text-emerald-400/90 font-mono font-medium">
                  {latency}ms
                </span>
              )}
            </div>
          )}

          {/* Screen Recording Permission Badge */}
          {getPermissionBadge()}
        </div>
      </div>
    </div>
  );
};
