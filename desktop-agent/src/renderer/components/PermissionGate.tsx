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
    <div className="w-full h-full flex flex-col justify-between p-4 text-center select-none font-sans">
      {/* Top security icon & glowing aura */}
      <div className="flex flex-col items-center pt-1">
        <div className="relative mb-2.5 flex items-center justify-center">
          {/* Radial glow background */}
          <div className="absolute w-20 h-20 rounded-full bg-amber-500/20 blur-xl" />
          
          {/* Outer ring */}
          <div className="relative w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/30 flex items-center justify-center shadow-lg shadow-amber-950/40">
            <Lock className="w-6 h-6 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border border-black/80" />
            </span>
          </div>
        </div>

        <h2 className="text-sm font-bold text-white tracking-tight">
          需要 macOS 屏幕录制权限
        </h2>
        <p className="text-xs text-slate-400 mt-0.5 max-w-[300px] leading-relaxed">
          松鼠Pad 伴侣端需要捕获屏幕画面以同步至协同面试间
        </p>
      </div>

      {/* 3-Step Visual Authorization Guide */}
      <div className="my-2.5 glass-subcard rounded-2xl p-3 text-left flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-0.5">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>三步快速授权指引</span>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="w-4 h-4 rounded-full bg-white/10 text-amber-300 text-[10px] font-mono flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
            1
          </div>
          <p className="text-xs text-slate-300 leading-tight">
            点击下方 <strong className="text-amber-300 font-medium">「打开系统设置」</strong> 进入设置面板
          </p>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="w-4 h-4 rounded-full bg-white/10 text-amber-300 text-[10px] font-mono flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
            2
          </div>
          <p className="text-xs text-slate-300 leading-tight">
            在 <span className="text-white">隐私与安全性 → 屏幕录制</span> 中勾选 <strong className="text-emerald-300 font-medium">松鼠Pad 桌面端</strong>
          </p>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="w-4 h-4 rounded-full bg-white/10 text-amber-300 text-[10px] font-mono flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
            3
          </div>
          <p className="text-xs text-slate-300 leading-tight">
            授权完成后回到本窗口，点击 <strong className="text-emerald-300 font-medium">「已授权，点击刷新」</strong> 即可
          </p>
        </div>
      </div>

      {/* Action CTA Buttons */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={handleOpenSettings}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gradient-to-r from-amber-500/25 to-amber-600/20 hover:from-amber-500/35 hover:to-amber-600/30 text-amber-200 text-xs font-semibold rounded-xl border border-amber-500/40 shadow-lg shadow-amber-950/20 transition-all duration-150 active:scale-95 app-no-drag"
        >
          <Settings className="w-3.5 h-3.5 text-amber-400" />
          <span>打开系统设置</span>
        </button>

        <button
          onClick={handleRefresh}
          disabled={checking}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-semibold rounded-xl border border-white/10 shadow transition-all duration-150 active:scale-95 disabled:opacity-50 app-no-drag"
        >
          {checking ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          ) : hasPromptedSettings ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>{checking ? '正在检测...' : '已授权，点击刷新'}</span>
        </button>
      </div>

      {/* Security Privacy Assurance */}
      <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>本地沙盒防护，仅向受权房间传输画面</span>
      </div>
    </div>
  );
};
