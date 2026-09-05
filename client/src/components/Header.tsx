import React, { useState } from 'react';
import {
  Copy,
  Check,
  Download,
  Sun,
  Moon,
  Share2,
  WifiOff,
} from 'lucide-react';
import { SupportedLanguage, EditorTheme, UserProfile, RemoteParticipant, ConnectionStatus } from '../types';
import { LANGUAGES } from '../utils/languages';
import { LanguageSelector } from './LanguageSelector';
import { ParticipantsList } from './ParticipantsList';

interface HeaderProps {
  roomId: string;
  roomName?: string;
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  theme: EditorTheme;
  onThemeToggle: () => void;
  currentUser: UserProfile;
  participants: RemoteParticipant[];
  connectionStatus: ConnectionStatus;
  onOpenProfile: () => void;
  onCopyAllCode: () => void;
  onExportCode: () => void;
  onBackHome: () => void;
  onShowToast: (type: 'success' | 'info' | 'warning' | 'error', msg: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  roomId,
  roomName,
  language,
  onLanguageChange,
  theme,
  onThemeToggle,
  currentUser,
  participants,
  connectionStatus,
  onOpenProfile,
  onCopyAllCode,
  onExportCode,
  onBackHome,
  onShowToast,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const isDark = theme === 'dark';
  const currentLang = LANGUAGES[language] || LANGUAGES.python;

  const handleCopyLink = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      onShowToast('success', 'Room share link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      onShowToast('error', 'Failed to copy link');
    }
  };

  const handleCopyCode = () => {
    onCopyAllCode();
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <header
      className={`h-14 px-4 border-b flex items-center justify-between gap-3 shrink-0 transition-colors z-20 ${
        isDark ? 'bg-slate-900/90 border-slate-800 backdrop-blur-md' : 'bg-white/95 border-slate-200 backdrop-blur-md shadow-xs'
      }`}
    >
      {/* Left Section: Brand, Room Name, Share Badge */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBackHome}
          className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors group shrink-0"
          title="返回首页"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform text-base">
            🐿️
          </div>
          <span className="font-bold text-sm tracking-tight hidden sm:inline text-white">松鼠Pad</span>
        </button>

        <div className="h-4 w-px bg-slate-700/60 hidden sm:block" />

        {/* Room Slug & Share Pill */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold truncate max-w-[140px] sm:max-w-[200px] text-slate-300">
            {roomName || roomId}
          </span>
          <button
            onClick={handleCopyLink}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all ${
              copiedLink
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                : isDark
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
            title="Click to copy full room invite URL"
          >
            {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3 text-slate-400" />}
            <span className="hidden md:inline">{copiedLink ? 'Copied' : 'Share'}</span>
          </button>
        </div>
      </div>

      {/* Middle Section: Live Language Switcher & Connection Indicator */}
      <div className="flex items-center gap-2.5">
        <LanguageSelector
          language={language}
          onChange={onLanguageChange}
          isDark={isDark}
        />

        {/* Connection Status Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${
            connectionStatus === 'connected'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : connectionStatus === 'connecting'
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
          title={
            connectionStatus === 'connected'
              ? 'Real-time WebSocket connected and syncing'
              : connectionStatus === 'connecting'
              ? 'Connecting to collaboration server...'
              : 'Disconnected from server. Retrying...'
          }
        >
          {connectionStatus === 'connected' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden lg:inline text-[11px] font-semibold">Live Sync</span>
            </>
          ) : connectionStatus === 'connecting' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span className="hidden lg:inline text-[11px] font-semibold">Connecting</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-rose-400" />
              <span className="hidden lg:inline text-[11px] font-semibold">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Right Section: Actions, Participants, Profile, Theme */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Participants Pill */}
        <ParticipantsList
          participants={participants}
          isDark={isDark}
          onOpenProfile={onOpenProfile}
        />

        <div className="h-4 w-px bg-slate-700/60 hidden md:block" />

        {/* Copy All Code Button */}
        <button
          onClick={handleCopyCode}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            copiedCode
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
              : isDark
              ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm'
          }`}
          title="Copy entire editor code to clipboard"
        >
          {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
          <span className="hidden lg:inline">{copiedCode ? 'Copied' : 'Copy Code'}</span>
        </button>

        {/* Export / Download Button */}
        <button
          onClick={onExportCode}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            isDark
              ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm'
          }`}
          title={`Download code as ${currentLang.name} (${currentLang.extension})`}
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden xl:inline">Export {currentLang.extension}</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onThemeToggle}
          className={`p-1.5 rounded-lg border transition-colors ${
            isDark
              ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm'
          }`}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} theme`}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* User Profile Button */}
        <button
          onClick={onOpenProfile}
          className={`flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-lg border transition-all ${
            isDark
              ? 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-200'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-sm'
          }`}
          title="Customize nickname and cursor color"
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm border border-slate-900"
            style={{ backgroundColor: currentUser.color }}
          >
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-medium truncate max-w-[80px] hidden sm:inline">
            {currentUser.name}
          </span>
        </button>
      </div>
    </header>
  );
};
