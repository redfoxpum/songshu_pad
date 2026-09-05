import React, { useState, useEffect, useMemo } from 'react';
import {
  Radio,
  ArrowRight,
  History,
  AlertCircle,
  ShieldCheck,
  Globe,
  KeyRound,
  ChevronDown,
  ChevronUp,
  X,
  Lock,
  Sparkles,
  Layers,
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
const STORAGE_KEY_RECENTS = 'squirrel_agent_recent_tokens';

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  onConnect,
  isConnecting,
  error: externalError,
}) => {
  const [connectKey, setConnectKey] = useState('');
  const [serverUrl, setServerUrl] = useState('http://localhost:3000');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [recentTokens, setRecentTokens] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedServer = localStorage.getItem(STORAGE_KEY_SERVER);
      if (savedServer) setServerUrl(savedServer);

      const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN) || localStorage.getItem(STORAGE_KEY_ROOM);
      if (savedToken) setConnectKey(savedToken);

      const savedRecents = localStorage.getItem(STORAGE_KEY_RECENTS) || localStorage.getItem('squirrel_agent_recent_rooms');
      if (savedRecents) {
        setRecentTokens(JSON.parse(savedRecents));
      }
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

    const decoded = decodeConnectionToken(trimmed, serverUrl);
    if (!decoded || !decoded.roomId) {
      setLocalError('无法识别此连接码，请检查输入是否完整');
      return;
    }

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY_TOKEN, trimmed);
      localStorage.setItem(STORAGE_KEY_SERVER, decoded.serverUrl);
      localStorage.setItem(STORAGE_KEY_ROOM, decoded.roomId);

      const updatedRecents = [trimmed, ...recentTokens.filter((r) => r !== trimmed)].slice(0, 4);
      setRecentTokens(updatedRecents);
      localStorage.setItem(STORAGE_KEY_RECENTS, JSON.stringify(updatedRecents));
    } catch (err) {
      // ignore
    }

    onConnect(decoded.serverUrl, decoded.roomId);
  };

  const handleSelectRecent = (token: string) => {
    setConnectKey(token);
    setLocalError(null);
  };

  const handleRemoveRecent = (e: React.MouseEvent, tokenToRemove: string) => {
    e.stopPropagation();
    const updated = recentTokens.filter((r) => r !== tokenToRemove);
    setRecentTokens(updated);
    try {
      localStorage.setItem(STORAGE_KEY_RECENTS, JSON.stringify(updated));
    } catch (err) {
      // ignore
    }
  };

  const displayError = localError || externalError;

  return (
    <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3 select-none">
      {/* Title & Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-100 tracking-tight">接入协同面试房间</span>
            <span className="block text-[10px] text-slate-400">输入单一口令即时同步桌面与代码</span>
          </div>
        </div>

        <span className="text-[10px] font-mono text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          READY
        </span>
      </div>

      {/* Error alert if any */}
      {displayError && (
        <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 flex items-start gap-2 text-rose-300 text-[11px] animate-in fade-in duration-150">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-400" />
          <span className="leading-tight">{displayError}</span>
        </div>
      )}

      {/* Single Unified Connection Code Card */}
      <div className="glass-subcard rounded-xl p-3 border border-white/5 flex flex-col gap-2 bg-slate-900/40">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>协同访问口令 / 连接码</span>
          </label>

          {/* Token Parsing Indicator Badge */}
          {parsedInfo && (
            <span
              className={`text-[9px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 transition-all ${
                parsedInfo.isEncryptedToken
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}
            >
              {parsedInfo.isEncryptedToken ? (
                <>
                  <Lock className="w-2.5 h-2.5" />
                  <span>加密凭证 (URL已隐藏)</span>
                </>
              ) : (
                <>
                  <Layers className="w-2.5 h-2.5" />
                  <span>已识别房间: {parsedInfo.roomId}</span>
                </>
              )}
            </span>
          )}
        </div>

        {/* Input box */}
        <div className="relative">
          <input
            type="text"
            value={connectKey}
            onChange={(e) => {
              setConnectKey(e.target.value);
              setLocalError(null);
            }}
            placeholder="粘贴主控端分享的口令 (如 sqp_...) 或房间码"
            required
            autoFocus
            className="w-full px-3 py-2 text-xs font-mono bg-slate-950/90 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/40 app-no-drag transition tracking-wide shadow-inner"
          />
        </div>

        {/* Recent Tokens / Rooms Chips */}
        {recentTokens.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <div className="flex items-center gap-1 text-[9px] text-slate-500">
              <History className="w-2.5 h-2.5" />
              <span>历史:</span>
            </div>
            {recentTokens.map((token) => {
              const isEnc = token.startsWith('sqp_');
              const displayLabel = isEnc
                ? `口令 ${token.slice(0, 10)}...`
                : token.length > 20
                ? `${token.slice(0, 18)}...`
                : token;

              return (
                <div
                  key={token}
                  onClick={() => handleSelectRecent(token)}
                  className={`group flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border cursor-pointer transition-all duration-150 app-no-drag ${
                    connectKey === token
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                      : 'bg-slate-900/80 text-slate-400 border-white/10 hover:bg-slate-800 hover:text-slate-200 hover:border-white/20'
                  }`}
                >
                  <span>{displayLabel}</span>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveRecent(e, token)}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity"
                    title="清除记录"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Advanced Settings Collapsible (Optional Custom Server) */}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="flex items-center justify-between px-2 py-1 text-[10px] text-slate-400 hover:text-slate-300 transition-colors app-no-drag"
        >
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3 text-slate-500" />
            <span>自定义服务端 / 本地调试 (可选)</span>
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-3 h-3 text-slate-500" />
          ) : (
            <ChevronDown className="w-3 h-3 text-slate-500" />
          )}
        </button>

        {showAdvanced && (
          <div className="glass-subcard rounded-xl p-2.5 border border-white/5 flex flex-col gap-1.5 bg-slate-950/40 animate-in fade-in zoom-in-98 duration-150">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-slate-400">默认服务器地址 (仅对非加密口令生效)</label>
              <span className="text-[9px] font-mono text-slate-500">HTTP / WS</span>
            </div>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://localhost:3000"
              className="w-full px-2.5 py-1.5 text-[11px] font-mono bg-slate-950/80 border border-white/10 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/70 app-no-drag transition"
            />
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isConnecting || !connectKey.trim()}
        className="relative group mt-1 flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/50 border border-emerald-400/40 transition-all duration-200 active:scale-[0.98] app-no-drag overflow-hidden"
      >
        {isConnecting ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
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
        <div className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-500/80" />
          <span>防录屏隐形已激活</span>
        </div>
        <span className="font-mono text-slate-600">v1.1.0</span>
      </div>
    </form>
  );
};
