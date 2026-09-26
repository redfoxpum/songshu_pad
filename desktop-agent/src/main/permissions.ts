import { systemPreferences, shell } from 'electron';
import { ScreenPermissionResult, MediaAccessStatus } from '../types/ipc.js';

export function checkScreenRecordingPermission(): ScreenPermissionResult {
  if (process.platform !== 'darwin') {
    return {
      status: 'granted',
      granted: true,
      platform: process.platform,
    };
  }

  try {
    const status = systemPreferences.getMediaAccessStatus('screen') as MediaAccessStatus;
    const granted = status === 'granted';
    return {
      status,
      granted,
      platform: 'darwin',
    };
  } catch (error) {
    console.error('[Permissions] Failed to get screen media access status:', error);
    return {
      status: 'unknown',
      granted: false,
      platform: 'darwin',
    };
  }
}

export async function openScreenPermissionSettings(): Promise<boolean> {
  if (process.platform === 'darwin') {
    try {
      // macOS System Settings -> Privacy & Security -> Screen Recording
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
      return true;
    } catch (err) {
      console.error('[Permissions] Failed to open macOS System Settings:', err);
      return false;
    }
  } else if (process.platform === 'win32') {
    try {
      await shell.openExternal('ms-settings:privacy');
      return true;
    } catch (err) {
      console.error('[Permissions] Failed to open Windows Settings:', err);
      return false;
    }
  }
  return false;
}
