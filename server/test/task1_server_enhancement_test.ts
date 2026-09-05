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
  getRoomDir,
  getRoomDocPath,
  getRoomMetaPath,
  getRoomScreenshotsDir,
} from '../src/persistence.js';

(global as any).WebSocket = WebSocket;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTask1Tests() {
  console.log('🧪 Starting Task 1: Server Enhancement & Command Gateway Verification Tests...\n');

  ensureDataDir();

  // 1. Setup Express + WebSocket server
  const app = express();
  app.use(express.json());
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
  const wsUrl = `ws://127.0.0.1:${port}`;
  console.log(`[Test Server] Server listening on ${baseUrl}`);

  try {
    // ==========================================
    // TEST 1: Backward Compatibility & Migration
    // ==========================================
    console.log('\n--- Test 1: Backward Compatibility Migration ---');
    const legacyRoomId = `legacy-room-${Date.now()}`;
    const legacyBinPath = path.resolve(process.cwd(), 'data', 'rooms', `${legacyRoomId}.bin`);
    fs.writeFileSync(legacyBinPath, Buffer.from([1, 2, 3, 4, 5]));

    // Access room via GET /api/rooms/:id
    const resLegacy = await fetch(`${baseUrl}/api/rooms/${legacyRoomId}`);
    const legacyJson = await resLegacy.json();
    console.log('Legacy room info returned:', legacyJson);

    if (legacyJson.id !== legacyRoomId) {
      throw new Error(`Legacy room ID mismatch! Expected ${legacyRoomId}, got ${legacyJson.id}`);
    }

    // Verify migrated directory structure
    const roomDir = getRoomDir(legacyRoomId);
    const docPath = getRoomDocPath(legacyRoomId);
    const metaPath = getRoomMetaPath(legacyRoomId);
    const screenshotsDir = getRoomScreenshotsDir(legacyRoomId);

    if (!fs.existsSync(roomDir)) throw new Error(`Room directory not created at ${roomDir}`);
    if (!fs.existsSync(docPath)) throw new Error(`Doc bin not found at ${docPath}`);
    if (!fs.existsSync(metaPath)) throw new Error(`Meta JSON not found at ${metaPath}`);
    if (!fs.existsSync(screenshotsDir)) throw new Error(`Screenshots dir not found at ${screenshotsDir}`);

    console.log('✅ Test 1 Passed: Legacy room successfully migrated to isolated directory structure.');

    // ==========================================
    // TEST 2: RESTful Room APIs (Create & List)
    // ==========================================
    console.log('\n--- Test 2: Room RESTful APIs ---');
    const createRes = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'cpp', name: 'Algorithm Arena' }),
    });
    const createdRoom = await createRes.json();
    console.log('Created room:', createdRoom);

    if (!createdRoom.id || createdRoom.language !== 'cpp' || createdRoom.name !== 'Algorithm Arena') {
      throw new Error('Create room response invalid');
    }

    // List rooms
    const listRes = await fetch(`${baseUrl}/api/rooms`);
    const listJson = await listRes.json();
    console.log(`Listed ${listJson.rooms.length} room(s)`);

    const found = listJson.rooms.find((r: any) => r.id === createdRoom.id);
    if (!found) {
      throw new Error('Newly created room not present in list API response');
    }
    if (typeof found.screenshotCount !== 'number' || typeof found.onlineClients !== 'number') {
      throw new Error('Room list item missing screenshotCount or onlineClients properties');
    }
    console.log('✅ Test 2 Passed: Room creation and listing APIs verified.');

    // ==========================================
    // TEST 3: Screenshots Upload & Serving API
    // ==========================================
    console.log('\n--- Test 3: Screenshot Upload and Serving ---');
    const testRoomId = createdRoom.id;
    const dummyImageBuffer = Buffer.from('RIFF....WEBPVP8 ...test dummy webp image content...');

    const form = new FormData();
    form.append('screenshot', dummyImageBuffer, {
      filename: 'sample_capture.webp',
      contentType: 'image/webp',
    });
    form.append('triggerType', 'ondemand');
    form.append('clientId', 'desktop-agent-007');
    form.append('deviceName', "Alice's MacBook Pro M3");

    const uploadRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}/screenshots`, {
      method: 'POST',
      body: form.getBuffer(),
      headers: form.getHeaders(),
    });

    const uploadJson = await uploadRes.json();
    console.log('Upload response:', uploadJson);

    if (!uploadJson.success || !uploadJson.screenshot) {
      throw new Error('Screenshot upload failed');
    }

    const { filename, url, triggerType, clientId, deviceName } = uploadJson.screenshot;
    if (triggerType !== 'ondemand' || clientId !== 'desktop-agent-007') {
      throw new Error('Screenshot metadata mismatch');
    }

    // Fetch screenshots list
    const screenshotsListRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}/screenshots`);
    const screenshotsListJson = await screenshotsListRes.json();
    console.log('Room screenshots list:', screenshotsListJson);

    if (!Array.isArray(screenshotsListJson.screenshots) || screenshotsListJson.screenshots.length === 0) {
      throw new Error('Screenshots list is empty after upload');
    }

    // Fetch the screenshot file directly
    const serveRes = await fetch(`${baseUrl}${url}`);
    if (serveRes.status !== 200) {
      throw new Error(`Failed to serve screenshot file, HTTP ${serveRes.status}`);
    }
    const contentType = serveRes.headers.get('content-type');
    console.log(`Served screenshot content-type: ${contentType}`);
    if (!contentType?.includes('image/webp')) {
      throw new Error(`Invalid content-type: ${contentType}`);
    }

    const servedBuffer = Buffer.from(await serveRes.arrayBuffer());
    if (servedBuffer.length !== dummyImageBuffer.length) {
      throw new Error('Served file size does not match uploaded file');
    }
    console.log('✅ Test 3 Passed: Screenshot multipart upload and direct serving verified.');

    // ==========================================
    // TEST 4: WebSocket Dual-Way Command Gateway
    // ==========================================
    console.log('\n--- Test 4: WebSocket Command Gateway ---');

    // 4.1 Connect Host Listener to /ws/control
    const hostWs = new WebSocket(`${wsUrl}/ws/control?roomId=${testRoomId}&role=host`);
    const hostReceivedMessages: any[] = [];

    hostWs.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        hostReceivedMessages.push(parsed);
      } catch {}
    });

    await new Promise<void>((resolve) => hostWs.on('open', resolve));
    console.log('Host connected to /ws/control');

    // 4.2 Connect Desktop Agent to /ws/agent
    const agentWs = new WebSocket(`${wsUrl}/ws/agent?roomId=${testRoomId}`);
    const agentReceivedMessages: any[] = [];

    agentWs.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        agentReceivedMessages.push(parsed);
      } catch {}
    });

    await new Promise<void>((resolve) => agentWs.on('open', resolve));
    console.log('Agent connected to /ws/agent');

    // 4.3 Agent sends AGENT_REGISTER
    agentWs.send(
      JSON.stringify({
        type: 'AGENT_REGISTER',
        roomId: testRoomId,
        clientId: 'desktop-agent-007',
        deviceName: "Alice's MacBook Pro M3",
        hasScreenPermission: true,
      })
    );

    await sleep(300);

    const regAck = agentReceivedMessages.find((m) => m.type === 'REGISTER_ACK');
    if (!regAck || !regAck.success) {
      throw new Error('Agent failed to receive REGISTER_ACK');
    }
    console.log('Agent received REGISTER_ACK:', regAck);

    const statusUpdateForHost = hostReceivedMessages
      .filter((m) => m.type === 'AGENT_STATUS_UPDATE')
      .find((m) => m.agents && m.agents.some((a: any) => a.clientId === 'desktop-agent-007'));
    if (!statusUpdateForHost) {
      throw new Error('Host did not receive AGENT_STATUS_UPDATE with registered agent');
    }
    console.log('Host received AGENT_STATUS_UPDATE:', statusUpdateForHost);

    // 4.4 Agent sends HEARTBEAT
    agentWs.send(
      JSON.stringify({
        type: 'HEARTBEAT',
        roomId: testRoomId,
        clientId: 'desktop-agent-007',
      })
    );

    await sleep(200);

    const hbAck = agentReceivedMessages.find((m) => m.type === 'HEARTBEAT_ACK');
    if (!hbAck) {
      throw new Error('Agent did not receive HEARTBEAT_ACK');
    }
    console.log('Agent received HEARTBEAT_ACK:', hbAck);

    // 4.5 Server requests on-demand screenshot via POST /api/rooms/:roomId/request-screenshot
    console.log('Dispatching on-demand screenshot command from REST API...');
    const reqScreenRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}/request-screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'desktop-agent-007' }),
    });
    const reqScreenJson = await reqScreenRes.json();
    console.log('request-screenshot API response:', reqScreenJson);

    if (!reqScreenJson.success || reqScreenJson.agentCount !== 1) {
      throw new Error('request-screenshot failed to dispatch to connected agent');
    }

    await sleep(300);

    const cmdScreen = agentReceivedMessages.find((m) => m.type === 'COMMAND_SCREENSHOT');
    if (!cmdScreen) {
      throw new Error('Agent did not receive COMMAND_SCREENSHOT message');
    }
    console.log('Agent received COMMAND_SCREENSHOT command:', cmdScreen);

    // 4.6 Agent simulates capture completion and sends CAPTURE_COMPLETED
    const newScreenshotFilename = `${Date.now()}_ondemand_desktop-agent-007.webp`;
    agentWs.send(
      JSON.stringify({
        type: 'CAPTURE_COMPLETED',
        roomId: testRoomId,
        clientId: 'desktop-agent-007',
        filename: newScreenshotFilename,
        screenshotUrl: `/api/rooms/${testRoomId}/screenshots/${newScreenshotFilename}`,
        triggerType: 'ondemand',
        timestamp: Date.now(),
      })
    );

    await sleep(300);

    const screenshotNewMsg = hostReceivedMessages.find((m) => m.type === 'SCREENSHOT_NEW');
    if (!screenshotNewMsg || screenshotNewMsg.screenshot.filename !== newScreenshotFilename) {
      throw new Error('Host did not receive SCREENSHOT_NEW broadcast');
    }
    console.log('Host received SCREENSHOT_NEW broadcast:', screenshotNewMsg);

    // Close WebSockets
    agentWs.close();
    hostWs.close();
    await sleep(200);

    console.log('✅ Test 4 Passed: WebSocket Command Gateway protocol verified end-to-end.');

    // Close test server
    server.close();

    console.log('\n======================================================');
    console.log('🎉 ALL TASK 1 TESTS PASSED WITH ZERO ERRORS! 🎉');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Task 1 Test Failed:', err);
    server.close();
    process.exit(1);
  }
}

runTask1Tests();
