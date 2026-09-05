import React, { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, foldGutter, foldKeymap, indentOnInput, bracketMatching } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next';
import { SupportedLanguage, EditorTheme } from '../types';
import { getLanguageExtension } from '../utils/languages';

interface CodeEditorProps {
  yText: Y.Text;
  provider: WebsocketProvider;
  language: SupportedLanguage;
  theme: EditorTheme;
  onCodeChange?: (code: string) => void;
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
  '.cm-ySelectionInfo': {
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
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
  '.cm-ySelectionInfo': {
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  },
});

export const CodeEditor: React.FC<CodeEditorProps> = ({
  yText,
  provider,
  language,
  theme,
  onCodeChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const langCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());

  useEffect(() => {
    if (!containerRef.current) return;

    // Build base extensions
    const undoManager = new Y.UndoManager(yText);

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
      keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, ...yUndoManagerKeymap]),
      yCollab(yText, provider.awareness, { undoManager }),
      langCompartment.current.of(getLanguageExtension(language)),
      themeCompartment.current.of(theme === 'dark' ? [oneDark, darkEditorTheme] : [lightEditorTheme]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onCodeChange) {
          onCodeChange(update.state.doc.toString());
        }
      }),
      EditorView.lineWrapping,
    ];

    const state = EditorState.create({
      doc: yText.toString(),
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
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden transition-colors ${
        theme === 'dark' ? 'bg-slate-900' : 'bg-white'
      }`}
    />
  );
};
