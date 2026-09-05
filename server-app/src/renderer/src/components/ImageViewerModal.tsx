import React, { useEffect, useCallback } from 'react';
import { ScreenshotInfo } from '../types';
import { formatBytes } from '../utils/api';
import {
  X,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Clock,
  Zap,
  Download,
  ExternalLink,
} from 'lucide-react';

interface ImageViewerModalProps {
  screenshot: ScreenshotInfo | null;
  screenshots: ScreenshotInfo[];
  roomId: string;
  onClose: () => void;
  onNavigate: (screenshot: ScreenshotInfo) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  screenshot,
  screenshots,
  roomId,
  onClose,
  onNavigate,
  onNotify,
}) => {
  const currentIndex = screenshot
    ? screenshots.findIndex((s) => s.filename === screenshot.filename)
    : -1;

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(screenshots[currentIndex - 1]);
    }
  }, [currentIndex, screenshots, onNavigate]);

  const handleNext = useCallback(() => {
    if (currentIndex < screenshots.length - 1 && currentIndex >= 0) {
      onNavigate(screenshots[currentIndex + 1]);
    }
  }, [currentIndex, screenshots, onNavigate]);

  // Keyboard Navigation Listeners
  useEffect(() => {
    if (!screenshot) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screenshot, handlePrev, handleNext, onClose]);

  if (!screenshot) return null;

  const BASE_URL = 'http://127.0.0.1:3000';
  const fullImageUrl = `${BASE_URL}${screenshot.url}`;
  const isInstant = screenshot.type === 'instant';

  const handleOpenInFinder = async () => {
    try {
      if (window.electronAPI?.openRoomScreenshots) {
        const res = await window.electronAPI.openRoomScreenshots(roomId);
        if (res.success) {
          onNotify('📁 已在 Finder 中打开截图目录', 'success');
        } else {
          onNotify(`打开 Finder 失败: ${res.error}`, 'error');
        }
      }
    } catch (err: any) {
      onNotify(`打开 Finder 失败: ${err.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Top Header */}
      <div className="h-16 px-6 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          {isInstant ? (
            <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500 text-black shadow">
              <Zap className="w-3.5 h-3.5 fill-current" /> 即时截屏
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-800 text-sky-300 border border-sky-500/30">
              <Clock className="w-3.5 h-3.5" /> 30s 定时抓取
            </span>
          )}

          <div>
            <h3 className="text-sm font-semibold text-white">
              {screenshot.formattedTime || new Date(screenshot.timestamp).toLocaleString('zh-CN')}
            </h3>
            <p className="text-xs font-mono text-slate-400">
              {screenshot.filename} · {formatBytes(screenshot.sizeBytes)} · 序号 #{screenshots.length - currentIndex} / {screenshots.length}
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenInFinder}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-colors"
            title="在 macOS Finder 中查看此截图文件"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>在 Finder 中定位</span>
          </button>

          <a
            href={fullImageUrl}
            target="_blank"
            rel="noreferrer"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors"
            title="在新标签页中打开全分辨率图片"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition-colors ml-2"
            title="关闭 (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image View Area */}
      <div className="flex-1 relative flex items-center justify-center p-6 overflow-hidden">
        {/* Navigation Arrow Left */}
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="absolute left-6 z-10 p-3 bg-slate-900/80 hover:bg-emerald-600 text-white rounded-2xl border border-slate-700/80 backdrop-blur shadow-2xl transition-all hover:scale-110 active:scale-95"
            title="上一张 (← 键盘左键)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* High-Res Image */}
        <div className="max-w-full max-h-full flex items-center justify-center">
          <img
            src={fullImageUrl}
            alt={screenshot.filename}
            className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl border border-slate-800/80 animate-in zoom-in-95 duration-150"
          />
        </div>

        {/* Navigation Arrow Right */}
        {currentIndex < screenshots.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-6 z-10 p-3 bg-slate-900/80 hover:bg-emerald-600 text-white rounded-2xl border border-slate-700/80 backdrop-blur shadow-2xl transition-all hover:scale-110 active:scale-95"
            title="下一张 (→ 键盘右键)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom bar helper */}
      <div className="h-10 bg-slate-950/90 border-t border-slate-900 flex items-center justify-center text-xs text-slate-500 font-mono">
        按 ← / → 键切换图片 · 按 Esc 键退出大图模式
      </div>
    </div>
  );
};
