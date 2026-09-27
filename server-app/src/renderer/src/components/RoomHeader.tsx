import React, { useState } from 'react';
import { RoomItem } from '../types';
import {
  Folder,
  Copy,
  Check,
  ExternalLink,
  Share2,
  Hash,
  Lock,
  Trash2,
  RotateCcw,
  Link,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { encodeConnectionToken } from '../utils/token';

interface RoomHeaderProps {
  room: RoomItem;
  publicUrl: string | null;
  localUrl: string;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onOpenDeleteModal: () => void;
  onReopenRoom: () => void;
  isReopening?: boolean;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  room,
  publicUrl,
  localUrl,
  onNotify,
  onOpenDeleteModal,
  onReopenRoom,
  isReopening = false,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isOpeningFinder, setIsOpeningFinder] = useState(false);

  const isClosed = room.status === 'closed';
  const baseUrl = publicUrl || localUrl || 'http://127.0.0.1:3000';
  const fullRoomUrl = `${baseUrl}/room/${room.id}`;

  const handleCopyLink = async () => {
    try {
      if (window.electronAPI?.copyText) {
        await window.electronAPI.copyText(fullRoomUrl);
      } else {
        await navigator.clipboard.writeText(fullRoomUrl);
      }
      setCopiedLink(true);
      onNotify('已复制候选人网页房间链接', 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      onNotify('复制失败', 'error');
    }
  };

  const handleCopyToken = async () => {
    try {
      const token = encodeConnectionToken(baseUrl, room.id);
      if (window.electronAPI?.copyText) {
        await window.electronAPI.copyText(token);
      } else {
        await navigator.clipboard.writeText(token);
      }
      setCopiedToken(true);
      onNotify('🛡️ 已复制被控端无痕口令 (已安全加密隐藏服务器地址)', 'success');
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      onNotify('复制口令失败', 'error');
    }
  };

  const handleCopyId = async () => {
    try {
      if (window.electronAPI?.copyText) {
        await window.electronAPI.copyText(room.id);
      } else {
        await navigator.clipboard.writeText(room.id);
      }
      setCopiedId(true);
      onNotify(`已复制房间 ID: ${room.id}`, 'info');
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      onNotify('复制失败', 'error');
    }
  };

  const handleOpenBrowser = () => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(fullRoomUrl);
    } else {
      window.open(fullRoomUrl, '_blank');
    }
  };

  const handleOpenFinder = async () => {
    setIsOpeningFinder(true);
    try {
      if (window.electronAPI?.openRoomScreenshots) {
        const res = await window.electronAPI.openRoomScreenshots(room.id);
        if (res.success) {
          onNotify(`📁 已在 Finder 中打开截图目录`, 'success');
        } else {
          onNotify(`打开 Finder 失败: ${res.error || '未知错误'}`, 'error');
        }
      } else {
        onNotify('当前环境不支持直接调用 macOS Finder', 'warning');
      }
    } catch (err: any) {
      onNotify(`打开 Finder 错误: ${err.message}`, 'error');
    } finally {
      setTimeout(() => setIsOpeningFinder(false), 500);
    }
  };

  const getLanguageDetails = (lang: string) => {
    if (lang === 'cpp') return { name: 'C++ 20', color: 'text-amber-400 bg-amber-950/60 border-amber-800/60' };
    if (lang === 'java') return { name: 'Java 21', color: 'text-orange-400 bg-orange-950/60 border-orange-800/60' };
    return { name: 'Python 3', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60' };
  };

  const langDetails = getLanguageDetails(room.language);

  return (
    <div className="bg-[#111827] border-b border-[#1F293D] p-4 flex flex-wrap items-center justify-between gap-4 select-none">
      {/* Left Room Info */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-white tracking-tight truncate">
              {room.name || room.id}
            </h2>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${langDetails.color}`}
            >
              {langDetails.name}
            </span>
            {isClosed && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-800/60">
                <Lock className="w-3 h-3" />
                <span>已关闭/已归档</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-xs text-slate-400">
            {/* Copy Agent Encrypted Token Button (Hero Action) */}
            <button
              onClick={handleCopyToken}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition-all border ${
                copiedToken
                  ? 'bg-amber-950/80 border-amber-500/70 text-amber-300 shadow-md shadow-amber-950/50'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:text-amber-100 hover:bg-amber-500/20 hover:border-amber-500/50'
              }`}
              title="复制被控端单一加密口令（已隐藏服务器地址与域名，安全免配置）"
            >
              {copiedToken ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>已复制被控端口令</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3 h-3 text-amber-400" />
                  <span>复制被控端口令</span>
                </>
              )}
            </button>

            {/* Room ID with copy */}
            <div className="flex items-center gap-1.5 bg-[#151D30] border border-slate-700/60 px-2 py-0.5 rounded-lg">
              <span className="flex items-center gap-1 font-mono text-slate-300 text-[11px]">
                <Hash className="w-3 h-3 text-slate-500" />
                <span>{room.id}</span>
              </span>
              <button
                onClick={handleCopyId}
                className="p-0.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded transition-colors"
                title="复制房间号码"
              >
                {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            {/* Copy Full Web Link Button */}
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-medium transition-all border ${
                copiedLink
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-sm'
                  : 'bg-[#151D30] border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700/60 hover:border-slate-600'
              }`}
              title={`复制网页端链接: ${fullRoomUrl}`}
            >
              {copiedLink ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>已复制网页链接</span>
                </>
              ) : (
                <>
                  <Link className="w-3 h-3 text-sky-400" />
                  <span>复制网页链接</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5">
        {!isClosed && (
          <div className="flex items-center bg-[#151D30] border border-slate-700/60 rounded-xl px-2.5 py-1.5 gap-2 max-w-xs">
            <Share2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-mono text-slate-300 truncate select-all">{fullRoomUrl}</span>
            <button
              onClick={handleCopyLink}
              className="p-1 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-md transition-colors shrink-0"
              title="复制面试链接"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleOpenBrowser}
              className="p-1 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-md transition-colors shrink-0"
              title="在浏览器中打开"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isClosed && (
          /* Reopen Room Button (Legacy) */
          <button
            onClick={onReopenRoom}
            disabled={isReopening}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
            title="重新开启此房间允许外部进入"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isReopening ? 'animate-spin' : ''}`} />
            <span>重新开启房间</span>
          </button>
        )}

        {/* Delete Room Button */}
        <button
          onClick={onOpenDeleteModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/50 hover:bg-rose-900/70 text-rose-300 hover:text-white text-xs font-semibold rounded-xl border border-rose-800/60 transition-all shadow-sm active:scale-95"
          title="彻底删除此房间及所有本地数据（不可恢复）"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          <span>删除房间</span>
        </button>

        {/* Finder Button */}
        <button
          onClick={handleOpenFinder}
          disabled={isOpeningFinder}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#1F293D] hover:bg-slate-700/80 text-slate-100 text-xs font-semibold rounded-xl border border-slate-600/60 transition-all shadow-sm active:scale-95"
          title="在 macOS Finder 中打开此房间截图文件夹 ./data/rooms/<roomId>/screenshots/"
        >
          <Folder className="w-4 h-4 text-amber-400" />
          <span>在 Finder 中打开截图目录</span>
        </button>
      </div>
    </div>
  );
};
