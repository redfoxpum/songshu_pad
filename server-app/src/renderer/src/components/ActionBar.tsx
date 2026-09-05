import React from 'react';
import { Camera, RefreshCw, LayoutGrid, List, Zap, Loader2 } from 'lucide-react';

interface ActionBarProps {
  onCapture: () => void;
  onRefresh: () => void;
  isCapturing: boolean;
  isLoading: boolean;
  count: number;
  viewMode: 'grid' | 'timeline';
  onToggleViewMode: (mode: 'grid' | 'timeline') => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onCapture,
  onRefresh,
  isCapturing,
  isLoading,
  count,
  viewMode,
  onToggleViewMode,
}) => {
  return (
    <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 select-none">
      {/* Left: Instant Capture Action */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCapture}
          disabled={isCapturing}
          className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/25 transition-all active:scale-95 border border-emerald-400/30"
          title="向候选人桌面端发送即时截屏指令并存入截图时间线"
        >
          {isCapturing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>正在截屏传输...</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>📸 立即抓取屏幕 (On-Demand)</span>
              <span className="flex items-center gap-0.5 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-normal">
                <Zap className="w-2.5 h-2.5 fill-current" /> 即时
              </span>
            </>
          )}
        </button>

        <span className="text-xs text-slate-400 hidden sm:inline">
          已启用 30s 周期性静默抓取
        </span>
      </div>

      {/* Right: View Toggles & Refresh */}
      <div className="flex items-center gap-2">
        {/* Gallery Count */}
        <div className="text-xs text-slate-400 mr-2 font-mono">
          共 <span className="text-emerald-400 font-bold">{count}</span> 张截图
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-[#151D30] border border-slate-700/60 p-1 rounded-xl">
          <button
            onClick={() => onToggleViewMode('grid')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'grid'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="网格视图"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggleViewMode('timeline')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'timeline'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="时间线视图"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Manual Refresh */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 bg-[#151D30] hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white rounded-xl transition-colors active:scale-95"
          title="手动刷新截图"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>
    </div>
  );
};
