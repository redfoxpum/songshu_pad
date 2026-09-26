import React, { useEffect, useRef, useState } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  bracketMatching,
} from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { SupportedLanguage, EditorTheme, UserProfile } from '../types';
import { getLanguageExtension } from '../utils/languages';

interface CodeEditorProps {
  roomId: string;
  language: SupportedLanguage;
  theme: EditorTheme;
  currentUser?: UserProfile;
  onLanguageChange?: (lang: SupportedLanguage) => void;
  onCodeChange?: (code: string) => void;
  onSyncStatus?: (status: 'connected' | 'syncing' | 'error') => void;
}

const lightEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: '#1e293b',
    height: '100%',
    fontSize: '14px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  '.cm-content': {
    caretColor: '#2563eb',
    padding: '12px 0',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#2563eb',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: '#dbeafe',
  },
  '.cm-gutters': {
    backgroundColor: '#f8fafc',
    color: '#94a3b8',
    borderRight: '1px solid #e2e8f0',
    paddingRight: '8px',
  },
  '.cm-activeLine': {
    backgroundColor: '#f1f5f9',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#e2e8f0',
    color: '#334155',
  },
});

const darkEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    height: '100%',
    fontSize: '14px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  '.cm-content': {
    caretColor: '#60a5fa',
    padding: '12px 0',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#60a5fa',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: '#1e3a8a40',
  },
  '.cm-gutters': {
    backgroundColor: '#090d16',
    color: '#475569',
    borderRight: '1px solid #1e293b',
    paddingRight: '8px',
  },
  '.cm-activeLine': {
    backgroundColor: '#1e293b50',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
  },
});

export const CodeEditor: React.FC<CodeEditorProps> = ({
  roomId,
  language,
  theme,
  currentUser,
  onLanguageChange,
  onCodeChange,
  onSyncStatus,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const langCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());

  const clientIdRef = useRef<string>(
    `client_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`
  );
  const versionRef = useRef<number>(0);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isApplyingRemoteRef = useRef<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Send local changes to server via REST POST
  const pushCodeUpdate = async (codeToSave: string) => {
    try {
      onSyncStatus?.('syncing');
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeToSave,
          language,
          clientId: clientIdRef.current,
          author: currentUser?.name || 'Anonymous',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.version) {
          versionRef.current = data.version;
        }
        onSyncStatus?.('connected');
      }
    } catch (err) {
      console.error('[CodeEditor] Push code update failed:', err);
      onSyncStatus?.('error');
    }
  };

  // Mount CodeMirror & Initial Code Fetch
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const initEditor = async () => {
      let initialCode = '';
      let initialVersion = 0;

      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/code`);
        if (res.ok) {
          const data = await res.json();
          initialCode = data.code || '';
          initialVersion = data.version || 1;
          versionRef.current = initialVersion;
          if (data.language && data.language !== language && onLanguageChange) {
            onLanguageChange(data.language);
          }
        }
      } catch (e) {
        console.warn('[CodeEditor] Failed initial fetch, using fallback', e);
      }

      if (!isMounted || !containerRef.current) return;

      const baseExtensions = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...foldKeymap, ...historyKeymap]),
        langCompartment.current.of(getLanguageExtension(language)),
        themeCompartment.current.of(theme === 'dark' ? [oneDark, darkEditorTheme] : [lightEditorTheme]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isApplyingRemoteRef.current) {
            const currentText = update.state.doc.toString();
            onCodeChange?.(currentText);

            // Debounce save to server (100ms for instantaneous fast sync)
            if (saveTimerRef.current) {
              clearTimeout(saveTimerRef.current);
            }
            saveTimerRef.current = setTimeout(() => {
              pushCodeUpdate(currentText);
            }, 100);
          }
        }),
        EditorView.lineWrapping,
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
      setIsLoading(false);
      onCodeChange?.(initialCode);
      onSyncStatus?.('connected');

      // Start Long-Polling Loop
      const startLongPolling = async () => {
        while (isMounted) {
          try {
            const pollRes = await fetch(
              `/api/rooms/${encodeURIComponent(roomId)}/code?sinceVersion=${versionRef.current}&waitMs=8000`
            );
            if (!isMounted) break;

            if (pollRes.ok) {
              const data = await pollRes.json();
              if (!isMounted) break;

              if (data.success && data.version > versionRef.current) {
                versionRef.current = data.version;

                // If changes came from another client/tab, apply to local CodeMirror
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
                    onCodeChange?.(data.code);
                  }
                }

                if (data.language && data.language !== language && onLanguageChange) {
                  onLanguageChange(data.language);
                }
                onSyncStatus?.('connected');
              }
            } else {
              await new Promise((r) => setTimeout(r, 1000));
            }
          } catch (err) {
            if (!isMounted) break;
            onSyncStatus?.('error');
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
  }, [roomId]);

  // Update language dynamically without reloading editor
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: langCompartment.current.reconfigure(getLanguageExtension(language)),
      });
    }
  }, [language]);

  // Update theme dynamically
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: themeCompartment.current.reconfigure(
          theme === 'dark' ? [oneDark, darkEditorTheme] : [lightEditorTheme]
        ),
      });
    }
  }, [theme]);

  return (
    <div className="w-full h-full relative">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 text-slate-400 text-xs font-mono backdrop-blur-sm">
          正在加载代码协同空间...
        </div>
      )}
      <div
        ref={containerRef}
        className={`w-full h-full overflow-hidden transition-colors ${
          theme === 'dark' ? 'bg-slate-900' : 'bg-white'
        }`}
      />
    </div>
  );
};

