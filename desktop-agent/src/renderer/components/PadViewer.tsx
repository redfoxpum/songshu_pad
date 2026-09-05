import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { EditorState, Compartment, Extension } from '@codemirror/state';
import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  highlightActiveLine,
} from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting, foldGutter, bracketMatching } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { yCollab } from 'y-codemirror.next';
import { Terminal, ShieldCheck } from 'lucide-react';

interface PadViewerProps {
  serverUrl: string;
  roomId: string;
  fontSize: number;
  wrapLines: boolean;
  opacity?: number;
  onLanguageChange?: (lang: string) => void;
  onCodeChange?: (code: string) => void;
}

export const transparentHighContrastStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: '#c084fc', fontWeight: '600' },
  { tag: [t.string, t.docString, t.processingInstruction], color: '#34d399' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.function(t.name)], color: '#60a5fa', fontWeight: '600' },
  { tag: [t.number, t.integer, t.float, t.bool, t.null], color: '#fbbf24' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: '#86efac', fontStyle: 'italic' },
  { tag: [t.operator, t.operatorKeyword, t.punctuation, t.separator, t.bracket, t.angleBracket, t.squareBracket, t.paren, t.brace], color: '#f472b6' },
  { tag: [t.propertyName], color: '#38bdf8' },
  { tag: [t.className, t.typeName, t.namespace, t.changed, t.annotation, t.modifier, t.self], color: '#38bdf8', fontWeight: '600' },
  { tag: [t.variableName, t.name, t.character, t.definition(t.name), t.definition(t.variableName), t.macroName, t.labelName], color: '#ffffff', fontWeight: '550' },
]);

const getLanguageExtension = (lang: string): Extension => {
  switch (lang.toLowerCase()) {
    case 'cpp':
    case 'c++':
      return cpp();
    case 'java':
      return java();
    case 'python':
    default:
      return python();
  }
};

const createEditorTheme = (fontSize: number) =>
  EditorView.theme({
    '&': {
      backgroundColor: 'transparent !important',
      color: '#ffffff',
      height: '100%',
      fontSize: `${fontSize}px`,
      fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Monaco, Consolas, monospace",
    },
    '.cm-scroller': {
      backgroundColor: 'transparent !important',
      overflow: 'auto',
      fontFamily: 'inherit',
    },
    '.cm-content': {
      backgroundColor: 'transparent !important',
      caretColor: '#60a5fa',
      padding: '12px 0',
      lineHeight: '1.7',
      letterSpacing: '0.3px',
      fontWeight: '550',
      textShadow: '0 1px 2px rgba(0, 0, 0, 0.95), 0 0 4px rgba(0, 0, 0, 0.85)',
    },
    '.cm-line': {
      lineHeight: '1.7',
      letterSpacing: '0.3px',
      fontWeight: '550',
      textShadow: '0 1px 2px rgba(0, 0, 0, 0.95), 0 0 4px rgba(0, 0, 0, 0.85)',
    },
    '.cm-cursor': {
      borderLeftColor: '#60a5fa',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(59, 130, 246, 0.35) !important',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent !important',
      color: 'rgba(226, 232, 240, 0.55) !important',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      paddingRight: '10px',
      paddingLeft: '8px',
      fontWeight: '500',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      color: '#ffffff !important',
      fontWeight: '600',
    },
  });

