import React, { useState } from 'react';
import { SupportedLanguage, RoomItem } from '../types';
import { createRoom } from '../utils/api';
import { X, Plus, Code2, User, Loader2, Sparkles } from 'lucide-react';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (room: RoomItem) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  onNotify,
}) => {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<SupportedLanguage>('python');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const room = await createRoom(language, name.trim() || undefined);
      onNotify(`🎉 房间创建成功: ${room.name || room.id}`, 'success');
      onCreated(room);
      setName('');
      onClose();
    } catch (err: any) {
      onNotify(`创建房间失败: ${err.message || '未知错误'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const languages: Array<{ id: SupportedLanguage; label: string; icon: string; desc: string }> = [
    { id: 'python', label: 'Python 3', icon: '🐍', desc: '内置常用算法模板与类型注解' },
    { id: 'cpp', label: 'C++ 20', icon: '⚡', desc: '标准 C++ 基础与常用头文件引入' },
    { id: 'java', label: 'Java 21', icon: '☕', desc: '标准 Solution 类结构与集合模板' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#111827] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#161F37]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">创建新面试房间</h3>
              <p className="text-xs text-slate-400">初始化独立协同代码与截图监控空间</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Candidate Name / Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              候选人姓名 / 场次备注
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如: 张三 - 算法一面 / 研发二面"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* Initial Language Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              初始编程语言 (可随时在房间内切换)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {languages.map((lang) => {
                const selected = language === lang.id;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => setLanguage(lang.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                      selected
                        ? 'border-emerald-500/80 bg-emerald-950/40 text-white ring-1 ring-emerald-500/50 shadow-lg shadow-emerald-900/20'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-2xl mb-1.5">{lang.icon}</span>
                    <span className="text-sm font-semibold">{lang.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tip */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>房间创建后将自动生成专属短网址，并初始化 `./data/rooms/&lt;roomId&gt;/screenshots/` 截图目录。</span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在创建...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>立即创建房间</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
