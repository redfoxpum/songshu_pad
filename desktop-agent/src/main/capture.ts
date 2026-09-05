import { desktopCapturer, screen, NativeImage } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

export interface ScreenCaptureData {
  buffer: Buffer;
  base64: string;
  dataUrl: string;
  width: number;
  height: number;
  timestamp: number;
}

async function captureWithScreencapture(): Promise<ScreenCaptureData> {
  const tmpPath = path.join(os.tmpdir(), `agent_cap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`);
  try {
    // -x: silent (no click sound), -t jpg: jpeg format, -C: capture cursor
    await execFileAsync('/usr/sbin/screencapture', ['-x', '-t', 'jpg', tmpPath]);
    if (!fs.existsSync(tmpPath)) {
      throw new Error('screencapture failed to produce image file');
    }
    const buffer = fs.readFileSync(tmpPath);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scaleFactor = primaryDisplay.scaleFactor || 1;

    return {
      buffer,
      base64,
      dataUrl,
      width: Math.round(width * scaleFactor),
      height: Math.round(height * scaleFactor),
      timestamp: Date.now(),
    };
  } finally {
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {}
  }
}

export async function captureFullScreen(targetQuality: number = 85): Promise<ScreenCaptureData> {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scaleFactor = primaryDisplay.scaleFactor || 1;

    // Calculate pixel dimensions
    const captureWidth = Math.min(Math.round(width * scaleFactor), 2560);
    const captureHeight = Math.min(Math.round(height * scaleFactor), 1440);

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: captureWidth,
        height: captureHeight,
      },
      fetchWindowIcons: false,
    });

    if (sources && sources.length > 0) {
      // Find primary screen source or default to first
      let primarySource = sources.find((s) => s.display_id === String(primaryDisplay.id)) || sources[0];
      const thumbnail: NativeImage = primarySource.thumbnail;

      if (!thumbnail.isEmpty()) {
        const jpegBuffer = thumbnail.toJPEG(targetQuality);
        const base64 = jpegBuffer.toString('base64');
        const dataUrl = `data:image/jpeg;base64,${base64}`;
        const actualSize = thumbnail.getSize();

        return {
          buffer: jpegBuffer,
          base64,
          dataUrl,
          width: actualSize.width || captureWidth,
          height: actualSize.height || captureHeight,
          timestamp: Date.now(),
        };
      }
    }
  } catch (err) {
    console.warn('[Capture] desktopCapturer failed, falling back to screencapture:', err);
  }

  // Fallback to macOS native screencapture CLI
  if (process.platform === 'darwin') {
    return await captureWithScreencapture();
  }

  throw new Error('No screen sources found for capture.');
}
