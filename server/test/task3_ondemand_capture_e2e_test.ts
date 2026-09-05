import http from 'http';
import { WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { startServer } from '../src/serverApp.js';
import { roomManager } from '../src/roomManager.js';
import { commandGateway } from '../src/commandGateway.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runOnDemandCaptureE2ETest() {
  console.log('🧪 Starting On-Demand Immediate Screen Capture E2E Test...\n');

  const testDataDir = path.join(process.cwd(), 'data_test_ondemand');
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }

  const serverInstance = await startServer(0, '127.0.0.1', testDataDir);
  const address = serverInstance.server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}`;

  console.log(`[Test Server] Running at ${baseUrl}`);

  try {
    // 1. Create a new test room
    const testRoom = roomManager.createRoom('python', 'E2E Capture Room');
    const roomId = testRoom.id;
    console.log(`Created test room: ${roomId}`);

    // 2. Connect Host to /ws/control
    const hostWs = new WebSocket(`${wsUrl}/ws/control?roomId=${roomId}&clientId=host_1`);
    const hostMessages: any[] = [];
    hostWs.on('message', (data) => {
      try {
        hostMessages.push(JSON.parse(data.toString()));
      } catch {}
    });

    await new Promise<void>((resolve) => hostWs.once('open', () => resolve()));
    console.log('Host connected to /ws/control');

    // 3. Connect Agent to /ws/agent
    const agentClientId = 'agent_tester_99';
    const agentWs = new WebSocket(`${wsUrl}/ws/agent?room=${roomId}&clientId=${agentClientId}`);
    const agentMessages: any[] = [];

    agentWs.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        agentMessages.push(msg);

        // Simulate desktop-agent behavior upon receiving COMMAND_SCREENSHOT
        const isCaptureNow =
          msg.type === 'CAPTURE_NOW' ||
          msg.type === 'COMMAND_SCREENSHOT' ||
          msg.type === 'REQUEST_SCREENSHOT' ||
          msg.action === 'capture' ||
          msg.event === 'CAPTURE_NOW';

        if (isCaptureNow) {
          console.log(`[Simulated Agent] Received capture command: ${msg.type}, requestId: ${msg.requestId}`);

          // Upload screenshot via multipart/form-data
          const dummyImage = Buffer.from('RIFF....WEBPVP8 ...ondemand-image-content...');
          const timestamp = Date.now();
          const formData = new FormData();
          const blob = new Blob([dummyImage], { type: 'image/jpeg' });
          formData.append('triggerType', 'ondemand');
          formData.append('clientId', agentClientId);
          formData.append('deviceName', 'MacBook Pro M3');
          formData.append('timestamp', String(timestamp));
          formData.append('screenshot', blob, `${timestamp}_ondemand_${agentClientId}.jpg`);

          const uploadRes = await fetch(`${baseUrl}/api/rooms/${roomId}/screenshots`, {
            method: 'POST',
            body: formData,
          });

          const uploadData = (await uploadRes.json()) as any;
          console.log('[Simulated Agent] Upload response:', uploadData);

          // Send CAPTURE_COMPLETED over WebSocket
          agentWs.send(
            JSON.stringify({
              type: 'CAPTURE_COMPLETED',
              roomId,
              clientId: agentClientId,
              requestId: msg.requestId,
              filename: uploadData.screenshot?.filename,
              screenshotUrl: uploadData.screenshot?.url,
              triggerType: 'ondemand',
              timestamp,
              size: dummyImage.length,
              deviceName: 'MacBook Pro M3',
              success: true,
            })
          );
        }
      } catch (err) {
        console.error('[Simulated Agent] Error handling message:', err);
      }
    });

    await new Promise<void>((resolve) => agentWs.once('open', () => resolve()));
    console.log('Agent connected to /ws/agent');

    // Register agent
    agentWs.send(
      JSON.stringify({
        type: 'AGENT_REGISTER',
        clientType: 'desktop-agent',
        clientId: agentClientId,
        deviceName: 'MacBook Pro M3',
        hasScreenPermission: true,
        platform: 'darwin',
        roomId,
        timestamp: Date.now(),
      })
    );

    await sleep(200);

    // Verify Agent Status endpoint
    const agentStatusRes = await fetch(`${baseUrl}/api/rooms/${roomId}/agent`);
    const agentStatus = (await agentStatusRes.json()) as any;
    console.log('Agent status API response:', agentStatus);
    if (!agentStatus.connected || agentStatus.permissionStatus !== 'normal') {
      throw new Error(`Agent status not reporting connected! ${JSON.stringify(agentStatus)}`);
    }

    // 4. Trigger On-Demand Capture via POST /api/rooms/:roomId/capture
    console.log('--- Triggering On-Demand Capture via POST /api/rooms/:roomId/capture ---');
    const captureRes = await fetch(`${baseUrl}/api/rooms/${roomId}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: agentClientId }),
    });

    const captureJson = (await captureRes.json()) as any;
    console.log('Capture API response:', captureJson);

    if (!captureJson.success) {
      throw new Error(`Capture API failed: ${JSON.stringify(captureJson)}`);
    }
    if (!captureJson.screenshot || !captureJson.screenshot.url) {
      throw new Error('Capture API did not return completed screenshot object!');
    }
    console.log('✅ Capture API synchronously returned screenshot:', captureJson.screenshot.url);

    // 5. Verify screenshots list contains the captured screenshot
    const listRes = await fetch(`${baseUrl}/api/rooms/${roomId}/screenshots`);
    const listJson = (await listRes.json()) as any;
    console.log(`Room screenshots count: ${listJson.screenshots.length}`);

    const found = listJson.screenshots.find((s: any) => s.filename === captureJson.screenshot.filename);
    if (!found) {
      throw new Error('Captured screenshot was not found in room screenshots list!');
    }
    console.log('✅ Screenshot confirmed in room persistence storage:', found.filename);

    // 6. Verify Host received SCREENSHOT_NEW broadcast
    const newBroadcast = hostMessages.find((m) => m.type === 'SCREENSHOT_NEW');
    if (!newBroadcast) {
      throw new Error('Host did not receive SCREENSHOT_NEW WebSocket broadcast!');
    }
    console.log('✅ Host received SCREENSHOT_NEW broadcast event:', newBroadcast.screenshot.filename);

    // Clean up
    hostWs.close();
    agentWs.close();
    await serverInstance.close();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }

    console.log('\n======================================================');
    console.log('🎉 ON-DEMAND CAPTURE E2E TEST PASSED WITH 100% SUCCESS! 🎉');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ E2E Test Failed:', err);
    await serverInstance.close();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    process.exit(1);
  }
}

runOnDemandCaptureE2ETest();
