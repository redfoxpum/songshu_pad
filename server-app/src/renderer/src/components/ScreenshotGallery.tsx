import React from 'react';
import { ScreenshotInfo } from '../types';
import { formatBytes, formatRelativeTime } from '../utils/api';
import {
  Clock,
  Zap,
  Maximize2,
  Trash2,
  Image as ImageIcon,
  FolderOpen,
  Camera,
} from 'lucide-react';

interface ScreenshotGalleryProps {
  screenshots: ScreenshotInfo[];
  roomId: string;
  onSelectImage: (screenshot: ScreenshotInfo) => void;
  onDeleteScreenshot: (filename: string) => void;
  viewMode: 'grid' | 'timeline';
  onTriggerCapture: () => void;
}

export const ScreenshotGallery: React.FC<ScreenshotGalleryProps> = ({
  screenshots,
  roomId,
  onSelectImage,
  onDeleteScreenshot,
  viewMode,
  onTriggerCapture,
}) => {
  if (screenshots.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#111827]/40 border border-[#1F293D] rounded-2xl">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 mb-4">
          <ImageIcon className="w-12 h-12 stroke-[1.5]" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">暂无截屏记录</h3>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          当候选人接入桌面监控端后，系统将每 30 秒自动抓取屏幕，你也可以随时点击上方按钮进行即时抓取。
        </p>
        <button
          onClick={onTriggerCapture}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
        >
          <Camera className="w-4 h-4" />
          <span>立即触发即时抓取</span>
        </button>
      </div>
    );
  }

  const BASE_URL = 'http://127.0.0.1:3000';

  return (
    <div className="flex-1 overflow-y-auto pr-1">
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
          {screenshots.map((item, index) => {
            const isInstant = item.type === 'instant';
            const imageUrl = `${BASE_URL}${item.url}`;

            return (
              <div
                key={item.filename}
                className="group relative bg-[#111827] border border-[#1F293D] hover:border-emerald-500/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col"
              >
                {/* Image Thumbnail Container */}
                <div
                  onClick={() => onSelectImage(item)}
                  className="relative aspect-video w-full bg-slate-950/80 overflow-hidden cursor-pointer flex items-center justify-center"
                >
                  <img
                    src={imageUrl}
                    alt={item.filename}
                    loading={index < 4 ? 'eager' : 'lazy'}
                    className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="p-2 bg-emerald-600/90 text-white rounded-xl shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                      <Maximize2 className="w-4 h-4" />
                    </span>
                  </div>

                  {/* Top Type Badge */}
                  <div className="absolute top-2.5 left-2.5">
                    {isInstant ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/90 text-black shadow-md">
                        <Zap className="w-3 h-3 fill-current" />
                        <span>即时截屏</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-900/90 text-sky-300 border border-sky-500/30 backdrop-blur-sm shadow">
                        <Clock className="w-3 h-3" />
                        <span>30s 定时</span>
                      </span>
                    )}
                  </div>

                  {/* Index badge */}
                  <div className="absolute top-2.5 right-2.5 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-black/60 text-slate-300 backdrop-blur-sm">
                    #{screenshots.length - index}
                  </div>
                </div>

                {/* Footer Info */}
                <div className="p-3 flex items-center justify-between gap-2 border-t border-[#1F293D] bg-[#0E1424]">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200 truncate">
                      {item.formattedTime || new Date(item.timestamp).toLocaleTimeString('zh-CN')}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                      <span>{formatBytes(item.sizeBytes)}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(item.timestamp)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteScreenshot(item.filename);
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="删除此截图"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Timeline View */
        <div className="space-y-3 pb-6">
          {screenshots.map((item, index) => {
            const isInstant = item.type === 'instant';
            const imageUrl = `${BASE_URL}${item.url}`;

            return (
              <div
                key={item.filename}
                onClick={() => onSelectImage(item)}
                className="group bg-[#111827] border border-[#1F293D] hover:border-emerald-500/50 rounded-2xl p-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#151D30]/60 transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Small Thumbnail */}
                  <div className="relative w-28 aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                    <img
                      src={imageUrl}
                      alt={item.filename}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {isInstant ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/90 text-black">
                          <Zap className="w-2.5 h-2.5 fill-current" /> 即时截屏
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 border border-sky-500/30">
                          <Clock className="w-2.5 h-2.5" /> 30s 定时
                        </span>
                      )}
                      <span className="text-xs font-semibold text-white">
                        {item.formattedTime || new Date(item.timestamp).toLocaleTimeString('zh-CN')}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                      <span>{item.filename}</span>
                      <span>·</span>
                      <span>{formatBytes(item.sizeBytes)}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(item.timestamp)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectImage(item);
                    }}
                    className="p-2 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded-xl transition-colors"
                    title="查看高清原图"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteScreenshot(item.filename);
                    }}
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
