import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { initWebSocketServer, getYDoc } from '../src/websocket.js';
import { ensureDataDir, loadRoomState } from '../src/persistence.js';

// Polyfill WebSocket in Node environment for y-websocket client
(global as any).WebSocket = WebSocket;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSimulationTest() {
  console.log('🧪 Starting Multi-Client Collaboration Simulation Test...\n');

  ensureDataDir();

  // 1. Create HTTP & WebSocket Server on random available port
  const server = http.createServer();
  const wss = new WebSocketServer({ noServer: true });
  initWebSocketServer(wss);

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;
  console.log(`[Test Server] Running on ${wsUrl}`);

  const roomId = `test-room-${Date.now()}`;

  // 2. Spawn Virtual Client 1
  console.log('[Test] Connecting Client 1 (Alice)...');
  const doc1 = new Y.Doc();
  const provider1 = new WebsocketProvider(wsUrl, roomId, doc1, { WebSocketPolyfill: WebSocket as any });
  const yText1 = doc1.getText('codemirror');
  const meta1 = doc1.getMap<any>('room-meta');

  provider1.awareness.setLocalStateField('user', {
    name: 'Alice',
    color: '#3b82f6',
  });

  // 3. Spawn Virtual Client 2
  console.log('[Test] Connecting Client 2 (Bob)...');
  const doc2 = new Y.Doc();
  const provider2 = new WebsocketProvider(wsUrl, roomId, doc2, { WebSocketPolyfill: WebSocket as any });
  const yText2 = doc2.getText('codemirror');
  const meta2 = doc2.getMap<any>('room-meta');

  provider2.awareness.setLocalStateField('user', {
    name: 'Bob',
    color: '#10b981',
  });

  // Wait for initial sync
  await sleep(600);

  // Check initial state
  console.log('[Test] Step 1: Initial document template sync...');
  console.log(`Client 1 length: ${yText1.length}, Client 2 length: ${yText2.length}`);
  if (yText1.toString() !== yText2.toString()) {
    throw new Error('Initial document synchronization failed!');
  }
  console.log('✅ Initial sync verified.');

  // Step 2: Awareness sync check
  console.log('\n[Test] Step 2: Awareness (Cursors & Users) sync...');
  const awarenessStates1 = Array.from(provider1.awareness.getStates().values());
  const awarenessStates2 = Array.from(provider2.awareness.getStates().values());
  console.log('Client 1 sees awareness:', awarenessStates1.map((s: any) => s.user?.name).filter(Boolean));
  console.log('Client 2 sees awareness:', awarenessStates2.map((s: any) => s.user?.name).filter(Boolean));

  const hasAlice1 = awarenessStates2.some((s: any) => s.user?.name === 'Alice');
  const hasBob1 = awarenessStates1.some((s: any) => s.user?.name === 'Bob');

  if (!hasAlice1 || !hasBob1) {
    throw new Error('Awareness states were not propagated between clients!');
  }
  console.log('✅ Awareness sync verified (Alice and Bob visible to each other).');

  // Step 3: Concurrent edits
  console.log('\n[Test] Step 3: Simulating Concurrent Edits...');
  
  // Client 1 prepends a header comment
  doc1.transact(() => {
    yText1.insert(0, '# Author: Alice & Bob\n');
  });

  // Simultaneously, Client 2 appends a test call
  doc2.transact(() => {
    yText2.insert(yText2.length, '\n# Concurrent edit by Bob\n');
  });

  // Client 1 changes language metadata
  doc1.transact(() => {
    meta1.set('language', 'python');
  });

  // Wait for CRDT resolution
  await sleep(800);

  const text1 = yText1.toString();
  const text2 = yText2.toString();

  console.log('--- Client 1 Doc Preview ---');
  console.log(text1.slice(0, 100) + '...');
  console.log('--- Client 2 Doc Preview ---');
  console.log(text2.slice(0, 100) + '...');

  if (text1 !== text2) {
    throw new Error(`CRDT divergence detected!\nClient 1:\n${text1}\n\nClient 2:\n${text2}`);
  }
  if (!text1.includes('Author: Alice & Bob') || !text1.includes('Concurrent edit by Bob')) {
    throw new Error('Missing concurrent edits in converged document!');
  }
  console.log('✅ CRDT convergence verified: Both documents converged to 100% identical state.');

  // Step 4: Metadata sync check
  console.log('\n[Test] Step 4: Room Metadata real-time sync...');
  doc2.transact(() => {
    meta2.set('language', 'cpp');
  });
  await sleep(400);

  if (meta1.get('language') !== 'cpp') {
    throw new Error(`Metadata sync failed! Client 1 got ${meta1.get('language')}, expected 'cpp'`);
  }
  console.log('✅ Room metadata sync verified (Language changed to cpp across all clients).');

  // Step 5: Persistence check
  console.log('\n[Test] Step 5: Document Persistence verification...');
  await sleep(1200); // Allow debounce persistence to flush to disk
  
  const testRestoreDoc = new Y.Doc();
  const restored = loadRoomState(roomId, testRestoreDoc);
  if (!restored) {
    throw new Error('Failed to load persisted room binary file from disk!');
  }
  const restoredText = testRestoreDoc.getText('codemirror').toString();
  if (restoredText !== text1) {
    throw new Error('Persisted state does not match memory state!');
  }
  console.log('✅ Persistence verified: State successfully loaded from disk.');

  // Clean up
  provider1.destroy();
  provider2.destroy();
  server.close();

  console.log('\n🎉 ALL COLLABORATION & CRDT TESTS PASSED SUCCESSFULLY! 🎉\n');
  process.exit(0);
}

runSimulationTest().catch((err) => {
  console.error('\n❌ Collaboration Test Failed:', err);
  process.exit(1);
});
