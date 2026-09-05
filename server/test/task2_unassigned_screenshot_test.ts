import http from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import { apiRouter } from '../src/routes.js';
import { initWebSocketServer } from '../src/websocket.js';
import {
  ensureDataDir,
  ensureUnassignedDir,
  getUnassignedScreenshotsDir,
  ensurePublicDir,
  listUnassignedScreenshots,
  getUnassignedScreenshotFilePath,
  saveUnassignedScreenshotFile,
} from '../src/persistence.js';

(global as any).WebSocket = WebSocket;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTask2Tests() {
  console.log('🧪 Starting Task 2: Unassigned Screenshot Storage & Agent Immediate Capture Integration Tests...\n');

  ensureDataDir();
  const unassignedDir = ensureUnassignedDir();
  const publicDir = ensurePublicDir();
  console.log(`[Persistence] Unassigned screenshots dir: ${unassignedDir}`);
  console.log(`[Persistence] Public dir: ${publicDir}`);

  if (!fs.existsSync(getUnassignedScreenshotsDir())) {
    throw new Error('Unassigned screenshots directory was not created!');
  }

  // 1. Setup Express + WebSocket server
  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use('/api', apiRouter);

  const server = http.createServer(app);
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
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Test Server] Server listening on ${baseUrl}\n`);

  try {
    // =========================================================================
    // TEST 1: Persistence Helper Functions for Unassigned Storage
    // =========================================================================
    console.log('--- Test 1: Persistence Unassigned Directory Helpers ---');
    const directSaved = saveUnassignedScreenshotFile(
      Buffer.from('RIFF....WEBPVP8 ...unit-test-dummy-1...'),
      'initial',
      Date.now() - 5000,
      'test-agent-direct',
      'Test Agent Machine'
    );
    console.log('Directly saved screenshot metadata:', directSaved);

    if (!directSaved.filename.includes('initial_test-agent-direct')) {
      throw new Error(`Direct save filename invalid: ${directSaved.filename}`);
    }

    const unassignedList = listUnassignedScreenshots();
    const foundDirect = unassignedList.find((s) => s.filename === directSaved.filename);
    if (!foundDirect) {
      throw new Error('Directly saved screenshot not found in listUnassignedScreenshots()');
    }
    console.log('✅ Test 1 Passed: Persistence functions verified.');

    // =========================================================================
    // TEST 2: POST /api/unassigned/screenshots (Multipart Form Upload)
    // =========================================================================
    console.log('\n--- Test 2: Multipart Upload to POST /api/unassigned/screenshots ---');
    const dummyImageBuffer = Buffer.from('RIFF....WEBPVP8 ...initial-capture-test-image-content...');
    const uploadForm = new FormData();
    uploadForm.append('screenshot', dummyImageBuffer, {
      filename: 'initial_screen.webp',
      contentType: 'image/webp',
    });
    uploadForm.append('triggerType', 'initial');
    uploadForm.append('clientId', 'macbook-pro-agent-001');
    uploadForm.append('deviceName', "Candidate's MacBook Air");

    const uploadRes = await fetch(`${baseUrl}/api/unassigned/screenshots`, {
      method: 'POST',
      body: uploadForm.getBuffer(),
      headers: uploadForm.getHeaders(),
    });

    if (uploadRes.status !== 201) {
      const errText = await uploadRes.text();
      throw new Error(`POST /api/unassigned/screenshots failed (status ${uploadRes.status}): ${errText}`);
    }

    const uploadJson = await uploadRes.json();
    console.log('Multipart upload response:', uploadJson);

    if (!uploadJson.success || !uploadJson.screenshot) {
      throw new Error('Screenshot upload response missing success or screenshot property');
    }

    const { filename, url, triggerType, clientId, deviceName, size } = uploadJson.screenshot;
    if (triggerType !== 'initial' || clientId !== 'macbook-pro-agent-001') {
      throw new Error(`Screenshot metadata mismatch: triggerType=${triggerType}, clientId=${clientId}`);
    }
    if (deviceName !== "Candidate's MacBook Air") {
      throw new Error(`Device name mismatch: ${deviceName}`);
    }
    if (size !== dummyImageBuffer.length) {
      throw new Error(`Size mismatch: expected ${dummyImageBuffer.length}, got ${size}`);
    }
    console.log('✅ Test 2 Passed: POST /api/unassigned/screenshots (multipart) successfully saved initial screenshot.');

    // =========================================================================
    // TEST 3: POST /api/screenshots/unassigned (Route Alias & Base64 JSON fallback)
    // =========================================================================
    console.log('\n--- Test 3: Route Alias & Base64 JSON Upload to /api/screenshots/unassigned ---');
    const base64Data = Buffer.from('RIFF....WEBPVP8 ...base64-json-unassigned-image...').toString('base64');
    const jsonUploadRes = await fetch(`${baseUrl}/api/screenshots/unassigned`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: `data:image/webp;base64,${base64Data}`,
        triggerType: 'initial',
        clientId: 'alias-test-agent',
        deviceName: 'Mac Studio M2',
      }),
    });

    if (jsonUploadRes.status !== 201) {
      throw new Error(`POST /api/screenshots/unassigned (alias JSON) failed with status ${jsonUploadRes.status}`);
    }
    const jsonUploadData = await jsonUploadRes.json();
    console.log('Alias JSON upload response:', jsonUploadData);

    if (!jsonUploadData.success || jsonUploadData.screenshot.clientId !== 'alias-test-agent') {
      throw new Error('Alias JSON upload metadata verification failed');
    }
    console.log('✅ Test 3 Passed: Alias route & base64 upload verified.');

    // =========================================================================
    // TEST 4: GET /api/unassigned/screenshots (List unassigned screenshots)
    // =========================================================================
    console.log('\n--- Test 4: GET /api/unassigned/screenshots ---');
    const listRes = await fetch(`${baseUrl}/api/unassigned/screenshots`);
    const listData = await listRes.json();
    console.log(`Listed ${listData.screenshots?.length} unassigned screenshots.`);

    if (!Array.isArray(listData.screenshots) || listData.screenshots.length < 3) {
      throw new Error('Unassigned screenshots list is missing expected items');
    }

    // Verify sorted descending by timestamp
    for (let i = 0; i < listData.screenshots.length - 1; i++) {
      if (listData.screenshots[i].timestamp < listData.screenshots[i + 1].timestamp) {
        throw new Error('Unassigned screenshots are NOT sorted in descending order!');
      }
    }
    console.log('✅ Test 4 Passed: GET /api/unassigned/screenshots returned sorted list.');

    // =========================================================================
    // TEST 5: GET /api/unassigned/screenshots/:filename (Serve image stream)
    // =========================================================================
    console.log('\n--- Test 5: GET /api/unassigned/screenshots/:filename ---');
    const serveRes = await fetch(`${baseUrl}${url}`);
    if (serveRes.status !== 200) {
      throw new Error(`Failed to serve screenshot at ${url}, status: ${serveRes.status}`);
    }

    const contentType = serveRes.headers.get('content-type');
    const servedBuffer = Buffer.from(await serveRes.arrayBuffer());
    console.log(`Served screenshot content-type: ${contentType}, length: ${servedBuffer.length} bytes`);

    if (!contentType?.includes('image/webp')) {
      throw new Error(`Unexpected Content-Type: ${contentType}`);
    }
    if (servedBuffer.length !== dummyImageBuffer.length) {
      throw new Error(`Served content length mismatch: expected ${dummyImageBuffer.length}, got ${servedBuffer.length}`);
    }
    console.log('✅ Test 5 Passed: Unassigned screenshot served with correct headers and contents.');

    // =========================================================================
    // TEST 6: Room Isolation vs Unassigned Storage
    // =========================================================================
    console.log('\n--- Test 6: Room Isolation vs Unassigned Storage ---');
    // Create a room and verify room screenshots go to room dir while unassigned remain in unassigned dir
    const createRoomRes = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'python', name: 'Isolated Interview Room' }),
    });
    const room = await createRoomRes.json();

    const roomUploadForm = new FormData();
    roomUploadForm.append('screenshot', Buffer.from('RIFF....WEBPVP8 ...room-screenshot-data...'), {
      filename: 'room_capture.webp',
      contentType: 'image/webp',
    });
    roomUploadForm.append('triggerType', 'initial');
    roomUploadForm.append('clientId', 'room-agent-123');

    const roomUploadRes = await fetch(`${baseUrl}/api/rooms/${room.id}/screenshots`, {
      method: 'POST',
      body: roomUploadForm.getBuffer(),
      headers: roomUploadForm.getHeaders(),
    });
    const roomUploadJson = await roomUploadRes.json();
    console.log('Room upload response:', roomUploadJson);

    if (roomUploadJson.screenshot.roomId !== room.id) {
      throw new Error('Room screenshot roomId mismatch');
    }

    // Verify room screenshot is in room list but NOT in unassigned list
    const roomListRes = await fetch(`${baseUrl}/api/rooms/${room.id}/screenshots`);
    const roomList = await roomListRes.json();
    const unassignedList2 = await (await fetch(`${baseUrl}/api/unassigned/screenshots`)).json();

    const foundInRoom = roomList.screenshots.some((s: any) => s.filename === roomUploadJson.screenshot.filename);
    const foundInUnassigned = unassignedList2.screenshots.some((s: any) => s.filename === roomUploadJson.screenshot.filename);

    if (!foundInRoom) throw new Error('Room screenshot not found in room screenshot list');
    if (foundInUnassigned) throw new Error('Room screenshot incorrectly leaked into unassigned screenshot list!');

    console.log('✅ Test 6 Passed: Complete separation between room-specific and unassigned screenshot storage.');

    // =========================================================================
    // TEST 7: Cleanup via DELETE /api/unassigned/screenshots/:filename
    // =========================================================================
    console.log('\n--- Test 7: DELETE /api/unassigned/screenshots/:filename ---');
    const deleteRes = await fetch(`${baseUrl}/api/unassigned/screenshots/${filename}`, {
      method: 'DELETE',
    });
    const deleteJson = await deleteRes.json();
    console.log('Delete response:', deleteJson);

    if (!deleteJson.success) {
      throw new Error('Failed to delete unassigned screenshot');
    }

    const checkDeletedRes = await fetch(`${baseUrl}/api/unassigned/screenshots/${filename}`);
    if (checkDeletedRes.status !== 404) {
      throw new Error(`Expected 404 after deletion, got ${checkDeletedRes.status}`);
    }
    console.log('✅ Test 7 Passed: Deletion verified.');

    server.close();

    console.log('\n======================================================');
    console.log('🎉 ALL TASK 2 INTEGRATION TESTS PASSED WITH 0 ERRORS! 🎉');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Task 2 Test Failed:', err);
    server.close();
    process.exit(1);
  }
}

runTask2Tests();
