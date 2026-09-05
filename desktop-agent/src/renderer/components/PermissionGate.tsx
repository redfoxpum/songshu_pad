import React, { useState } from 'react';
import { ShieldCheck, Settings, RefreshCw, Lock, Sparkles, CheckCircle2 } from 'lucide-react';

interface PermissionGateProps {
  onPermissionGranted: () => void;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({ onPermissionGranted }) => {
  const [checking, setChecking] = useState(false);
  const [hasPromptedSettings, setHasPromptedSettings] = useState(false);

  const handleOpenSettings = async () => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.openScreenPermissionSettings();
        setHasPromptedSettings(true);
      }
    } catch (e) {
      console.error('Failed to open settings:', e);
    }
  };

  const handleRefresh = async () => {
    setChecking(true);
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.checkScreenPermission();
        if (result.granted) {
          onPermissionGranted();
        }
      } else {
        // In browser mock mode
        onPermissionGranted();
      }
    } catch (e) {
      console.error('Permission check failed:', e);
    } finally {
      setTimeout(() => setChecking(false), 600);
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-between p-4 text-center select-none">
      {/* Top security icon & glowing aura */}
      <div className="flex flex-col items-center pt-2">
        <div className="relative mb-3 flex items-center justify-center">
          {/* Radial glow background */}
          <div className="absolute w-20 h-20 rounded-full bg-amber-500/20 blur-xl"></div>
          
          {/* Outer ring */}
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/30 flex items-center justify-center shadow-lg shadow-amber-950/40">
            <Lock className="w-7 h-7 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-slate-900"></span>
            </span>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
          需要 macOS 屏幕录制权限
        </h2>
        <p className="text-[11px] text-slate-400 mt-0.5 max-w-[300px] leading-relaxed">
          松鼠Pad 伴侣端需要捕获屏幕画面以同步至协同面试间
        </p>
      </div>

      {/* 3-Step Visual Authorization Guide */}
      <div className="my-3 glass-subcard rounded-xl p-3 text-left border border-white/10 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-0.5">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>三步快速授权指引</span>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="w-4 h-4 rounded-full bg-slate-800 border border-slate-600 text-slate-300 text-[10px] font-mono flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
            1
          </div>
          <p className="text-[11px] text-slate-300 leading-tight">
            点击下方 <strong className="text-amber-300 font-medium">「打开系统设置」</strong> 进入设置面板
          </p>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="w-4 h-4 rounded-full bg-slate-800 border border-slate-600 text-slate-300 text-[10px] font-mono flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
            2
          </div>
          <p className="text-[11px] text-slate-300 leading-tight">
            在 <span className="text-slate-200">隐私与安全性 → 屏幕录制</span> 列表中勾选 <strong className="text-emerald-300 font-medium">松鼠Pad 桌面端</strong>
          </p>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="w-4 h-4 rounded-full bg-slate-800 border border-slate-600 text-slate-300 text-[10px] font-mono flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
            3
          </div>
          <p className="text-[11px] text-slate-300 leading-tight">
            授权完成后回到本窗口，点击 <strong className="text-emerald-300 font-medium">「已授权，点击刷新」</strong> 即可
          </p>
        </div>
      </div>

      {/* Action CTA Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleOpenSettings}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-amber-500/25 to-amber-600/20 hover:from-amber-500/35 hover:to-amber-600/30 text-amber-200 text-xs font-medium rounded-xl border border-amber-500/40 shadow-lg shadow-amber-950/20 transition-all duration-150 active:scale-95 app-no-drag"
        >
          <Settings className="w-3.5 h-3.5 text-amber-400" />
          <span>打开系统设置</span>
        </button>

        <button
          onClick={handleRefresh}
          disabled={checking}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 text-xs font-medium rounded-xl border border-white/10 shadow transition-all duration-150 active:scale-95 disabled:opacity-50 app-no-drag"
        >
          {checking ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          ) : hasPromptedSettings ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>{checking ? '正在检测...' : hasPromptedSettings ? '已授权，点击刷新' : '已授权，点击刷新'}</span>
        </button>
      </div>

      {/* Security Privacy Assurance */}
      <div className="mt-2.5 flex items-center justify-center gap-1 text-[10px] text-slate-400">
        <ShieldCheck className="w-3 h-3 text-emerald-400" />
        <span>本地硬件级沙盒防护，画面直连加密空间</span>
      </div>
    </div>
  );
};
