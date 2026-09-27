import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Excalidraw, reconcileElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI, Collaborator, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

interface WhiteboardProps {
  serverUrl: string;
  roomId: string;
  isVisible: boolean;
  opacity?: number;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({
  serverUrl,
  roomId,
  isVisible,
  opacity = 0.35,
}) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const isRemoteUpdatingRef = useRef(false);
  const pointerThrottleTimerRef = useRef<number | null>(null);

  const [yjsState, setYjsState] = useState<{
    doc: Y.Doc;
    provider: WebsocketProvider;
    elements: Y.Map<ExcalidrawElement>;
    files: Y.Map<any>;
  } | null>(null);

  // Initialize Y.Doc & WebsocketProvider for desktop-agent
  useEffect(() => {
    if (!roomId) return;

    const ydoc = new Y.Doc();
    const cleanServer = (serverUrl || 'http://localhost:3000').trim().replace(/\/+$/, '');
    const isHttps = cleanServer.startsWith('https');
    const host = cleanServer.replace(/^https?:\/\//, '');
    const wsUrl = `${isHttps ? 'wss:' : 'ws:'}//${host}/ws`;

    const provider = new WebsocketProvider(wsUrl, roomId, ydoc, { disableBc: true });
    const elements = ydoc.getMap<ExcalidrawElement>('whiteboard-elements');
    const files = ydoc.getMap<any>('whiteboard-files');

    // Awareness info
    provider.awareness.setLocalStateField('user', {
      name: '桌面端候选人',
      color: '#10b981',
    });

    setYjsState({
      doc: ydoc,
      provider,
      elements,
      files,
    });

    return () => {
      provider.destroy();
      ydoc.destroy();
      setYjsState(null);
    };
  }, [serverUrl, roomId]);

  // Initial load and sync listener when excalidrawAPI and yjsState are ready
  useEffect(() => {
    if (!excalidrawAPI || !yjsState) return;
    const { provider, elements, files } = yjsState;

    const loadElements = () => {
      const initialElements = Array.from(elements.values());
      const initialFiles = Array.from(files.values());

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

    if (provider.synced) {
      loadElements();
    }
    provider.on('sync', loadElements);

    return () => {
      provider.off('sync', loadElements);
    };
  }, [excalidrawAPI, yjsState]);

  // Observe remote Yjs updates
  useEffect(() => {
    if (!excalidrawAPI || !yjsState) return;
    const { elements, files } = yjsState;

    const handleElementsChange = (
      _events: Y.YMapEvent<ExcalidrawElement>[],
      transaction: Y.Transaction
    ) => {
      if (transaction.origin === 'desktop-whiteboard') return;

      isRemoteUpdatingRef.current = true;
      try {
        const localElements = excalidrawAPI.getSceneElementsIncludingDeleted();
        const appState = excalidrawAPI.getAppState();
        const remoteElements = Array.from(elements.values()) as any[];

        const reconciled = reconcileElements(
          localElements as any,
          remoteElements as any,
          appState
        );

        excalidrawAPI.updateScene({ elements: reconciled });
      } catch (err) {
        console.error('[Desktop-Whiteboard] Failed to reconcile remote elements:', err);
      } finally {
        requestAnimationFrame(() => {
          isRemoteUpdatingRef.current = false;
        });
      }
    };

    const handleFilesChange = (_events: Y.YMapEvent<any>[], transaction: Y.Transaction) => {
      if (transaction.origin === 'desktop-whiteboard') return;
      const remoteFiles = Array.from(files.values());
      if (remoteFiles.length > 0) {
        excalidrawAPI.addFiles(remoteFiles);
      }
    };

    elements.observe(handleElementsChange as any);
    files.observe(handleFilesChange as any);

    return () => {
      elements.unobserve(handleElementsChange as any);
      files.unobserve(handleFilesChange as any);
    };
  }, [excalidrawAPI, yjsState]);

  // Remote cursor awareness
  useEffect(() => {
    if (!excalidrawAPI || !yjsState) return;
    const { provider } = yjsState;

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
  }, [excalidrawAPI, yjsState]);

  // Clear cursor when hidden
  useEffect(() => {
    if (!yjsState) return;
    if (!isVisible) {
      yjsState.provider.awareness.setLocalStateField('whiteboardCursor', null);
    }
  }, [isVisible, yjsState]);

  // Local user changes
  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], _appState: any, files: BinaryFiles) => {
      if (isRemoteUpdatingRef.current || !yjsState) return;
      const { doc, elements: yElements, files: yFiles } = yjsState;

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
        }, 'desktop-whiteboard');
      }

      if (files && Object.keys(files).length > 0) {
        doc.transact(() => {
          for (const [fileId, fileData] of Object.entries(files)) {
            if (!yFiles.has(fileId)) {
              yFiles.set(fileId, fileData);
            }
          }
        }, 'desktop-whiteboard');
      }
    },
    [yjsState]
  );

  // Pointer throttle
  const handlePointerUpdate = useCallback(
    (payload: { pointer: { x: number; y: number }; button: 'down' | 'up' }) => {
      if (!yjsState || !isVisible) return;

      if (pointerThrottleTimerRef.current !== null) return;

      pointerThrottleTimerRef.current = window.setTimeout(() => {
        pointerThrottleTimerRef.current = null;
      }, 40);

      yjsState.provider.awareness.setLocalStateField('whiteboardCursor', {
        x: payload.pointer.x,
        y: payload.pointer.y,
        button: payload.button,
      });
    },
    [yjsState, isVisible]
  );

  // Ensure Excalidraw canvas background is always transparent
  useEffect(() => {
    if (!excalidrawAPI) return;
    excalidrawAPI.updateScene({
      appState: {
        viewBackgroundColor: 'transparent',
      },
    });
  }, [excalidrawAPI]);

  // Refresh size when becomes visible
  useEffect(() => {
    if (isVisible && excalidrawAPI) {
      setTimeout(() => {
        excalidrawAPI.refresh();
      }, 50);
    }
  }, [isVisible, excalidrawAPI]);

  return (
    <div
      className="w-full h-full relative select-none rounded-b-2xl overflow-hidden transition-colors duration-200"
      style={{
        backgroundColor: `rgba(10, 15, 26, ${opacity})`,
        backdropFilter: opacity < 0.98 ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: opacity < 0.98 ? 'blur(20px)' : 'none',
      }}
    >
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        theme="dark"
        initialData={{
          appState: {
            viewBackgroundColor: 'transparent',
          },
        }}
        onChange={handleChange}
        onPointerUpdate={handlePointerUpdate}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            changeViewBackgroundColor: false,
          },
        }}
      />
    </div>
  );
};
