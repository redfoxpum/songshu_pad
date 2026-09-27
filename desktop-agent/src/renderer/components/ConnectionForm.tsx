import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight,
  History,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  X,
  Lock,
  Sparkles,
  Layers,
  ClipboardPaste,
} from 'lucide-react';
import { decodeConnectionToken } from '../../utils/token';

interface ConnectionFormProps {
  onConnect: (serverUrl: string, roomId: string) => Promise<void>;
  isConnecting: boolean;
  error: string | null;
}

const STORAGE_KEY_TOKEN = 'squirrel_agent_connect_key';
const STORAGE_KEY_SERVER = 'squirrel_agent_server_url';
const STORAGE_KEY_ROOM = 'squirrel_agent_room_id';
const STORAGE_KEY_LAST = 'squirrel_agent_last_connection';
const STORAGE_KEY_RECENTS = 'squirrel_agent_recent_tokens';

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  onConnect,
  isConnecting,
  error: externalError,
}) => {
  const [connectKey, setConnectKey] = useState('');
  const [serverUrl, setServerUrl] = useState('http://localhost:3000');
  const [lastConnection, setLastConnection] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedServer = localStorage.getItem(STORAGE_KEY_SERVER);
      if (savedServer) setServerUrl(savedServer);

      const savedLast =
        localStorage.getItem(STORAGE_KEY_LAST) ||
        localStorage.getItem(STORAGE_KEY_TOKEN) ||
        localStorage.getItem(STORAGE_KEY_ROOM);

      if (savedLast) {
        setConnectKey(savedLast);
        setLastConnection(savedLast);
      }

      // Clean up legacy multi-item recents so they do not persist
      localStorage.removeItem(STORAGE_KEY_RECENTS);
      localStorage.removeItem('squirrel_agent_recent_rooms');
    } catch (e) {
      console.warn('Failed to load connection storage:', e);
    }
  }, []);

  // Realtime token parsing
  const parsedInfo = useMemo(() => {
    return decodeConnectionToken(connectKey, serverUrl);
  }, [connectKey, serverUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmed = connectKey.trim();
    if (!trimmed) {
      setLocalError('请输入协同连接码或房间编号');
      return;
    }

    // Check if user entered an sqp_ token that is invalid/corrupted
    if (trimmed.toLowerCase().startsWith('sqp_')) {
      const decoded = decodeConnectionToken(trimmed, serverUrl);
      if (!decoded || !decoded.roomId) {
        setLocalError('协同连接码无效或已损坏，请重新复制有效连接码');
        return;
      }
    }

    const decoded = decodeConnectionToken(trimmed, serverUrl);
    if (!decoded || !decoded.roomId || decoded.roomId.length < 2) {
      setLocalError('协同连接码或房间号不合法，请检查输入是否完整正确');
      return;
    }

    // Save only the single last connection to localStorage
    try {
      localStorage.setItem(STORAGE_KEY_TOKEN, trimmed);
      localStorage.setItem(STORAGE_KEY_LAST, trimmed);
      localStorage.setItem(STORAGE_KEY_SERVER, decoded.serverUrl);
      localStorage.setItem(STORAGE_KEY_ROOM, decoded.roomId);
      setLastConnection(trimmed);

      // Clean up legacy multi-history
      localStorage.removeItem(STORAGE_KEY_RECENTS);
      localStorage.removeItem('squirrel_agent_recent_rooms');
    } catch (err) {
      // ignore
    }

    onConnect(decoded.serverUrl, decoded.roomId);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setConnectKey(text.trim());
        setLocalError(null);
      }
    } catch (err) {
      console.warn('Clipboard read failed:', err);
    }
  };

  const handleClearLastConnection = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLastConnection(null);
    try {
      localStorage.removeItem(STORAGE_KEY_LAST);
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_ROOM);
    } catch (err) {
      // ignore
    }
    if (connectKey === lastConnection) {
      setConnectKey('');
    }
  };

  const formatDisplayLabel = (token: string) => {
    if (token.startsWith('sqp_')) {
      return `口令 ${token.slice(0, 10)}...`;
    }
    return token.length > 20 ? `${token.slice(0, 18)}...` : token;
  };

  const displayError = localError || externalError;

  return (
    <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3.5 select-none font-sans">
      {/* Hero Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center shadow-xs">
            <span className="text-base leading-none drop-shadow-xs">🐿️</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white tracking-tight">松鼠Pad 伴侣端</span>
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.2 rounded-full">
                就绪
              </span>
            </div>
            <span className="block text-[11px] text-slate-400 mt-0.5">
              输入口令或房间码，秒级同步代码与桌面
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400/90 bg-white/[0.04] border border-white/10 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>STANDBY</span>
        </div>
      </div>

      {/* Error alert if any */}
      {displayError && (
        <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2 text-rose-200 text-xs animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
          <span className="leading-tight">{displayError}</span>
        </div>
      )}

      {/* Single Unified Connection Code Card */}
      <div className="glass-subcard rounded-2xl p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>协同访问口令 / 房间码</span>
          </label>

          {/* Token Parsing Indicator Badge */}
          {parsedInfo && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 transition-all ${
                parsedInfo.isEncryptedToken
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 shadow-xs'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/35'
              }`}
            >
              {parsedInfo.isEncryptedToken ? (
                <>
                  <Lock className="w-2.5 h-2.5" />
                  <span>加密凭证 (地址已保护)</span>
                </>
              ) : (
                <>
                  <Layers className="w-2.5 h-2.5" />
                  <span>房间号: {parsedInfo.roomId}</span>
                </>
              )}
            </span>
          )}
        </div>

        {/* Input box with integrated Paste & Clear buttons */}
        <div className="relative flex items-center">
          <input
            type="text"
            value={connectKey}
            onChange={(e) => {
              setConnectKey(e.target.value);
              setLocalError(null);
            }}
            placeholder="粘贴主控分享的口令 (如 sqp_...) 或房间码"
            required
            autoFocus
            className="w-full pl-3 pr-16 py-2.5 text-xs font-mono bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 app-no-drag transition tracking-wide shadow-inner"
          />

          <div className="absolute right-1.5 flex items-center gap-1">
            {connectKey ? (
              <button
                type="button"
                onClick={() => setConnectKey('')}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition app-no-drag"
                title="清空输入"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="flex items-center gap-1 px-2 py-1 bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 text-[10px] font-sans font-medium rounded-lg border border-white/10 transition active:scale-95 app-no-drag shadow-xs"
                title="从剪贴板一键粘贴"
              >
                <ClipboardPaste className="w-3 h-3 text-emerald-400" />
                <span>粘贴</span>
              </button>
            )}
          </div>
        </div>

        {/* Only show the single last connection if present */}
        {lastConnection && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-sans">
              <History className="w-3 h-3 text-slate-400" />
              <span>上次:</span>
            </div>
            <div
              onClick={() => {
                setConnectKey(lastConnection);
                setLocalError(null);
              }}
              className={`group flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border cursor-pointer transition-all duration-150 app-no-drag ${
                connectKey === lastConnection
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                  : 'bg-white/[0.04] text-slate-400 border-white/10 hover:bg-white/[0.08] hover:text-slate-200'
              }`}
              title="点击填入上次连接口令"
            >
              <span>{formatDisplayLabel(lastConnection)}</span>
              <button
                type="button"
                onClick={handleClearLastConnection}
                className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity ml-0.5"
                title="清除上次连接记录"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isConnecting || !connectKey.trim()}
        className="relative group mt-0.5 flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 disabled:from-slate-800 disabled:via-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 border border-emerald-400/30 transition-all duration-200 active:scale-[0.99] app-no-drag overflow-hidden"
      >
        {isConnecting ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            <span>正在建立加密连接...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            <span>一键连接房间</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </>
        )}
      </button>

      {/* Bottom Privacy & Stealth Assurance */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/90" />
          <span>防录屏隐形已激活 · 第三方会议共享不可见</span>
        </div>
        <span className="font-mono text-slate-500">v1.1.0</span>
      </div>
    </form>
  );
};
