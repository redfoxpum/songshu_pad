import { Extension } from '@codemirror/state';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { SupportedLanguage } from '../types';

export interface LanguageConfig {
  id: SupportedLanguage;
  name: string;
  extension: string;
  mime: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
  getExtension: () => Extension;
}

export const LANGUAGES: Record<SupportedLanguage, LanguageConfig> = {
  python: {
    id: 'python',
    name: 'Python 3',
    extension: '.py',
    mime: 'text/x-python',
    icon: '🐍',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    badgeText: 'Python',
    getExtension: () => python(),
  },
  cpp: {
    id: 'cpp',
    name: 'C++ 20',
    extension: '.cpp',
    mime: 'text/x-c++src',
    icon: '⚡',
    badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    badgeText: 'C++',
    getExtension: () => cpp(),
  },
  java: {
    id: 'java',
    name: 'Java 21',
    extension: '.java',
    mime: 'text/x-java',
    icon: '☕',
    badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    badgeText: 'Java',
    getExtension: () => java(),
  },
};

export function getLanguageExtension(language: SupportedLanguage): Extension {
  return LANGUAGES[language]?.getExtension() || python();
}
