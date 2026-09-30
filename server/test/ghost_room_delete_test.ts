import * as fs from 'fs';
import * as path from 'path';
import { startServer } from '../src/serverApp.js';
import {
  getRoomDir,
  getRoomDocPath,
} from '../src/persistence.js';

async function runGhostRoomTests() {
  console.log('🧪 Starting Ghost Room Deletion & Auto-Eviction Test...\n');

  const testPort = 54245;
  const serverInstance = await startServer(testPort, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${testPort}`;

  try {
    // 1. Create a room
    console.log('--- Step 1: Create room ---');
    const createRes = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'python', name: 'Ghost Room Test' }),
    });
    const room = await createRes.json();
    console.log(`Created room: ${room.id}`);

    const roomDir = getRoomDir(room.id);
    if (!fs.existsSync(roomDir)) {
      throw new Error(`Room dir was not created at ${roomDir}`);
    }

    // 2. Simulate user deleting the room folder from disk outside the server process
    console.log('--- Step 2: Manually delete room directory from disk ---');
    fs.rmSync(roomDir, { recursive: true, force: true });
    if (fs.existsSync(roomDir)) {
      throw new Error('Failed to delete room dir from disk');
    }
    console.log(`Deleted ${roomDir} directly from disk.`);

    // 3. Call GET /api/rooms - server should detect that disk dir is missing and auto-evict the ghost room
    console.log('--- Step 3: GET /api/rooms should NOT list the deleted ghost room ---');
    const listRes = await fetch(`${baseUrl}/api/rooms`);
    const listData = await listRes.json();
    const foundGhost = listData.rooms.find((r: any) => r.id === room.id);
    if (foundGhost) {
      throw new Error(`Ghost room ${room.id} was still returned in GET /api/rooms!`);
    }
    console.log('✅ Ghost room was successfully auto-evicted and not listed.');

    // 4. Test explicit DELETE /api/rooms/:id on a room that has no files on disk
    console.log('--- Step 4: Explicit DELETE /api/rooms/:id on ghost room ---');
    const deleteRes = await fetch(`${baseUrl}/api/rooms/${room.id}`, {
      method: 'DELETE',
    });
    const deleteData = await deleteRes.json();
    console.log('DELETE response:', deleteData);
    if (!deleteRes.ok || !deleteData.success) {
      throw new Error(`DELETE /api/rooms/:id failed on ghost room: ${JSON.stringify(deleteData)}`);
    }
    console.log('✅ DELETE /api/rooms/:id succeeded cleanly on ghost room.');

    // 5. Test bulk delete with ghost rooms
    console.log('--- Step 5: Bulk delete with ghost rooms ---');
    const bulkRes1 = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'python', name: 'Bulk Ghost 1' }),
    });
    const bulkRoom1 = await bulkRes1.json();
    fs.rmSync(getRoomDir(bulkRoom1.id), { recursive: true, force: true });

    const bulkDeleteRes = await fetch(`${baseUrl}/api/rooms/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomIds: [bulkRoom1.id] }),
    });
    const bulkDeleteData = await bulkDeleteRes.json();
    console.log('Bulk delete response:', bulkDeleteData);
    if (!bulkDeleteData.success || bulkDeleteData.deletedCount !== 1) {
      throw new Error(`Bulk delete failed: ${JSON.stringify(bulkDeleteData)}`);
    }
    console.log('✅ Bulk delete succeeded on ghost room with 0 errors.');

    console.log('\n🎉 ALL GHOST ROOM TESTS PASSED WITH 100% SUCCESS!\n');
    process.exit(0);
  } finally {
    await serverInstance.close();
  }
}

runGhostRoomTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
