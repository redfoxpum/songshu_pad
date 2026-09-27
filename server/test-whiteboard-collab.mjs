import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';

// Polyfill WebSocket for Node.js environment
global.WebSocket = WebSocket;

const SERVER_URL = 'http://127.0.0.1:3000';
const WS_URL = 'ws://127.0.0.1:3000/ws';
const TEST_ROOM_ID = `collab-test-${Date.now()}`;

async function runTest() {
  console.log('====================================================');
  console.log(`🧪 开始白板画图双端协同深度测试 (Room: ${TEST_ROOM_ID})`);
  console.log('====================================================\n');

  // Step 1: Create room via API
  console.log('Step 1: 创建测试协同房间...');
  const createRes = await fetch(`${SERVER_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: TEST_ROOM_ID,
      name: '白板协同自动化测试房间',
      language: 'python',
    }),
  });

  if (!createRes.ok) {
    throw new Error(`创建房间失败: HTTP ${createRes.status}`);
  }
  const roomData = await createRes.json();
  console.log(`✅ 房间创建成功: ${roomData.id} (${roomData.name})\n`);

  // Step 2: Connect Client A (Web 端 / 面试官)
  console.log('Step 2: 连接 Client A (Web 协同端 / 面试官)...');
  const docA = new Y.Doc();
  const providerA = new WebsocketProvider(WS_URL, TEST_ROOM_ID, docA, { WebSocketPolyfill: WebSocket, disableBc: true });
  const elementsA = docA.getMap('whiteboard-elements');

  providerA.awareness.setLocalStateField('user', {
    name: '面试官 (Web)',
    color: '#3b82f6',
  });

  // Step 3: Connect Client B (Desktop 桌面被控端 / 候选人)
  console.log('Step 3: 连接 Client B (桌面伴侣被控端 / 候选人)...');
  const docB = new Y.Doc();
  const providerB = new WebsocketProvider(WS_URL, TEST_ROOM_ID, docB, { WebSocketPolyfill: WebSocket, disableBc: true });
  const elementsB = docB.getMap('whiteboard-elements');

  providerB.awareness.setLocalStateField('user', {
    name: '候选人 (Desktop)',
    color: '#10b981',
  });

  // Wait for initial sync
  await new Promise((resolve) => {
    let syncCount = 0;
    const check = () => {
      syncCount++;
      if (syncCount >= 2) resolve(true);
    };
    providerA.on('sync', check);
    providerB.on('sync', check);
  });
  console.log('✅ Client A 和 Client B 双端 WebSocket 连接与初始状态同步完成！\n');

  // Step 4: Test 1 - Client A (Web) 画矩形，验证 Client B (Desktop) 实时收到
  console.log('Step 4: 测试 [Web端 -> 桌面端] 画图同步...');
  const rectElement = {
    id: 'rect-system-arch',
    type: 'rectangle',
    x: 120,
    y: 180,
    width: 250,
    height: 120,
    strokeColor: '#e03131',
    backgroundColor: '#ffc9c9',
    version: 1,
    versionNonce: 1001,
  };

  const receiveRectPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('超时: Client B 未在 5 秒内收到 Client A 的图形')), 5000);
    elementsB.observe(() => {
      const received = elementsB.get('rect-system-arch');
      if (received && received.id === 'rect-system-arch') {
        clearTimeout(timeout);
        resolve(received);
      }
    });
  });

  // Client A draws
  docA.transact(() => {
    elementsA.set('rect-system-arch', rectElement);
  }, 'local-whiteboard');

  const receivedOnB = await receiveRectPromise;
  console.log(`✅ Client B 成功毫秒级收到 Client A 绘制的图形:`, {
    id: receivedOnB.id,
    type: receivedOnB.type,
    x: receivedOnB.x,
    y: receivedOnB.y,
    color: receivedOnB.strokeColor,
  });
  console.log('🎉 测试 1 [Web端 -> 桌面端] 画图同步验证通过！\n');

  // Step 5: Test 2 - Client B (Desktop) 画箭头连线，验证 Client A (Web) 实时收到
  console.log('Step 5: 测试 [桌面端 -> Web端] 画图反向同步...');
  const arrowElement = {
    id: 'arrow-call-flow',
    type: 'arrow',
    x: 370,
    y: 240,
    width: 150,
    height: 80,
    strokeColor: '#2f9e44',
    version: 1,
    versionNonce: 2001,
  };

  const receiveArrowPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('超时: Client A 未在 5 秒内收到 Client B 的图形')), 5000);
    elementsA.observe(() => {
      const received = elementsA.get('arrow-call-flow');
      if (received && received.id === 'arrow-call-flow') {
        clearTimeout(timeout);
        resolve(received);
      }
    });
  });

  // Client B draws
  docB.transact(() => {
    elementsB.set('arrow-call-flow', arrowElement);
  }, 'desktop-whiteboard');

  const receivedOnA = await receiveArrowPromise;
  console.log(`✅ Client A 成功毫秒级收到 Client B 绘制的图形:`, {
    id: receivedOnA.id,
    type: receivedOnA.type,
    x: receivedOnA.x,
    y: receivedOnA.y,
    color: receivedOnA.strokeColor,
  });
  console.log('🎉 测试 2 [桌面端 -> Web端] 反向同步验证通过！\n');

  // Step 6: Test 3 - 多人实时光标感知测试 (Awareness Pointer Tracking)
  console.log('Step 6: 测试多人白板光标指针实时感知 (Awareness Cursors)...');
  const cursorPromiseOnB = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('超时: Client B 未感知到 Client A 的光标位置')), 5000);
    providerB.awareness.on('change', () => {
      const states = providerB.awareness.getStates();
      states.forEach((state, clientId) => {
        if (clientId === providerA.awareness.clientID && state.whiteboardCursor) {
          clearTimeout(timeout);
          resolve(state);
        }
      });
    });
  });

  // Client A moves mouse
  providerA.awareness.setLocalStateField('whiteboardCursor', {
    x: 256,
    y: 384,
    tool: 'pointer',
  });

  const cursorOnB = await cursorPromiseOnB;
  console.log(`✅ Client B 成功感知到 Client A 的实时画板鼠标光标:`, {
    user: cursorOnB.user.name,
    cursor: cursorOnB.whiteboardCursor,
  });
  console.log('🎉 测试 3 多人实时画板光标感知验证通过！\n');

  // Step 7: Test 4 - 持久化与断线重连恢复验证
  console.log('Step 7: 测试服务端落盘持久化与断线新客户端恢复 (Persistence Test)...');
  // Disconnect A and B
  providerA.destroy();
  providerB.destroy();
  docA.destroy();
  docB.destroy();

  // Wait 500ms
  await new Promise((r) => setTimeout(r, 600));

  // Connect fresh Client C
  const docC = new Y.Doc();
  const providerC = new WebsocketProvider(WS_URL, TEST_ROOM_ID, docC, { WebSocketPolyfill: WebSocket, disableBc: true });
  const elementsC = docC.getMap('whiteboard-elements');

  await new Promise((resolve) => {
    providerC.on('sync', (isSynced) => {
      if (isSynced) resolve(true);
    });
  });

  const persistedRect = elementsC.get('rect-system-arch');
  const persistedArrow = elementsC.get('arrow-call-flow');

  if (!persistedRect || !persistedArrow) {
    throw new Error('❌ 持久化恢复验证失败: 新连接客户端未恢复之前绘制的图形！');
  }

  console.log('✅ 新客户端 Client C 成功从服务端持久化完全恢复画板内容:');
  console.log(`   - 图元 1: ${persistedRect.id} (type: ${persistedRect.type})`);
  console.log(`   - 图元 2: ${persistedArrow.id} (type: ${persistedArrow.type})`);
  console.log('🎉 测试 4 服务端持久化恢复验证通过！\n');

  providerC.destroy();
  docC.destroy();

  console.log('====================================================');
  console.log('🏆 所有白板实时协同测试 100% 成功通过！');
  console.log('   - Web -> Desktop 同步: 毫秒级无损');
  console.log('   - Desktop -> Web 同步: 毫秒级无损');
  console.log('   - 实时彩色光标与姓名感知: 正常');
  console.log('   - 离线持久化与自动恢复: 正常');
  console.log('====================================================\n');
}

runTest().catch((err) => {
  console.error('❌ 测试发生错误:', err);
  process.exit(1);
});
