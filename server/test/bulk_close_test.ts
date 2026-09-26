import * as fs from 'fs';
import { WebSocket } from 'ws';
import { startServer } from '../src/serverApp.js';
import {
  getRoomDir,
  getRoomDocPath,
  getRoomMetaPath,
  getRoomScreenshotsDir,
  loadRoomMeta,
  isRoomClosed,
} from '../src/persistence.js';

async function runBulkCloseTests() {
  console.log('🧪 Starting Bulk Close Rooms Test Suite...\n');

  const testPort = 54228;
  const serverInstance = await startServer(testPort, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${testPort}`;
  const wsUrl = `ws://127.0.0.1:${testPort}`;

  try {
    // 1. Create 3 test rooms
    console.log('--- Step 1: Create 3 test rooms ---');
    const roomIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const res = await fetch(`${baseUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'python', name: `Candidate Room ${i}` }),
      });
      const data = await res.json();
      roomIds.push(data.id);
      console.log(`Created room ${i}: ${data.id} (${data.name})`);
    }

    // 2. Connect WebSockets to all 3 rooms
    console.log('\n--- Step 2: Connect candidate WebSockets to each room ---');
    const wsList: WebSocket[] = [];
    const closePromises: Promise<{ id: string; code: number }>[] = [];

    for (const id of roomIds) {
      const ws = new WebSocket(`${wsUrl}/ws/${id}`);
      wsList.push(ws);
      const closePromise = new Promise<{ id: string; code: number }>((resolve) => {
        ws.on('close', (code) => {
          resolve({ id, code });
        });
      });
      closePromises.push(closePromise);

      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });
    }
    console.log(`✅ Connected ${wsList.length} candidate WebSocket clients.`);

    // 3. Call POST /api/rooms/bulk-close on the first 2 rooms
    console.log('\n--- Step 3: Call POST /api/rooms/bulk-close on rooms 1 and 2 ---');
    const targetIds = [roomIds[0], roomIds[1]];
    const bulkRes = await fetch(`${baseUrl}/api/rooms/bulk-close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomIds: targetIds }),
    });

    const bulkData = await bulkRes.json();
    console.log('Bulk close response:', bulkData);

    if (!bulkData.success || bulkData.closedCount !== 2) {
      throw new Error(`Expected closedCount=2, got ${JSON.stringify(bulkData)}`);
    }

    // Verify WebSockets for rooms 0 and 1 got disconnected
    const closedEvent0 = await closePromises[0];
    const closedEvent1 = await closePromises[1];
    console.log(`WS 1 disconnected with code ${closedEvent0.code}`);
    console.log(`WS 2 disconnected with code ${closedEvent1.code}`);
    if (closedEvent0.code !== 4404 || closedEvent1.code !== 4404) {
      console.warn(`Expected WS close code 4404`);
    }

    // 4. Verify disk data preservation
    console.log('\n--- Step 4: Verify data preservation for bulk-closed rooms ---');
    for (const id of targetIds) {
      const roomDir = getRoomDir(id);
      const docPath = getRoomDocPath(id);
      const metaPath = getRoomMetaPath(id);
      const screenshotsDir = getRoomScreenshotsDir(id);

      if (!fs.existsSync(roomDir)) throw new Error(`Room directory deleted! Path: ${roomDir}`);
      if (!fs.existsSync(docPath)) throw new Error(`Doc bin deleted! Path: ${docPath}`);
      if (!fs.existsSync(metaPath)) throw new Error(`Meta JSON deleted! Path: ${metaPath}`);
      if (!fs.existsSync(screenshotsDir)) throw new Error(`Screenshots dir deleted! Path: ${screenshotsDir}`);

      const meta = loadRoomMeta(id);
      if (meta?.status !== 'closed') {
        throw new Error(`Expected meta.status to be 'closed' for room ${id}, got: ${meta?.status}`);
      }
      if (!isRoomClosed(id)) {
        throw new Error(`isRoomClosed(${id}) returned false!`);
      }
    }
    console.log('✅ Disk data (doc.bin, meta.json, screenshots/) 100% safely preserved for all closed rooms.');

    // 5. Verify room 3 remains active
    console.log('\n--- Step 5: Verify room 3 remains active and WebSocket connected ---');
    if (wsList[2].readyState !== WebSocket.OPEN) {
      throw new Error(`Room 3 WebSocket should still be open! State: ${wsList[2].readyState}`);
    }
    const info3Res = await fetch(`${baseUrl}/api/rooms/${roomIds[2]}`);
    const info3 = await info3Res.json();
    if (!info3.exists || info3.status !== 'active') {
      throw new Error(`Room 3 should be active, got: ${JSON.stringify(info3)}`);
    }
    console.log('✅ Room 3 untouched and fully active.');

    // 6. Test allActive flag: close remaining active rooms
    console.log('\n--- Step 6: Test allActive: true bulk close ---');
    const bulkAllRes = await fetch(`${baseUrl}/api/rooms/bulk-close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allActive: true }),
    });
    const bulkAllData = await bulkAllRes.json();
    console.log('Bulk allActive response:', bulkAllData);

    if (!bulkAllData.success || bulkAllData.closedCount < 1) {
      throw new Error(`Expected at least 1 closed room from allActive, got ${JSON.stringify(bulkAllData)}`);
    }

    const closedEvent2 = await closePromises[2];
    console.log(`WS 3 disconnected with code ${closedEvent2.code}`);
    console.log('✅ allActive bulk close successfully disconnected room 3.');

    // Cleanup WebSockets
    for (const ws of wsList) {
      try {
        ws.terminate();
      } catch {}
    }

    console.log('\n======================================================');
    console.log('🎉 ALL BULK CLOSE ROOMS TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('======================================================\n');
  } finally {
    await serverInstance.close();
  }
}

runBulkCloseTests().catch((err) => {
  console.error('❌ Bulk Close Test Failed:', err);
  process.exit(1);
});
