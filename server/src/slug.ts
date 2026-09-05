import crypto from 'crypto';

/**
 * Generates a standard UUID v4 room ID.
 * e.g. "a3f89e42-9b21-4d33-bc44-8849f12d59a2"
 */
export function generateRoomId(_language?: string): string {
  return crypto.randomUUID();
}

/**
 * Alias for backward compatibility.
 */
export const generateRoomSlug = generateRoomId;
