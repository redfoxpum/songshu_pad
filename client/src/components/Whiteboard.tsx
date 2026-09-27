import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Excalidraw, reconcileElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI, Collaborator, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type * as Y from 'yjs';
import type { WebsocketProvider } from 'y-websocket';
import type { EditorTheme, UserProfile } from '../types';

interface WhiteboardProps {
  doc: Y.Doc;
  provider: WebsocketProvider;
  currentUser: UserProfile;
  theme: EditorTheme;
  isVisible: boolean;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({
  doc,
  provider,
  currentUser: _currentUser,
  theme,
  isVisible,
}) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const isRemoteUpdatingRef = useRef(false);
  const pointerThrottleTimerRef = useRef<number | null>(null);

  // Yjs shared collections for whiteboard elements and binary files
  const yElements = doc.getMap<ExcalidrawElement>('whiteboard-elements');
  const yFiles = doc.getMap<any>('whiteboard-files');

  // Initial load and sync listener when excalidrawAPI becomes available
  useEffect(() => {
    if (!excalidrawAPI) return;

    const loadElements = () => {
      const initialElements = Array.from(yElements.values());
      const initialFiles = Array.from(yFiles.values());

      if (initialFiles.length > 0) {
        excalidrawAPI.addFiles(initialFiles);
      }
      if (initialElements.length > 0) {
        isRemoteUpdatingRef.current = true;
        try {
          excalidrawAPI.updateScene({ elements: initialElements });
        } finally {
          requestAnimationFrame(() => {
            isRemoteUpdatingRef.current = false;
          });
        }
      }
    };

    loadElements();

    if (provider) {
      if (provider.synced) {
        loadElements();
      }
      provider.on('sync', loadElements);
      return () => {
        provider.off('sync', loadElements);
      };
    }
  }, [excalidrawAPI, provider, yElements, yFiles]);

  // Observe remote Yjs updates
  useEffect(() => {
    if (!excalidrawAPI) return;

    const handleElementsChange = (_events: Y.YMapEvent<ExcalidrawElement>[], transaction: Y.Transaction) => {
      // Ignore if this transaction originated from local whiteboard changes
      if (transaction.origin === 'local-whiteboard') return;

      isRemoteUpdatingRef.current = true;
      try {
        const localElements = excalidrawAPI.getSceneElementsIncludingDeleted();
        const appState = excalidrawAPI.getAppState();
        const remoteElements = Array.from(yElements.values()) as any[];

        const reconciled = reconcileElements(
          localElements as any,
          remoteElements as any,
          appState
        );

        excalidrawAPI.updateScene({ elements: reconciled });
      } catch (err) {
        console.error('[Whiteboard] Failed to reconcile remote elements:', err);
      } finally {
        requestAnimationFrame(() => {
          isRemoteUpdatingRef.current = false;
        });
      }
    };

    const handleFilesChange = (_events: Y.YMapEvent<any>[], transaction: Y.Transaction) => {
      if (transaction.origin === 'local-whiteboard') return;
      const remoteFiles = Array.from(yFiles.values());
      if (remoteFiles.length > 0) {
        excalidrawAPI.addFiles(remoteFiles);
      }
    };

    yElements.observe(handleElementsChange as any);
    yFiles.observe(handleFilesChange as any);

    return () => {
      yElements.unobserve(handleElementsChange as any);
      yFiles.unobserve(handleFilesChange as any);
    };
  }, [excalidrawAPI, yElements, yFiles]);

  // Sync cursor & awareness collaborators on the whiteboard
  useEffect(() => {
    if (!excalidrawAPI || !provider) return;

    const updateCollaborators = () => {
      const states = provider.awareness.getStates();
      const collaborators = new Map<string, Collaborator>();

      states.forEach((state, clientId) => {
        if (
          clientId !== provider.awareness.clientID &&
          state.whiteboardCursor &&
          state.user
        ) {
          collaborators.set(clientId.toString(), {
            pointer: {
              x: state.whiteboardCursor.x,
              y: state.whiteboardCursor.y,
              tool: 'pointer',
            },
            button: state.whiteboardCursor.button || 'up',
            username: state.user.name || 'Anonymous',
            color: {
              background: state.user.color || '#3b82f6',
              stroke: state.user.color || '#3b82f6',
            },
          });
        }
      });

      excalidrawAPI.updateScene({ collaborators: collaborators as any });
    };

    updateCollaborators();
    provider.awareness.on('change', updateCollaborators);

    return () => {
      provider.awareness.off('change', updateCollaborators);
    };
  }, [excalidrawAPI, provider]);

  // Clean up whiteboard cursor from awareness when unmounted or hidden
  useEffect(() => {
    if (!provider) return;
    if (!isVisible) {
      provider.awareness.setLocalStateField('whiteboardCursor', null);
    }
  }, [isVisible, provider]);

  // Handle local Excalidraw scene changes (user draws/moves elements)
  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], _appState: any, files: BinaryFiles) => {
      if (isRemoteUpdatingRef.current) return;

      // Find changed or new elements
      const changed: ExcalidrawElement[] = [];
      for (const el of elements) {
        const remote = yElements.get(el.id);
        if (
          !remote ||
          remote.version < el.version ||
          (remote.version === el.version && remote.versionNonce !== el.versionNonce)
        ) {
          changed.push(el);
        }
      }

      if (changed.length > 0) {
        doc.transact(() => {
          for (const el of changed) {
            yElements.set(el.id, JSON.parse(JSON.stringify(el)));
          }
        }, 'local-whiteboard');
      }

      // Sync new binary files (e.g. pasted screenshots or images)
      if (files && Object.keys(files).length > 0) {
        doc.transact(() => {
          for (const [fileId, fileData] of Object.entries(files)) {
            if (!yFiles.has(fileId)) {
              yFiles.set(fileId, fileData);
            }
          }
        }, 'local-whiteboard');
      }
    },
    [doc, yElements, yFiles]
  );

  // Handle local pointer updates with throttling
  const handlePointerUpdate = useCallback(
    (payload: { pointer: { x: number; y: number }; button: 'down' | 'up' }) => {
      if (!provider || !isVisible) return;

      if (pointerThrottleTimerRef.current !== null) return;

      pointerThrottleTimerRef.current = window.setTimeout(() => {
        pointerThrottleTimerRef.current = null;
      }, 40);

      provider.awareness.setLocalStateField('whiteboardCursor', {
        x: payload.pointer.x,
        y: payload.pointer.y,
        button: payload.button,
      });
    },
    [provider, isVisible]
  );

  // When visibility changes back to visible, refresh Excalidraw dimensions
  useEffect(() => {
    if (isVisible && excalidrawAPI) {
      setTimeout(() => {
        excalidrawAPI.refresh();
      }, 50);
    }
  }, [isVisible, excalidrawAPI]);

  return (
    <div className="w-full h-full relative select-none">
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        theme={theme === 'dark' ? 'dark' : 'light'}
        onChange={handleChange}
        onPointerUpdate={handlePointerUpdate}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
          },
        }}
      />
    </div>
  );
};
