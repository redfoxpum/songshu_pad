/**
 * Connection Token Utility for Squirrel Pad
 * Encrypts and decodes { serverUrl, roomId } into an opaque token like `sqp_8f9a2c...`
 */

const TOKEN_PREFIX = 'sqp_';
const SECRET_SALT = 'SQP_Pad_2026_SecKey_#99x';

// Lightweight symmetric stream scramble (AES-like XOR + dynamic pseudo-random diffusion)
function scrambleBytes(data: Uint8Array, salt: string, nonce: number): Uint8Array {
  const result = new Uint8Array(data.length);
  const keyBytes = new TextEncoder().encode(salt);
  let state = (nonce * 31 + 17) & 0xffffffff;

  for (let i = 0; i < data.length; i++) {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    const keyByte = keyBytes[(i + (nonce % keyBytes.length)) % keyBytes.length];
    const pseudoRand = (state >> 16) & 0xff;
    result[i] = data[i] ^ keyByte ^ pseudoRand;
  }
  return result;
}

/**
 * Encodes serverUrl and roomId into a single opaque token (e.g. `sqp_...`)
 */
export function encodeConnectionToken(serverUrl: string, roomId: string): string {
  const cleanServer = (serverUrl || 'http://localhost:3000').trim().replace(/\/+$/, '');
  const cleanRoom = (roomId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');

  const payloadObj = {
    s: cleanServer,
    r: cleanRoom,
    t: Date.now(),
  };

  const jsonStr = JSON.stringify(payloadObj);
  const dataBytes = new TextEncoder().encode(jsonStr);

  // Random 2-byte nonce (0 - 65535) for entropy & scrambling diversity
  const nonce = Math.floor(Math.random() * 65535);
  const scrambled = scrambleBytes(dataBytes, SECRET_SALT, nonce);

  // Pack: [nonce_high, nonce_low, ...scrambled_bytes]
  const packed = new Uint8Array(2 + scrambled.length);
  packed[0] = (nonce >> 8) & 0xff;
  packed[1] = nonce & 0xff;
  packed.set(scrambled, 2);

  // Convert to Base64URL
  let binary = '';
  for (let i = 0; i < packed.length; i++) {
    binary += String.fromCharCode(packed[i]);
  }
  const base64 = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${TOKEN_PREFIX}${base64}`;
}

export interface DecodedConnectionInfo {
  serverUrl: string;
  roomId: string;
  isEncryptedToken: boolean;
}

/**
 * Smart decode function:
 * 1. Checks if input is an encrypted `sqp_...` token -> decodes { serverUrl, roomId }
 * 2. Checks if input is a full URL (`http.../room/abc` or `?room=abc`) -> extracts host & room
 * 3. Checks if input is a roomId -> uses defaultServerUrl + roomId
 */
export function decodeConnectionToken(
  input: string,
  defaultServerUrl: string = 'http://localhost:3000'
): DecodedConnectionInfo | null {
  if (!input || typeof input !== 'string') return null;
  let raw = input.trim().replace(/^["'`]|["'`]$/g, ''); // strip outer quotes if any
  if (!raw) return null;

  // 1. Try decrypting as sqp_ token or opaque base64 token
  const isPrefixMatch = raw.toLowerCase().startsWith(TOKEN_PREFIX.toLowerCase());
  if (isPrefixMatch || (!raw.includes('/') && !raw.includes(':') && raw.length > 25)) {
    try {
      const tokenBody = isPrefixMatch ? raw.slice(TOKEN_PREFIX.length) : raw;
      // Convert base64url to standard base64
      let base64 = tokenBody.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4 !== 0) {
        base64 += '=';
      }

      const binary = atob(base64);
      const packed = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        packed[i] = binary.charCodeAt(i);
      }

      if (packed.length > 2) {
        const nonce = (packed[0] << 8) | packed[1];
        const scrambled = packed.slice(2);
        const dataBytes = scrambleBytes(scrambled, SECRET_SALT, nonce);
        const jsonStr = new TextDecoder().decode(dataBytes);
        const obj = JSON.parse(jsonStr);

        if (obj && typeof obj.s === 'string' && typeof obj.r === 'string' && obj.r.length > 0) {
          return {
            serverUrl: obj.s.trim().replace(/\/+$/, ''),
            roomId: obj.r.trim(),
            isEncryptedToken: true,
          };
        }
      }
    } catch (e) {
      // Fall through to next checks
    }
  }

  // 2. Try parsing as a full URL
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.includes('/room/') || raw.includes('?room=')) {
    try {
      let urlStr = raw;
      if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
        urlStr = 'http://' + urlStr;
      }
      const url = new URL(urlStr);
      const serverUrl = `${url.protocol}//${url.host}`;
      let roomId = '';

      const match = url.pathname.match(/\/room\/([a-zA-Z0-9_-]+)/);
      if (match) {
        roomId = match[1];
      } else if (url.searchParams.has('room')) {
        roomId = url.searchParams.get('room') || '';
      }

      if (roomId) {
        return {
          serverUrl,
          roomId,
          isEncryptedToken: false,
        };
      }
    } catch (e) {
      // Fall through
    }
  }

  // 3. Fallback: treat as pure roomId
  const sanitizedRoom = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  if (sanitizedRoom.length > 0) {
    return {
      serverUrl: defaultServerUrl.trim().replace(/\/+$/, ''),
      roomId: sanitizedRoom,
      isEncryptedToken: false,
    };
  }

  return null;
}
