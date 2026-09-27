import * as fs from 'fs';
import * as path from 'path';
import { WebSocket } from 'ws';
import { startServer } from '../src/serverApp.js';
import {
  getRoomDir,
  getRoomDocPath,
  getRoomScreenshotsDir,
} from '../src/persistence.js';

async function runPermanentDeleteTests() {
  console.log('🧪 Starting Permanent Room Delete & Bulk Delete Test Suite...\n');

  const testPort = 54239;
  const serverInstance = await startServer(testPort, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${testPort}`;
  const wsUrl = `ws://127.0.0.1:${testPort}`;

  try {
    // ==========================================
    // Test 1: Single Room Permanent Deletion
    // ==========================================
    console.log('--- Test 1: Single Room Permanent Deletion ---');
    const createRes1 = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'python', name: 'Delete Single Room Test' }),
    });
    const room1 = await createRes1.json();
    console.log(`Created room: ${room1.id}`);

    const roomDir1 = getRoomDir(room1.id);
    if (!fs.existsSync(roomDir1)) {
      throw new Error(`Room dir was not created at ${roomDir1}`);
    }

    // Connect WebSocket to room 1
    const ws1 = new WebSocket(`${wsUrl}/ws/${room1.id}`);
    const ws1Closed = new Promise<number>((resolve) => {
      ws1.on('close', (code) => resolve(code));
    });
    await new Promise<void>((resolve) => ws1.on('open', resolve));
    console.log('WebSocket client connected to room 1');

    // Add a fake screenshot file to room 1
    const screenshotsDir1 = getRoomScreenshotsDir(room1.id);
    fs.writeFileSync(path.join(screenshotsDir1, 'test.webp'), 'fake image content');

    // Delete room 1 via DELETE /api/rooms/:id
    const deleteRes1 = await fetch(`${baseUrl}/api/rooms/${room1.id}`, {
      method: 'DELETE',
    });
    const deleteData1 = await deleteRes1.json();
    console.log('DELETE response:', deleteData1);
    if (!deleteData1.success) {
      throw new Error(`Failed to delete room 1: ${JSON.stringify(deleteData1)}`);
    }

    // Verify WebSocket was disconnected
    const closeCode1 = await ws1Closed;
    console.log(`WebSocket disconnected with code: ${closeCode1}`);

    // Verify disk directory is COMPLETELY GONE
    if (fs.existsSync(roomDir1)) {
      throw new Error(`Room directory ${roomDir1} still exists on disk after permanent deletion!`);
    }
    console.log(`✅ Room directory ${roomDir1} was completely purged from disk.`);

    // Verify GET /api/rooms does NOT list room 1
    const listRes1 = await fetch(`${baseUrl}/api/rooms`);
    const listData1 = await listRes1.json();
    if (listData1.rooms.some((r: any) => r.id === room1.id)) {
      throw new Error(`Room ${room1.id} still appears in GET /api/rooms!`);
    }
    console.log('✅ Room 1 no longer appears in GET /api/rooms.');

    // ==========================================
    // Test 2: Bulk Rooms Permanent Deletion
    // ==========================================
    console.log('\n--- Test 2: Bulk Rooms Permanent Deletion ---');
    const bulkIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const res = await fetch(`${baseUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'cpp', name: `Bulk Test Room ${i}` }),
      });
      const data = await res.json();
      bulkIds.push(data.id);
      // Create a dummy screenshot in each
      fs.writeFileSync(path.join(getRoomScreenshotsDir(data.id), `snap_${i}.webp`), 'fake image');
    }
    console.log('Created 3 bulk test rooms:', bulkIds);

    // Call POST /api/rooms/bulk-delete with first 2 rooms
    const targetBulk = [bulkIds[0], bulkIds[1]];
    const bulkRes = await fetch(`${baseUrl}/api/rooms/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomIds: targetBulk }),
    });
    const bulkData = await bulkRes.json();
    console.log('Bulk delete response:', bulkData);

    if (!bulkData.success || bulkData.deletedCount !== 2) {
      throw new Error(`Bulk delete failed: ${JSON.stringify(bulkData)}`);
    }

    // Verify room 0 and room 1 directories are gone from disk
    if (fs.existsSync(getRoomDir(bulkIds[0]))) {
      throw new Error(`Room ${bulkIds[0]} still exists on disk!`);
    }
    if (fs.existsSync(getRoomDir(bulkIds[1]))) {
      throw new Error(`Room ${bulkIds[1]} still exists on disk!`);
    }
    console.log(`✅ Rooms ${bulkIds[0]} and ${bulkIds[1]} were permanently erased from disk.`);

    // Verify room 2 still exists
    if (!fs.existsSync(getRoomDir(bulkIds[2]))) {
      throw new Error(`Room ${bulkIds[2]} was erroneously deleted!`);
    }
    console.log(`✅ Unselected room ${bulkIds[2]} remains intact.`);

    // Clean up room 2 via DELETE
    await fetch(`${baseUrl}/api/rooms/${bulkIds[2]}`, { method: 'DELETE' });
    if (fs.existsSync(getRoomDir(bulkIds[2]))) {
      throw new Error(`Room ${bulkIds[2]} could not be cleaned up!`);
    }

    console.log('\n🎉 ALL PERMANENT DELETE TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } finally {
    await serverInstance.close();
  }
}

runPermanentDeleteTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
