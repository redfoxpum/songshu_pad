import React, { useState } from 'react';
import { ServerStatus, TunnelStatus } from '../types';
import {
  Server,
  Globe,
  Copy,
  Check,
  QrCode,
  RotateCw,
  Power,
  ExternalLink,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

interface HeaderBarProps {
  serverStatus: ServerStatus;
  tunnelStatus: TunnelStatus;
  onRefreshServer: () => void;
  onRestartTunnel: () => void;
  onOpenQRCode: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  serverStatus,
  tunnelStatus,
  onRefreshServer,
  onRestartTunnel,
  onOpenQRCode,
  onNotify,
}) => {
  const [copied, setCopied] = useState(false);
  const [isRestartingTunnel, setIsRestartingTunnel] = useState(false);

  const isServerRunning = serverStatus.status === 'running';
  const isTunnelConnected = tunnelStatus.status === 'connected' && !!tunnelStatus.publicUrl;
  const isTunnelConnecting = tunnelStatus.status === 'connecting';

  const displayUrl = tunnelStatus.publicUrl || serverStatus.url || 'http://127.0.0.1:3000';

  const handleCopyPublicUrl = async () => {
    try {
      if (window.electronAPI?.copyText) {
        await window.electronAPI.copyText(displayUrl);
      } else {
        await navigator.clipboard.writeText(displayUrl);
      }
      setCopied(true);
      onNotify('已复制公网访问链接', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('复制失败', 'error');
    }
  };

  const handleOpenPublicUrl = () => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(displayUrl);
    } else {
      window.open(displayUrl, '_blank');
    }
  };

  const handleRestartTunnel = async () => {
    setIsRestartingTunnel(true);
    try {
      onRestartTunnel();
      onNotify('正在重启 Cloudflare 隧道...', 'info');
      setTimeout(() => setIsRestartingTunnel(false), 2500);
    } catch {
      setIsRestartingTunnel(false);
    }
  };

  return (
    <header className="h-14 bg-[#0D111D] border-b border-[#1F293D] flex items-center justify-between px-4 select-none titlebar-drag-region shrink-0">
      {/* Left traffic lights space & Branding */}
      <div className="flex items-center gap-3 pl-16 titlebar-no-drag">
        <div className="flex items-center gap-2">
          <span className="text-xl">🐿️</span>
          <span className="font-bold text-sm text-white tracking-tight">松鼠Pad</span>
          <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-semibold border border-emerald-500/30">
            Host Server
          </span>
        </div>
      </div>

      {/* Center: Public / Local URL Bar */}
      <div className="flex items-center gap-2 max-w-lg w-full mx-4 titlebar-no-drag">
        <div className="flex-1 flex items-center justify-between bg-[#151D30] border border-slate-700/60 rounded-xl px-3 py-1.5 shadow-inner">
          <div className="flex items-center gap-2 min-w-0 mr-2">
            {isTunnelConnected ? (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : isTunnelConnecting ? (
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-slate-500 shrink-0"></span>
            )}
            <span className="text-xs font-mono text-slate-300 truncate select-all">{displayUrl}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleCopyPublicUrl}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors"
              title="复制公网链接"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleOpenPublicUrl}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors"
              title="在浏览器中打开"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onOpenQRCode}
              className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 rounded-lg transition-colors"
              title="查看分享二维码"
            >
              <QrCode className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right: Status Indicators & Controls */}
      <div className="flex items-center gap-2.5 titlebar-no-drag">
        {/* Server Status Chip */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${
            isServerRunning
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}
          title={isServerRunning ? `本地服务正常运行: Port ${serverStatus.port}` : '本地服务异常'}
        >
          <Server className="w-3.5 h-3.5" />
          <span>端口 {serverStatus.port}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${isServerRunning ? 'bg-emerald-400' : 'bg-rose-400'}`} />
        </div>

        {/* Cloudflare Tunnel Status Chip */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${
            isTunnelConnected
              ? 'bg-sky-950/40 border-sky-500/30 text-sky-300'
              : isTunnelConnecting
              ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}
          title={
            isTunnelConnected
              ? `Cloudflare Tunnel 连通正常 (${tunnelStatus.publicUrl})`
              : isTunnelConnecting
              ? '正在建立公网隧道...'
              : 'Cloudflare Tunnel 离线'
          }
        >
          <Globe className="w-3.5 h-3.5" />
          <span>
            {isTunnelConnected
              ? '公网隧道'
              : isTunnelConnecting
              ? '建立中...'
              : '隧道离线'}
          </span>
          <button
            onClick={handleRestartTunnel}
            disabled={isRestartingTunnel}
            className="p-0.5 hover:bg-white/10 rounded transition-colors"
            title="重启 Cloudflare 隧道"
          >
            <RotateCw className={`w-3 h-3 ${isRestartingTunnel ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
