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
  Check,
  ArrowLeft,
  FileCode2,
  Keyboard,
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
  onDisconnect,
}) => {
  const [showOpacityMenu, setShowOpacityMenu] = useState(false);
  const [showShortcutsMenu, setShowShortcutsMenu] = useState(false);
  const [roomCopied, setRoomCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const shortcutsMenuRef = useRef<HTMLDivElement>(null);

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

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setShowOpacityMenu(false);
      }
      if (shortcutsMenuRef.current && !shortcutsMenuRef.current.contains(target)) {
        setShowShortcutsMenu(false);
      }
    };
    if (showOpacityMenu || showShortcutsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOpacityMenu, showShortcutsMenu]);

  const opacityPresets = [
    { label: '极透代码', value: 0.1 },
    { label: '悬浮透视', value: 0.25 },
    { label: '磨砂玻璃', value: 0.45 },
    { label: '暗黑微透', value: 0.75 },
    { label: '实色黑曜', value: 1.0 },
  ];

  const getLanguageDisplayName = (lang: string) => {
    switch (lang.toLowerCase()) {
      case 'cpp':
        return 'C++ 20';
      case 'java':
        return 'Java 21';
      case 'javascript':
        return 'JS';
      case 'typescript':
        return 'TS';
      case 'python':
      default:
        return 'Python 3';
    }
  };

  const isWindows = window.electronAPI?.isWindows ?? /Win/i.test(navigator.userAgent || '');
  const shortcutDisplay = isWindows ? 'Ctrl⇧X' : '⌘⇧X';
  const shortcutTooltip = isWindows
    ? '点击切换鼠标穿透 (全局热键: Ctrl+Shift+X)'
    : '点击切换鼠标穿透 (全局热键: Cmd+Shift+X)';
  const hideShortcutDisplay = isWindows ? 'Ctrl+Shift+B' : '⌘⇧B';
  const opacityDecShortcutDisplay = isWindows ? 'Ctrl+Shift+[' : '⌘⇧[';
  const opacityIncShortcutDisplay = isWindows ? 'Ctrl+Shift+]' : '⌘⇧]';

  return (
    <div
      className="relative flex items-center justify-between px-3 py-2 border-b border-white/10 app-drag select-none gap-2 z-30 transition-colors duration-200"
      style={{
        backgroundColor: `rgba(10, 15, 26, ${Math.max(0.85, opacity)})`,
      }}
    >
      {/* Left: macOS Traffic Lights + Brand */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* macOS Traffic Lights */}
        <div className="flex items-center gap-1.5 app-no-drag group">
          <button
            onClick={handleClose}
            title="关闭伴侣端"
            className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/60 flex items-center justify-center transition-all duration-150 hover:brightness-110 active:scale-90"
          >
            <X className="w-2 h-2 text-[#4c0000] opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <button
            onClick={handleMinimize}
            title={`最小化 (全局隐藏/显示快捷键: ${hideShortcutDisplay})`}
            className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/60 flex items-center justify-center transition-all duration-150 hover:brightness-110 active:scale-90"
          >
            <Minus className="w-2 h-2 text-[#5c3c00] opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? '展开面板' : '折叠为灵动岛胶囊'}
            className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/60 flex items-center justify-center transition-all duration-150 hover:brightness-110 active:scale-90"
          >
            <ChevronUp className="w-2 h-2 text-[#004d00] opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        {/* Brand Name */}
        <div className="flex items-center gap-1.5 ml-0.5">
          <span className="text-sm leading-none drop-shadow-sm select-none">🐿️</span>
          <span className="text-xs font-semibold text-white/90 tracking-tight font-sans hidden sm:inline">
            松鼠Pad
          </span>
        </div>

        {/* Room Info Pill (Option 1: Minimalist friendly status) */}
        {(isConnected || isReconnecting) && (
          <div className="flex items-center gap-1.5 min-w-0 app-no-drag">
            <button
              onClick={handleCopyRoomId}
              title={`当前房间: ${roomId || '未知'} (点击复制房间号)`}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[11px] font-sans font-medium text-slate-200 transition active:scale-95 shadow-xs"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isReconnecting ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
                }`}
              />
              <span>
                {roomCopied
                  ? '已复制房间号'
                  : isReconnecting
                  ? `重连中${reconnectAttempt > 0 ? ` (#${reconnectAttempt})` : ''}`
                  : '协同中'}
              </span>
              {roomCopied && (
                <Check className="w-2.5 h-2.5 text-emerald-400 ml-0.5" />
              )}
            </button>

            {/* Language Tag */}
            {!isReconnecting && (
              <div className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-medium font-sans">
                <FileCode2 className="w-2.5 h-2.5" />
                <span>{getLanguageDisplayName(language)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center: Stealth & Click-Through Toggles */}
      {(isConnected || isReconnecting) && (
        <div className="flex items-center gap-1.5 app-no-drag">
          {/* Stealth badge (Clickable toggle) */}
          <button
            onClick={onToggleContentProtection}
            title={
              contentProtection
                ? '防录屏隐形已激活 (Zoom/腾讯会议等屏幕共享不可见，点击可切换)'
                : '防录屏隐形已关闭 (屏幕共享可见，点击开启)'
            }
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium font-sans transition active:scale-95 border ${
              contentProtection
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            {contentProtection ? (
              <>
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span className="hidden md:inline">防录屏隐形</span>
                <span className="md:hidden">隐形</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                <span className="hidden md:inline">常规可见</span>
                <span className="md:hidden">常规</span>
              </>
            )}
          </button>

          {/* Click-through toggle */}
          {onToggleClickThrough && (
            <button
              onClick={onToggleClickThrough}
              title={shortcutTooltip}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-sans text-[10px] font-medium border transition active:scale-95 ${
                clickThrough
                  ? 'bg-purple-600/30 text-purple-200 border-purple-400/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                  : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.08]'
              }`}
            >
              <MousePointer className="w-3 h-3 text-purple-300" />
              <span>{clickThrough ? '穿透中' : '穿透'}</span>
              <span className="text-[9px] text-slate-400 font-mono hidden xl:inline">{shortcutDisplay}</span>
            </button>
          )}
        </div>
      )}

      {/* Right: Actions Toolbar */}
      <div className="flex items-center gap-1 app-no-drag">
        {(isConnected || isReconnecting) && (
          <>
            {/* Font Size Adjuster & Wrap Segmented Group */}
            <div className="flex items-center bg-white/[0.05] rounded-lg border border-white/10 p-0.5">
              {onFontSizeChange && (
                <>
                  <button
                    onClick={() => onFontSizeChange(-1)}
                    title="缩小代码字号"
                    className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-white/10 transition active:scale-95"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] font-mono text-slate-300 px-1 min-w-[18px] text-center font-medium">
                    {fontSize}
                  </span>
                  <button
                    onClick={() => onFontSizeChange(1)}
                    title="放大代码字号"
                    className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-white/10 transition active:scale-95"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </>
              )}

              {onToggleWrapLines && (
                <button
                  onClick={onToggleWrapLines}
                  title={wrapLines ? '关闭代码自动换行' : '开启代码自动换行'}
                  className={`p-1 ml-0.5 rounded transition active:scale-95 ${
                    wrapLines
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/10'
                  }`}
                >
                  <WrapText className="w-3 h-3" />
                </button>
              )}
            </div>
          </>
        )}

        {/* Opacity Selector Pill */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => {
              setShowOpacityMenu(!showOpacityMenu);
              setShowShortcutsMenu(false);
            }}
            title={`背景透明度: ${Math.round(opacity * 100)}% (快捷键: ${opacityDecShortcutDisplay} 降低 / ${opacityIncShortcutDisplay} 增加)`}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg transition-all duration-150 border ${
              showOpacityMenu
                ? 'bg-white/15 text-white border-white/25 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.08] border-white/10'
            }`}
          >
            <Eye className="w-3 h-3 text-slate-400" />
            <span className="font-mono text-[10px] font-medium">{Math.round(opacity * 100)}%</span>
          </button>

          {/* Opacity Menu Popover */}
          {showOpacityMenu && (
            <div className="absolute right-0 top-full mt-2 bg-[#0a0f1a]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-3 z-50 w-56 animate-in fade-in zoom-in-95 duration-150 app-no-drag">
              <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2.5">
                <span className="text-xs font-semibold text-slate-200 font-sans">底板透明度</span>
                <span className="font-mono text-xs font-bold text-emerald-400">
                  {Math.round(opacity * 100)}%
                </span>
              </div>

              {/* Slider */}
              <div className="mb-3 px-0.5">
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-sans mt-1">
                  <span>极透 5%</span>
                  <span>50%</span>
                  <span>100% 纯黑</span>
                </div>
              </div>

              {/* Presets List */}
              <div className="flex flex-col gap-1 mb-2.5">
                {opacityPresets.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => {
                      onOpacityChange(p.value);
                      setShowOpacityMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] font-sans transition-all duration-100 ${
                      Math.abs(opacity - p.value) < 0.05
                        ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-xs'
                        : 'text-slate-300 hover:bg-white/[0.08] hover:text-white border border-transparent'
                    }`}
                  >
                    <span>{p.label}</span>
                    <span className="font-mono text-[10px] text-slate-400">{Math.round(p.value * 100)}%</span>
                  </button>
                ))}
              </div>

              {/* Shortcut hints */}
              <div className="pt-2 border-t border-white/10 flex flex-col gap-1.5 text-[10px] text-slate-400 font-sans mb-2">
                <div className="flex justify-between items-center">
                  <span>降低透明度 (更透)</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[9px] text-slate-300">{opacityDecShortcutDisplay}</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>增加透明度 (加深)</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[9px] text-slate-300">{opacityIncShortcutDisplay}</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>屏幕完全隐藏/显示</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[9px] text-slate-300">{hideShortcutDisplay}</kbd>
                </div>
              </div>

              {/* Notice */}
              <div className="pt-1.5 border-t border-white/10 flex items-center gap-1.5 text-[10px] text-slate-400 font-sans">
                <Sparkles className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span>代码文字与工具栏始终 100% 极清</span>
              </div>
            </div>
          )}
        </div>

        {/* Shortcuts List Popover */}
        <div className="relative" ref={shortcutsMenuRef}>
          <button
            onClick={() => {
              setShowShortcutsMenu(!showShortcutsMenu);
              setShowOpacityMenu(false);
            }}
            title="查看全局快捷键列表"
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg transition-all duration-150 border ${
              showShortcutsMenu
                ? 'bg-white/15 text-white border-white/25 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.08] border-white/10'
            }`}
          >
            <Keyboard className="w-3 h-3 text-slate-400" />
            <span className="font-sans text-[11px] font-medium hidden sm:inline">快捷键</span>
          </button>

          {showShortcutsMenu && (
            <div className="absolute right-0 top-full mt-2 bg-[#0a0f1a]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-3 z-50 w-72 animate-in fade-in zoom-in-95 duration-150 app-no-drag">
              <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2.5">
                <div className="flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-200 font-sans">快捷键一览</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">全局响应</span>
              </div>

              <div className="flex flex-col gap-2 mb-2.5">
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04] border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-slate-200">全屏隐藏 / 显示</span>
                    <span className="text-[9px] text-slate-400">老板键，瞬间隐藏或唤回窗口</span>
                  </div>
                  <kbd className="px-2 py-1 rounded bg-white/10 font-mono text-[10px] text-emerald-300 font-semibold border border-white/10">
                    {hideShortcutDisplay}
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04] border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-slate-200">鼠标穿透模式</span>
                    <span className="text-[9px] text-slate-400">穿透后可直接点击操作下层应用</span>
                  </div>
                  <kbd className="px-2 py-1 rounded bg-white/10 font-mono text-[10px] text-purple-300 font-semibold border border-white/10">
                    {shortcutDisplay}
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04] border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-slate-200">降低底板透明度</span>
                    <span className="text-[9px] text-slate-400">每次降低 10%，更通透</span>
                  </div>
                  <kbd className="px-2 py-1 rounded bg-white/10 font-mono text-[10px] text-cyan-300 font-semibold border border-white/10">
                    {opacityDecShortcutDisplay}
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04] border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-slate-200">增加底板透明度</span>
                    <span className="text-[9px] text-slate-400">每次增加 10%，加深底色</span>
                  </div>
                  <kbd className="px-2 py-1 rounded bg-white/10 font-mono text-[10px] text-cyan-300 font-semibold border border-white/10">
                    {opacityIncShortcutDisplay}
                  </kbd>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center gap-1.5 text-[10px] text-slate-400 font-sans">
                <Sparkles className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                <span>全局热键在后台或全屏应用中随时可用</span>
              </div>
            </div>
          )}
        </div>

        {/* Return to Room Connection Button */}
        {(isConnected || isReconnecting) && onDisconnect && (
          <button
            onClick={onDisconnect}
            title="退出当前房间，返回连接房间界面"
            className="group flex items-center gap-1 px-2 py-1 text-[11px] font-sans font-medium text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/20 rounded-lg border border-white/10 transition active:scale-95 shadow-xs ml-0.5"
          >
            <ArrowLeft className="w-3 h-3 text-slate-400 group-hover:text-white transition-transform group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">返回连接</span>
            <span className="sm:hidden">返回</span>
          </button>
        )}
      </div>
    </div>
  );
};
