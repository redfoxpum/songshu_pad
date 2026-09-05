import React, { useState, useRef, useEffect } from 'react';
import { Users, ShieldCheck } from 'lucide-react';
import { RemoteParticipant } from '../types';

interface ParticipantsListProps {
  participants: RemoteParticipant[];
  isDark: boolean;
  onOpenProfile: () => void;
}

export const ParticipantsList: React.FC<ParticipantsListProps> = ({
  participants,
  isDark,
  onOpenProfile,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalCount = participants.length;
  // Show first 4 avatars
  const visibleParticipants = participants.slice(0, 4);
  const overflowCount = totalCount - visibleParticipants.length;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
        }`}
        title="View active collaborators"
      >
        <div className="flex -space-x-1.5 items-center overflow-hidden">
          {visibleParticipants.map((p) => (
            <div
              key={p.clientId}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm border border-slate-900 ring-1 ring-white/20"
              style={{ backgroundColor: p.user.color }}
              title={`${p.user.name}${p.isSelf ? ' (You)' : ''}`}
            >
              {p.user.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {overflowCount > 0 && (
            <div className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center text-[9px] font-bold border border-slate-900">
              +{overflowCount}
            </div>
          )}
        </div>
        <span className="ml-1 text-[11px] font-semibold text-slate-400">
          {totalCount} {totalCount === 1 ? 'user' : 'users'}
        </span>
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 mt-1.5 w-64 rounded-xl border shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100 ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-slate-200 shadow-black/50'
              : 'bg-white border-slate-200 text-slate-800 shadow-slate-300/50'
          }`}
        >
          <div className="px-3 py-1.5 border-b border-slate-800/40 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              Collaborators ({totalCount})
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenProfile();
              }}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-medium underline-offset-2 hover:underline"
            >
              Edit Profile
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/20 py-1">
            {participants.map((p) => (
              <div
                key={p.clientId}
                className={`flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                  isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0 border"
                    style={{ backgroundColor: p.user.color, borderColor: p.user.color }}
                  >
                    {p.user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium truncate text-slate-200">
                    {p.user.name}
                  </span>
                </div>
                {p.isSelf ? (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <ShieldCheck className="w-3 h-3" />
                    You
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" title="Active" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
