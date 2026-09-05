import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, ExternalLink, QrCode, KeyRound, Globe } from 'lucide-react';
import { encodeConnectionToken } from '../utils/token';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicUrl: string | null;
  localUrl: string;
  currentRoomId?: string;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  publicUrl,
  localUrl,
  currentRoomId,
  onNotify,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [usePublic, setUsePublic] = useState(true);

  if (!isOpen) return null;

  const baseUrl = usePublic && publicUrl ? publicUrl : localUrl;
  const targetUrl = currentRoomId ? `${baseUrl}/room/${currentRoomId}` : baseUrl;
  const agentToken = currentRoomId ? encodeConnectionToken(baseUrl, currentRoomId) : '';

  const handleCopyLink = async () => {
    try {
      if (window.electronAPI?.copyText) {
        await window.electronAPI.copyText(targetUrl);
      } else {
        await navigator.clipboard.writeText(targetUrl);
      }
      setCopiedLink(true);
      onNotify('已复制分享链接到剪贴板', 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      onNotify('复制失败', 'error');
    }
  };

  const handleCopyToken = async () => {
    if (!agentToken) return;
    try {
      if (window.electronAPI?.copyText) {
        await window.electronAPI.copyText(agentToken);
      } else {
        await navigator.clipboard.writeText(agentToken);
      }
      setCopiedToken(true);
      onNotify('🛡️ 已复制被控端加密口令 (已安全隐藏服务器地址)', 'success');
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      onNotify('复制口令失败', 'error');
    }
  };

  const handleOpenBrowser = () => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(targetUrl);
    } else {
      window.open(targetUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#111827] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#161F37]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">扫码分享房间与连接凭证</h3>
              <p className="text-xs text-slate-400">支持网页扫码协同或被控端口令连接</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center">
          {/* Target URL Selector */}
          <div className="w-full flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 mb-4">
            <button
              onClick={() => setUsePublic(true)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                usePublic && publicUrl
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🌐 公网隧道链接 {publicUrl ? '' : '(未连接)'}
            </button>
            <button
              onClick={() => setUsePublic(false)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                !usePublic || !publicUrl
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🏠 局域网/本地
            </button>
          </div>

          {/* QR Code Canvas */}
          <div className="p-3.5 bg-white rounded-2xl shadow-inner border-4 border-slate-800/80 mb-4">
            <QRCodeSVG
              value={targetUrl}
              size={180}
              level="M"
              includeMargin={false}
            />
          </div>

          {/* Agent Encrypted Token Box */}
          {agentToken && (
            <div className="w-full bg-amber-950/20 border border-amber-500/30 rounded-xl p-2.5 mb-3 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-amber-300">
                <span className="flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>被控端单一连接口令 (已加密隐藏URL)</span>
                </span>
                <button
                  onClick={handleCopyToken}
                  className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded text-[10px] font-medium transition-colors flex items-center gap-1"
                >
                  {copiedToken ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedToken ? '已复制' : '复制口令'}</span>
                </button>
              </div>
              <div className="text-[10px] font-mono text-slate-400 truncate select-all">
                {agentToken}
              </div>
            </div>
          )}

          {/* Web URL Box */}
          <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <div className="text-xs font-mono text-slate-300 truncate select-all">{targetUrl}</div>
            </div>
            <button
              onClick={handleCopyLink}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors shrink-0 flex items-center gap-1 text-xs"
              title="复制网页链接"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? '已复制' : '复制'}</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex gap-3">
            <button
              onClick={handleOpenBrowser}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>在浏览器打开</span>
            </button>
            <button
              onClick={handleCopyLink}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? '复制成功' : '复制链接'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
