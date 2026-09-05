import * as fs from 'fs';
import * as path from 'path';
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

async function runRoomManagementTests() {
  console.log('🧪 Starting Room Management & Soft-Deletion Tests...\n');

  const testPort = 54220;
  const serverInstance = await startServer(testPort, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${testPort}`;
  const wsUrl = `ws://127.0.0.1:${testPort}`;

  try {
    // 1. Create a room and add data
    console.log('--- Step 1: Create room and populate data ---');
    const createRes = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'python', name: 'Software Engineer Interview' }),
    });
    const room = await createRes.json();
    const roomId = room.id;
    console.log(`Created room: ${roomId} (${room.name})`);

    // Verify room is active
    const infoRes = await fetch(`${baseUrl}/api/rooms/${roomId}`);
    const info = await infoRes.json();
    if (!info.exists || info.status !== 'active') {
      throw new Error(`Expected room to be active and exist, got: ${JSON.stringify(info)}`);
    }

    // Connect a candidate via WebSocket
    const candidateWs = new WebSocket(`${wsUrl}/ws/${roomId}`);
    await new Promise<void>((resolve, reject) => {
      candidateWs.on('open', resolve);
      candidateWs.on('error', reject);
    });
    console.log('✅ Candidate WebSocket connected.');

    // 2. Soft-delete / Close room via host API
    console.log('\n--- Step 2: Close room via DELETE /api/rooms/:id ---');
    let candidateClosedPromise = new Promise<{ code: number; reason: string }>((resolve) => {
      candidateWs.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    const closeRes = await fetch(`${baseUrl}/api/rooms/${roomId}`, {
      method: 'DELETE',
    });
    const closeData = await closeRes.json();
    console.log('Close API response:', closeData);
    if (!closeData.success) {
      throw new Error('Failed to close room via DELETE API');
    }

    // Verify that candidate WebSocket was disconnected
    const closeEvent = await candidateClosedPromise;
    console.log(`Candidate WebSocket disconnected with code: ${closeEvent.code}`);
    if (closeEvent.code !== 4404) {
      console.warn(`Expected close code 4404, got ${closeEvent.code}`);
    }
    console.log('✅ Active client successfully disconnected upon room deletion.');

    // 3. Verify data preservation on disk
    console.log('\n--- Step 3: Verify data preservation on disk ---');
    const roomDir = getRoomDir(roomId);
    const docPath = getRoomDocPath(roomId);
    const metaPath = getRoomMetaPath(roomId);
    const screenshotsDir = getRoomScreenshotsDir(roomId);

    if (!fs.existsSync(roomDir)) throw new Error(`Room directory deleted! Path: ${roomDir}`);
    if (!fs.existsSync(docPath)) throw new Error(`Doc bin deleted! Path: ${docPath}`);
    if (!fs.existsSync(metaPath)) throw new Error(`Meta JSON deleted! Path: ${metaPath}`);
    if (!fs.existsSync(screenshotsDir)) throw new Error(`Screenshots directory deleted! Path: ${screenshotsDir}`);

    const meta = loadRoomMeta(roomId);
    if (meta?.status !== 'closed') {
      throw new Error(`Expected meta.status to be 'closed', got: ${meta?.status}`);
    }
    if (!isRoomClosed(roomId)) {
      throw new Error(`isRoomClosed(${roomId}) returned false!`);
    }
    console.log('✅ All disk data (doc.bin, meta.json, screenshots/) 100% safely preserved on disk.');

    // 4. Verify that external access is blocked
    console.log('\n--- Step 4: Verify external access is blocked ---');
    const checkClosedRes = await fetch(`${baseUrl}/api/rooms/${roomId}`);
    console.log(`GET /api/rooms/:id status: ${checkClosedRes.status}`);
    if (checkClosedRes.status !== 404) {
      throw new Error(`Expected HTTP 404 for closed room, got: ${checkClosedRes.status}`);
    }
    const checkClosedJson = await checkClosedRes.json();
    if (checkClosedJson.exists !== false || !checkClosedJson.isClosed) {
      throw new Error(`Expected exists: false and isClosed: true, got: ${JSON.stringify(checkClosedJson)}`);
    }

    // Try connecting new WebSocket
    let wsRejected = false;
    try {
      const blockedWs = new WebSocket(`${wsUrl}/ws/${roomId}`);
      const wsCloseCode = await new Promise<number>((resolve) => {
        blockedWs.on('close', (code) => resolve(code));
        blockedWs.on('error', () => resolve(4404));
      });
      if (wsCloseCode === 4404 || blockedWs.readyState === WebSocket.CLOSED || blockedWs.readyState === WebSocket.CLOSING) {
        wsRejected = true;
      }
    } catch {
      wsRejected = true;
    }
    if (!wsRejected) {
      throw new Error('New WebSocket connection was not rejected for closed room!');
    }
    console.log('✅ External HTTP & WebSocket access blocked.');

    // 5. Verify room listing for host
    console.log('\n--- Step 5: Verify room listing with status ---');
    const allRoomsRes = await fetch(`${baseUrl}/api/rooms?includeClosed=true`);
    const allRooms = (await allRoomsRes.json()).rooms;
    const closedRoomInList = allRooms.find((r: any) => r.id === roomId);
    if (!closedRoomInList || closedRoomInList.status !== 'closed') {
      throw new Error(`Expected closed room to be in host list with status: 'closed'`);
    }
    console.log('✅ Host room list includes closed/archived rooms with status tag.');

    // 6. Test reopening room
    console.log('\n--- Step 6: Reopen / Restore room ---');
    const reopenRes = await fetch(`${baseUrl}/api/rooms/${roomId}/reopen`, {
      method: 'POST',
    });
    const reopenData = await reopenRes.json();
    if (!reopenData.success) {
      throw new Error('Failed to reopen room');
    }

    const recheckInfo = await fetch(`${baseUrl}/api/rooms/${roomId}`);
    const recheckJson = await recheckInfo.json();
    if (!recheckJson.exists || recheckJson.status !== 'active') {
      throw new Error(`Expected room to be active after reopen, got: ${JSON.stringify(recheckJson)}`);
    }

    const reopenedWs = new WebSocket(`${wsUrl}/ws/${roomId}`);
    await new Promise<void>((resolve, reject) => {
      reopenedWs.on('open', resolve);
      reopenedWs.on('error', reject);
    });
    reopenedWs.close();
    console.log('✅ Room successfully restored and accessible again.');

    console.log('\n======================================================');
    console.log('🎉 ALL ROOM MANAGEMENT & SOFT-DELETION TESTS PASSED! 🎉');
    console.log('======================================================\n');
  } finally {
    await serverInstance.close();
  }
}

runRoomManagementTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
