import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Code2 } from 'lucide-react';
import { SupportedLanguage } from '../types';
import { LANGUAGES } from '../utils/languages';

interface LanguageSelectorProps {
  language: SupportedLanguage;
  onChange: (language: SupportedLanguage) => void;
  isDark: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  language,
  onChange,
  isDark,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES[language] || LANGUAGES.python;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (lang: SupportedLanguage) => {
    onChange(lang);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
        }`}
        title="Change programming language for all room participants"
      >
        <span className="text-sm">{currentLang.icon}</span>
        <span>{currentLang.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 mt-1.5 w-48 rounded-xl border shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 ${
            isDark ? 'bg-slate-900 border-slate-700 text-slate-200 shadow-black/50' : 'bg-white border-slate-200 text-slate-800 shadow-slate-300/50'
          }`}
        >
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/40 mb-1 flex items-center gap-1">
            <Code2 className="w-3 h-3 text-blue-400" />
            Live Synced Language
          </div>
          {(Object.keys(LANGUAGES) as SupportedLanguage[]).map((key) => {
            const item = LANGUAGES[key];
            const isSelected = language === key;
            return (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
                  isSelected
                    ? isDark
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'bg-blue-50 text-blue-600 font-semibold'
                    : isDark
                    ? 'hover:bg-slate-800 text-slate-300'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{item.icon}</span>
                  <span>{item.name}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-blue-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
