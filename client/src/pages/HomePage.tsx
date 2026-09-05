import React, { useState, useEffect } from 'react';
import {
  LogIn,
  Clock,
  Trash2,
  Sparkles,
  Zap,
  ShieldCheck,
  Users,
  ArrowRight,
} from 'lucide-react';
import { RecentRoom } from '../types';
import { LANGUAGES } from '../utils/languages';
import { getRecentRooms, removeRecentRoom, clearRecentRooms } from '../utils/storage';

import { decodeConnectionToken } from '../utils/token';

interface HomePageProps {
  onJoinRoom: (roomId: string) => void;
  onShowToast: (type: 'success' | 'info' | 'warning' | 'error', msg: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onJoinRoom, onShowToast }) => {
  const [joinInput, setJoinInput] = useState('');
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);

  useEffect(() => {
    setRecentRooms(getRecentRooms());
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = joinInput.trim();
    if (!raw) return;

    // Smart decode token or URL
    const decoded = decodeConnectionToken(raw);
    if (decoded && decoded.roomId) {
      onJoinRoom(decoded.roomId);
      return;
    }

    let id = raw;
    // Handle full URL pasted in input
    try {
      if (id.includes('/room/') || id.includes('?room=')) {
        const url = new URL(id);
        const match = url.pathname.match(/\/room\/([a-zA-Z0-9_-]+)/);
        if (match) {
          id = match[1];
        } else if (url.searchParams.has('room')) {
          id = url.searchParams.get('room') || id;
        }
      }
    } catch {
      // Keep string as is
    }

    // Sanitize ID
    id = id.replace(/[^a-zA-Z0-9_-]/g, '');
    if (id) {
      onJoinRoom(id);
    } else {
      onShowToast('warning', 'Please enter a valid room ID or connection token');
    }
  };

  const handleRemoveRecent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = removeRecentRoom(id);
    setRecentRooms(updated);
  };

  const handleClearAll = () => {
    clearRecentRooms();
    setRecentRooms([]);
    onShowToast('info', 'Recent room history cleared.');
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

      {/* Top Navbar */}
      <nav className="relative z-10 max-w-7xl mx-auto w-full px-6 py-5 flex items-center justify-between border-b border-slate-900/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/25 text-lg">
            🐿️
          </div>
          <span className="font-bold text-lg tracking-tight text-white">松鼠Pad</span>
          <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Realtime CRDT
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400 hidden sm:flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Live Sync Ready
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto w-full px-6 py-10 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300 mb-5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Sub-millisecond Real-Time Collaborative Coding
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            Code together in real-time,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400">
              effortlessly.
            </span>
          </h1>
          <p className="text-base text-slate-400 max-w-2xl mx-auto">
            Lightweight, high-performance collaborative code editor powered by Yjs CRDTs and CodeMirror 6.
            Zero login friction, multi-language support, and persistent state.
          </p>
        </div>

        {/* Single Centered Action Card: Join Existing Room & History */}
        <div className="max-w-xl mx-auto w-full mb-12">
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-xl hover:border-slate-700 transition-all">
            <div>
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-2">
                <LogIn className="w-4 h-4" />
                Join Collaborative Room
              </div>
              <h2 className="text-xl font-bold text-white mb-1">输入房间码或协作链接</h2>
              <p className="text-xs text-slate-400 mb-5">
                请粘贴主持人 / 面试官分享的房间链接或输入房间编号加入。
              </p>

              <div className="mb-5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
                <span className="text-sm shrink-0">ℹ️</span>
                <span>所有协同房间均由主持人通过 <strong>macOS 主控端 App</strong> 统一创建与管理。</span>
              </div>

              <form onSubmit={handleJoin} className="space-y-4 mb-6">
                <div>
                  <input
                    type="text"
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    placeholder="例如: python-stride-a1b2 或完整网页链接"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
                >
                  <LogIn className="w-4 h-4" />
                  <span>加入协同房间</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Recent Rooms */}
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/60 mb-2">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Recent Rooms
                  </span>
                  {recentRooms.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Clear History
                    </button>
                  )}
                </div>

                {recentRooms.length === 0 ? (
                  <p className="text-xs text-slate-600 py-3 text-center italic">
                    No recent rooms visited yet
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {recentRooms.map((room) => {
                      const langConfig = LANGUAGES[room.language] || LANGUAGES.python;
                      return (
                        <div
                          key={room.id}
                          onClick={() => onJoinRoom(room.id)}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/60 hover:border-slate-700 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs">{langConfig.icon}</span>
                            <span className="text-xs font-medium text-slate-300 group-hover:text-white truncate">
                              {room.name || room.id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-slate-500">
                              {formatTimeAgo(room.visitedAt)}
                            </span>
                            <button
                              onClick={(e) => handleRemoveRecent(room.id, e)}
                              className="text-slate-600 hover:text-rose-400 p-1 rounded transition-colors"
                              title="Remove from history"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Feature Pillars */}
        <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto w-full">
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white mb-0.5">Yjs CRDT Synchronization</h3>
              <p className="text-[11px] text-slate-400">
                Conflict-free replicated data types ensure immediate, lossless convergence for concurrent edits.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white mb-0.5">Real-time Presence & Cursors</h3>
              <p className="text-[11px] text-slate-400">
                Customizable colorful name tags and live selection highlighting for every collaborator.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white mb-0.5">Persistent & Single Port</h3>
              <p className="text-[11px] text-slate-400">
                Binary auto-saved documents survive restarts. Single port ready for Cloudflare Tunnel and ngrok.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 border-t border-slate-900/60 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>🐿️ 松鼠Pad 实时协同代码编辑空间</div>
        <div className="flex items-center gap-4">
          <span>Python 3</span>
          <span>•</span>
          <span>C++ 20</span>
          <span>•</span>
          <span>Java 21</span>
        </div>
      </footer>
    </div>
  );
};
