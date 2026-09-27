import React, { useEffect, useRef, useState } from 'react';
import { EditorState, Compartment, Extension } from '@codemirror/state';
import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  highlightActiveLine,
  keymap,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting, foldGutter, foldKeymap, bracketMatching } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
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
  { tag: [t.string, t.docString, t.processingInstruction], color: '#6ee7b7' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.function(t.name)], color: '#38bdf8', fontWeight: '600' },
  { tag: [t.number, t.integer, t.float, t.bool, t.null], color: '#fbbf24' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: '#94a3b8', fontStyle: 'italic' },
  { tag: [t.operator, t.operatorKeyword, t.punctuation, t.separator, t.bracket, t.angleBracket, t.squareBracket, t.paren, t.brace], color: '#f472b6' },
  { tag: [t.propertyName], color: '#7dd3fc' },
  { tag: [t.className, t.typeName, t.namespace, t.changed, t.annotation, t.modifier, t.self], color: '#818cf8', fontWeight: '600' },
  { tag: [t.variableName, t.name, t.character, t.definition(t.name), t.definition(t.variableName), t.macroName, t.labelName], color: '#f8fafc', fontWeight: '500' },
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
      color: '#f8fafc',
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
      caretColor: '#38bdf8',
      padding: '12px 0',
      lineHeight: '1.7',
      letterSpacing: '0.2px',
      fontWeight: '500',
      textShadow: '0 1px 3px rgba(0, 0, 0, 0.75)',
    },
    '.cm-line': {
      lineHeight: '1.7',
      letterSpacing: '0.2px',
      fontWeight: '500',
      textShadow: '0 1px 3px rgba(0, 0, 0, 0.75)',
    },
    '.cm-cursor': {
      borderLeftColor: '#38bdf8',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(56, 189, 248, 0.28) !important',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent !important',
      color: 'rgba(148, 163, 184, 0.45) !important',
      borderRight: '1px solid rgba(255, 255, 255, 0.06)',
      paddingRight: '10px',
      paddingLeft: '8px',
      fontWeight: '500',
      fontSize: '0.9em',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
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

  const clientIdRef = useRef<string>(
    `agent_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`
  );
  const versionRef = useRef<number>(0);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isApplyingRemoteRef = useRef<boolean>(false);

  const cleanServer = (serverUrl || 'http://localhost:3000').trim().replace(/\/+$/, '');

  // Helper to fetch code via IPC or Web Fetch
  const fetchCodeApi = async (sinceVersion?: number, waitMs?: number) => {
    if (window.electronAPI?.fetchRoomCode) {
      return await window.electronAPI.fetchRoomCode(cleanServer, roomId, sinceVersion, waitMs);
    }
    let url = `${cleanServer}/api/rooms/${encodeURIComponent(roomId)}/code`;
    const params = new URLSearchParams();
    if (sinceVersion !== undefined && sinceVersion >= 0) params.append('sinceVersion', String(sinceVersion));
    if (waitMs !== undefined && waitMs > 0) params.append('waitMs', String(waitMs));
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  };

  // Helper to push code via IPC or Web Fetch
  const pushCodeApi = async (payload: { code: string; language?: string; clientId?: string; author?: string }) => {
    if (window.electronAPI?.pushRoomCode) {
      return await window.electronAPI.pushRoomCode(cleanServer, roomId, payload);
    }
    const res = await fetch(`${cleanServer}/api/rooms/${encodeURIComponent(roomId)}/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  };

  // Push local edits to server
  const pushCodeUpdate = async (codeToSave: string) => {
    try {
      const data = await pushCodeApi({
        code: codeToSave,
        language: currentLanguage,
        clientId: clientIdRef.current,
        author: 'Desktop Agent',
      });
      if (data && data.version) {
        versionRef.current = data.version;
      }
    } catch (err) {
      console.warn('[PadViewer] Push update failed:', err);
    }
  };

  // Mount CodeMirror & Initial Code Fetch & Long Polling
  useEffect(() => {
    if (!roomId || !roomId.trim()) return;

    let isMounted = true;

    const initEditor = async () => {
      let initialCode = '';
      let initialVersion = 0;
      let initialLang = 'python';

      try {
        const data = await fetchCodeApi();
        if (data && (data.code !== undefined || data.success)) {
          initialCode = data.code || '';
          initialVersion = data.version || 1;
          versionRef.current = initialVersion;
          if (data.language) {
            initialLang = data.language;
            setCurrentLanguage(data.language);
            onLanguageChange?.(data.language);
          }
        }
      } catch (e) {
        console.warn('[PadViewer] Initial fetch failed:', e);
      }

      if (!isMounted || !containerRef.current) return;

      setIsEmpty(initialCode.trim().length === 0);
      onCodeChange?.(initialCode);

      const baseExtensions: Extension[] = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        bracketMatching(),
        highlightActiveLine(),
        syntaxHighlighting(transparentHighContrastStyle, { fallback: true }),
        keymap.of([
          {
            key: 'Mod-Shift-ArrowDown',
            run: (view) => {
              const scroller = view.scrollDOM;
              const halfPage = Math.round((scroller.clientHeight || 300) * 0.5);
              scroller.scrollBy({ top: halfPage, behavior: 'smooth' });
              window.dispatchEvent(new CustomEvent('page-scroll-toast', { detail: 'down' }));
              return true;
            },
          },
          {
            key: 'Mod-Shift-ArrowUp',
            run: (view) => {
              const scroller = view.scrollDOM;
              const halfPage = Math.round((scroller.clientHeight || 300) * 0.5);
              scroller.scrollBy({ top: -halfPage, behavior: 'smooth' });
              window.dispatchEvent(new CustomEvent('page-scroll-toast', { detail: 'up' }));
              return true;
            },
          },
          {
            key: 'Mod-Shift-=',
            run: () => {
              window.electronAPI?.adjustWindowHeight(60);
              return true;
            },
          },
          {
            key: 'Mod-Shift-+',
            run: () => {
              window.electronAPI?.adjustWindowHeight(60);
              return true;
            },
          },
          {
            key: 'Mod-Shift--',
            run: () => {
              window.electronAPI?.adjustWindowHeight(-60);
              return true;
            },
          },
          ...defaultKeymap,
          ...foldKeymap,
          ...historyKeymap,
        ]),
        langCompartment.current.of(getLanguageExtension(initialLang)),
        themeCompartment.current.of(createEditorTheme(fontSize)),
        wrapCompartment.current.of(wrapLines ? EditorView.lineWrapping : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isApplyingRemoteRef.current) {
            const content = update.state.doc.toString();
            setIsEmpty(content.trim().length === 0);
            onCodeChange?.(content);

            if (saveTimerRef.current) {
              clearTimeout(saveTimerRef.current);
            }
            saveTimerRef.current = setTimeout(() => {
              pushCodeUpdate(content);
            }, 100);
          }
        }),
      ];

      const state = EditorState.create({
        doc: initialCode,
        extensions: baseExtensions,
      });

      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;

      // Long-polling loop
      const startLongPolling = async () => {
        while (isMounted) {
          try {
            const data = await fetchCodeApi(versionRef.current, 8000);
            if (!isMounted) break;

            if (data && data.success && data.version > versionRef.current) {
              versionRef.current = data.version;

              if (data.clientId !== clientIdRef.current && viewRef.current) {
                const currentView = viewRef.current;
                const localDoc = currentView.state.doc.toString();
                if (localDoc !== data.code) {
                  isApplyingRemoteRef.current = true;
                  const prevSel = currentView.state.selection.main;
                  const prevScrollTop = currentView.scrollDOM.scrollTop;
                  const prevScrollLeft = currentView.scrollDOM.scrollLeft;

                  currentView.dispatch({
                    changes: { from: 0, to: localDoc.length, insert: data.code },
                    selection: {
                      anchor: Math.min(prevSel.anchor, data.code.length),
                      head: Math.min(prevSel.head, data.code.length),
                    },
                  });

                  requestAnimationFrame(() => {
                    if (currentView.scrollDOM) {
                      currentView.scrollDOM.scrollTop = prevScrollTop;
                      currentView.scrollDOM.scrollLeft = prevScrollLeft;
                    }
                  });
                  currentView.requestMeasure({
                    read: () => {},
                    write: () => {
                      if (currentView.scrollDOM) {
                        currentView.scrollDOM.scrollTop = prevScrollTop;
                        currentView.scrollDOM.scrollLeft = prevScrollLeft;
                      }
                    },
                  });

                  isApplyingRemoteRef.current = false;
                  setIsEmpty(data.code.trim().length === 0);
                  onCodeChange?.(data.code);
                }
              }

              if (data.language && data.language !== currentLanguage) {
                setCurrentLanguage(data.language);
                onLanguageChange?.(data.language);
              }
            } else if (!data || !data.success) {
              await new Promise((r) => setTimeout(r, 1000));
            }
          } catch (err) {
            if (!isMounted) break;
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
      };

      startLongPolling();
    };

    initEditor();

    return () => {
      isMounted = false;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [serverUrl, roomId]);

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

  // Listen to external scroll page events (from IPC or App-level hotkeys)
  useEffect(() => {
    const handleScrollEvent = (e: any) => {
      const direction = e.detail?.direction || e.detail;
      if (!viewRef.current) return;
      const scroller = viewRef.current.scrollDOM;
      if (!scroller) return;
      const clientHeight = scroller.clientHeight || 300;
      const halfPage = Math.round(clientHeight * 0.5);
      const delta = direction === 'down' ? halfPage : -halfPage;
      scroller.scrollBy({ top: delta, behavior: 'smooth' });
    };

    window.addEventListener('scroll-editor-page', handleScrollEvent);
    return () => {
      window.removeEventListener('scroll-editor-page', handleScrollEvent);
    };
  }, []);

  return (
    <div
      className="flex-1 w-full h-full flex flex-col relative overflow-hidden text-slate-100 select-text transition-colors duration-200"
      style={{
        backgroundColor: `rgba(10, 15, 26, ${opacity})`,
        backdropFilter: opacity < 0.98 ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: opacity < 0.98 ? 'blur(20px)' : 'none',
      }}
    >
      {/* CodeMirror Render Target */}
      <div ref={containerRef} className="w-full h-full overflow-hidden" />

      {/* Empty State Overlay */}
      {isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center select-none text-slate-300 pointer-events-none z-10 font-sans">
          <div className="relative mb-3 flex items-center justify-center">
            <div className="absolute w-16 h-16 rounded-full bg-cyan-500/15 blur-xl animate-pulse" />
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-950/30">
              <Terminal className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm font-bold text-white tracking-tight mb-1">协同代码画布已就绪</p>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            等待房主或您的输入，多端编辑将毫秒级在此高亮同步
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-[10px] px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>防录屏隐形已激活 · 第三方会议共享不可见本窗口</span>
          </div>
        </div>
      )}
    </div>
  );
};
