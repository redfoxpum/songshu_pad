import React, { useState, useRef, useEffect } from 'react';
import {
  Minus,
  X,
  Eye,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  MousePointer,
  ZoomIn,
  ZoomOut,
  WrapText,
  Copy,
  Check,
  PowerOff,
  FileCode2,
} from 'lucide-react';

interface HeaderBarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose?: () => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  isConnected?: boolean;
  isReconnecting?: boolean;
  reconnectAttempt?: number;
  roomId?: string;
  language?: string;
  contentProtection?: boolean;
  onToggleContentProtection?: () => void;
  clickThrough?: boolean;
  onToggleClickThrough?: () => void;
  fontSize?: number;
  onFontSizeChange?: (delta: number) => void;
  wrapLines?: boolean;
  onToggleWrapLines?: () => void;
  onCopyCode?: () => void;
  copied?: boolean;
  onDisconnect?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  isCollapsed,
  onToggleCollapse,
  onClose,
  opacity,
  onOpacityChange,
  isConnected = false,
  isReconnecting = false,
  reconnectAttempt = 0,
  roomId = '',
  language = 'python',
  contentProtection = true,
  onToggleContentProtection,
  clickThrough = false,
  onToggleClickThrough,
  fontSize = 13,
  onFontSizeChange,
  wrapLines = true,
  onToggleWrapLines,
  onCopyCode,
  copied = false,
  onDisconnect,
}) => {
  const [showOpacityMenu, setShowOpacityMenu] = useState(false);
  const [roomCopied, setRoomCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow();
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      window.electronAPI?.closeWindow();
    }
  };

  const handleCopyRoomId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setRoomCopied(true);
      setTimeout(() => setRoomCopied(false), 2000);
    }
  };

  // Close opacity menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowOpacityMenu(false);
      }
    };
    if (showOpacityMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOpacityMenu]);

  const opacityPresets = [
    { label: '10% 极透代码', value: 0.1 },
    { label: '25% 悬浮透视', value: 0.25 },
    { label: '45% 磨砂玻璃', value: 0.45 },
    { label: '75% 暗黑高清', value: 0.75 },
    { label: '100% 实黑底', value: 1.0 },
  ];

  const getLanguageDisplayName = (lang: string) => {
    switch (lang.toLowerCase()) {
      case 'python':
        return 'Python 3';
      case 'cpp':
        return 'C++ 20';
      case 'java':
        return 'Java 21';
      case 'javascript':
        return 'JavaScript';
      case 'typescript':
        return 'TypeScript';
      default:
        return lang.toUpperCase();
    }
  };

  return (
    <div
      className="relative flex items-center justify-between px-3 py-2 border-b border-white/10 app-drag select-none gap-2 z-30 shadow-md transition-colors duration-150"
      style={{
        backgroundColor: `rgba(15, 23, 42, ${Math.max(0.85, opacity)})`,
      }}
    >
      {/* Left: macOS Traffic Lights & Brand & Room Info */}
      <div className="flex items-center gap-2 min-w-0">
        {/* macOS Traffic Lights */}
        <div className="flex items-center gap-1.5 app-no-drag group">
          <button
            onClick={handleClose}
            title="关闭伴侣端"
            className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/50 flex items-center justify-center transition-all duration-150 hover:brightness-110 active:scale-90"
          >
            <X className="w-2 h-2 text-[#4c0000] opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <button
            onClick={handleMinimize}
            title="最小化"
            className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/50 flex items-center justify-center transition-all duration-150 hover:brightness-110 active:scale-90"
          >
            <Minus className="w-2 h-2 text-[#5c3c00] opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? '展开面板' : '折叠为灵动胶囊'}
            className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/50 flex items-center justify-center transition-all duration-150 hover:brightness-110 active:scale-90"
          >
            <ChevronUp className="w-2 h-2 text-[#004d00] opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        {/* Brand Name */}
        <div className="flex items-center gap-1.5 ml-0.5">
          <span className="text-sm leading-none drop-shadow-sm">🐿️</span>
          <span className="text-xs font-semibold bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent tracking-tight hidden sm:inline">
            松鼠Pad
          </span>
        </div>

        {/* Connected Room & Lang Tags */}
        {(isConnected || isReconnecting) && (
          <div className="flex items-center gap-1.5 min-w-0 app-no-drag">
            {/* Room ID Tag */}
            <button
              onClick={handleCopyRoomId}
              title="点击复制房间号"
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono font-medium text-slate-200 transition active:scale-95 max-w-[120px] truncate"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isReconnecting ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'
                }`}
              ></span>
              <span className="truncate">{roomId}</span>
              {roomCopied ? (
                <Check className="w-2.5 h-2.5 text-emerald-400" />
              ) : (
                <Copy className="w-2.5 h-2.5 text-slate-400" />
              )}
            </button>

            {/* Reconnecting Badge */}
            {isReconnecting && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-medium animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>重连中{reconnectAttempt > 0 ? ` (#${reconnectAttempt})` : ''}</span>
              </div>
            )}

            {/* Language Tag */}
            {!isReconnecting && (
              <div className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-semibold">
                <FileCode2 className="w-3 h-3" />
                <span>{getLanguageDisplayName(language)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center: Stealth Protection & Click-Through Switch */}
      {(isConnected || isReconnecting) && (
        <div className="flex items-center gap-1.5 app-no-drag">
          {/* Stealth badge (Clickable toggle) */}
          <button
            onClick={onToggleContentProtection}
            title={
              contentProtection
                ? '防录屏隐形已激活 (Zoom/腾讯会议等屏幕共享不可见，点击可关闭)'
                : '防录屏隐形已关闭 (屏幕共享可见，点击可开启)'
            }
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium transition active:scale-95 border ${
              contentProtection
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {contentProtection ? (
              <>
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span className="hidden sm:inline">防录屏隐形</span>
                <span className="sm:hidden">隐形</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                <span className="hidden sm:inline">隐形已关</span>
                <span className="sm:hidden">常规</span>
              </>
            )}
          </button>

          {/* Click-through toggle */}
          {onToggleClickThrough && (
            <button
              onClick={onToggleClickThrough}
              title="点击切换鼠标穿透模式 (全局热键: Cmd+Shift+X)"
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[10px] font-medium border transition active:scale-95 ${
                clickThrough
                  ? 'bg-purple-600/30 text-purple-200 border-purple-400/50 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <MousePointer className="w-3 h-3" />
              <span>{clickThrough ? '穿透中' : '穿透'}</span>
              <span className="text-[9px] text-slate-400 hidden lg:inline font-sans">⌘⇧X</span>
            </button>
          )}
        </div>
      )}

      {/* Right: Actions Toolbar (Font size, Wrap, Copy, Opacity, Disconnect) */}
      <div className="flex items-center gap-1 app-no-drag">
        {(isConnected || isReconnecting) && (
          <>
            {/* Font Size Adjuster */}
            {onFontSizeChange && (
              <div className="flex items-center bg-slate-800/80 rounded-lg border border-white/10 p-0.5">
                <button
                  onClick={() => onFontSizeChange(-1)}
                  title="缩小代码字号"
                  className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-white/10 transition active:scale-95"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <span className="text-[10px] font-mono text-slate-300 px-1 min-w-[18px] text-center">
                  {fontSize}
                </span>
                <button
                  onClick={() => onFontSizeChange(1)}
                  title="放大代码字号"
                  className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-white/10 transition active:scale-95"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Toggle Wrap Lines */}
            {onToggleWrapLines && (
              <button
                onClick={onToggleWrapLines}
                title={wrapLines ? '关闭代码自动换行' : '开启代码自动换行'}
                className={`p-1.5 rounded-lg transition active:scale-95 border ${
                  wrapLines
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/10 border-transparent'
                }`}
              >
                <WrapText className="w-3 h-3" />
              </button>
            )}

            {/* Copy All Code Button */}
            {onCopyCode && (
              <button
                onClick={onCopyCode}
                title="复制 Pad 全部代码"
                className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] rounded-lg border border-white/10 transition active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300 font-medium">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>复制代码</span>
                  </>
                )}
              </button>
            )}
          </>
        )}

        {/* Opacity Selector Pill */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowOpacityMenu(!showOpacityMenu)}
            title={`背景透明度: ${Math.round(opacity * 100)}% (文字保持100%清晰)`}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg transition-all duration-150 border ${
              showOpacityMenu
                ? 'bg-white/15 text-white border-white/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border-transparent hover:border-white/10'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span className="font-mono text-[10px]">{Math.round(opacity * 100)}%</span>
          </button>

          {/* Opacity Menu Popover */}
          {showOpacityMenu && (
            <div className="absolute right-0 top-full mt-1.5 bg-slate-900 border border-white/20 rounded-xl shadow-2xl p-2.5 z-50 w-52 animate-in fade-in zoom-in-95 duration-150 app-no-drag">
              <div className="flex items-center justify-between pb-1.5 border-b border-white/10 mb-2">
                <span className="text-[11px] font-semibold text-slate-200">底板背景透明度</span>
                <span className="font-mono text-[11px] font-bold text-emerald-400">
                  {Math.round(opacity * 100)}%
                </span>
              </div>

              {/* Slider */}
              <div className="mb-2.5 px-0.5">
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                  <span>透 5%</span>
                  <span>50%</span>
                  <span>100% 实</span>
                </div>
              </div>

              {/* Presets List */}
              <div className="flex flex-col gap-0.5 mb-2">
                {opacityPresets.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => {
                      onOpacityChange(p.value);
                      setShowOpacityMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-[10px] transition-all duration-100 ${
                      Math.abs(opacity - p.value) < 0.05
                        ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white border border-transparent'
                    }`}
                  >
                    <span>{p.label}</span>
                    <span className="font-mono text-[9px] text-slate-400">{Math.round(p.value * 100)}%</span>
                  </button>
                ))}
              </div>

              {/* Clarity notice */}
              <div className="pt-1.5 border-t border-white/10 flex items-center gap-1 text-[9px] text-slate-400">
                <Sparkles className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
                <span>代码文字与工具栏始终 100% 极清</span>
              </div>
            </div>
          )}
        </div>

        {/* Disconnect button */}
        {isConnected && onDisconnect && (
          <button
            onClick={onDisconnect}
            title="断开房间连接"
            className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 rounded-lg transition border border-transparent hover:border-rose-500/30 active:scale-95"
          >
            <PowerOff className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