export const PadViewer: React.FC<PadViewerProps> = ({
  serverUrl,
  roomId,
  fontSize,
  wrapLines,
  opacity = 0.35,
  onLanguageChange,
  onCodeChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const langCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());
  const wrapCompartment = useRef(new Compartment());
  const [isEmpty, setIsEmpty] = useState<boolean>(true);
  const [currentLanguage, setCurrentLanguage] = useState<string>('python');

  // Initialize Yjs Doc & Provider
  const { doc, provider, yText, roomMeta } = useMemo(() => {
    const ydoc = new Y.Doc();
    const cleanUrl = (serverUrl || 'http://localhost:3000').trim().replace(/\/+$/, '');
    const protocol = cleanUrl.startsWith('https') ? 'wss:' : 'ws:';
    const host = cleanUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${protocol}//${host}/ws`;

    console.log(`[PadViewer] Connecting Yjs Doc to: ${wsUrl}, room: ${roomId}`);
    const wsProvider = new WebsocketProvider(wsUrl, roomId, ydoc);
    const text = ydoc.getText('codemirror');
    const meta = ydoc.getMap<any>('room-meta');

    return {
      doc: ydoc,
      provider: wsProvider,
      yText: text,
      roomMeta: meta,
    };
  }, [serverUrl, roomId]);

  // Observe language from room metadata
  useEffect(() => {
    const handleMeta = () => {
      const lang = (roomMeta.get('language') as string) || 'python';
      setCurrentLanguage(lang);
      if (onLanguageChange) {
        onLanguageChange(lang);
      }
    };

    handleMeta();
    roomMeta.observe(handleMeta);
    return () => {
      roomMeta.unobserve(handleMeta);
    };
  }, [roomMeta, onLanguageChange]);

  // Mount CodeMirror 6 View
  useEffect(() => {
    if (!containerRef.current) return;

    const undoManager = new Y.UndoManager(yText);

    const baseExtensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      foldGutter(),
      drawSelection(),
      bracketMatching(),
      highlightActiveLine(),
      syntaxHighlighting(transparentHighContrastStyle),
      yCollab(yText, provider.awareness, { undoManager }),
      langCompartment.current.of(getLanguageExtension(currentLanguage)),
      themeCompartment.current.of(createEditorTheme(fontSize)),
      wrapCompartment.current.of(wrapLines ? EditorView.lineWrapping : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const content = update.state.doc.toString();
          setIsEmpty(content.trim().length === 0);
          if (onCodeChange) {
            onCodeChange(content);
          }
        }
      }),
    ];

    const initialCode = yText.toString();
    setIsEmpty(initialCode.trim().length === 0);
    if (onCodeChange) {
      onCodeChange(initialCode);
    }

    const state = EditorState.create({
      doc: initialCode,
      extensions: baseExtensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [yText, provider]);

  // Dynamically update syntax language
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: langCompartment.current.reconfigure(getLanguageExtension(currentLanguage)),
      });
    }
  }, [currentLanguage]);

  // Dynamically update font size
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: themeCompartment.current.reconfigure(createEditorTheme(fontSize)),
      });
    }
  }, [fontSize]);

  // Dynamically update line wrapping
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: wrapCompartment.current.reconfigure(wrapLines ? EditorView.lineWrapping : []),
      });
    }
  }, [wrapLines]);

  // Cleanup provider on unmount
  useEffect(() => {
    return () => {
      try {
        provider.destroy();
        doc.destroy();
      } catch (e) {}
    };
  }, [provider, doc]);

  return (
    <div
      className="flex-1 w-full h-full flex flex-col relative overflow-hidden text-slate-100 select-text transition-colors duration-150"
      style={{
        backgroundColor: `rgba(15, 23, 42, ${opacity})`,
        backdropFilter: opacity < 0.98 ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: opacity < 0.98 ? 'blur(16px)' : 'none',
      }}
    >
      {/* CodeMirror Render Target */}
      <div ref={containerRef} className="w-full h-full overflow-hidden" />

      {/* Empty State Overlay (only when pad has 0 chars) */}
      {isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center select-none text-slate-300 pointer-events-none z-10">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300 mb-3 shadow-lg shadow-blue-500/10 animate-pulse">
            <Terminal className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-100 mb-1">Pad 暂无代码内容</p>
          <p className="text-xs text-slate-300 max-w-sm leading-relaxed">
            房主或您在协同 Web 页面中输入的代码将实时语法高亮呈现在此处。
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>防录屏隐形已激活 · 第三方会议共享不可见本窗口</span>
          </div>
        </div>
      )}
    </div>
  );
};
