import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isWatch = process.argv.includes('--watch');

const commonConfig = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  external: ['electron', 'ws', 'fsevents'],
};

async function build() {
  console.log('[Build] Building Electron Main & Preload scripts for Server App...');

  const mainContext = await esbuild.context({
    ...commonConfig,
    entryPoints: [path.resolve(__dirname, '../src/main/index.ts')],
    outfile: path.resolve(__dirname, '../dist/main/index.cjs'),
    format: 'cjs',
  });

  const preloadContext = await esbuild.context({
    ...commonConfig,
    entryPoints: [path.resolve(__dirname, '../src/preload/index.ts')],
    outfile: path.resolve(__dirname, '../dist/preload/index.cjs'),
    format: 'cjs',
  });

  if (isWatch) {
    await mainContext.watch();
    await preloadContext.watch();
    console.log('[Build] Watching Main & Preload for changes...');
  } else {
    await mainContext.rebuild();
    await preloadContext.rebuild();
    await mainContext.dispose();
    await preloadContext.dispose();

    // Copy web client build into server-app/dist/client so it is bundled with the .app
    const clientDistSrc = path.resolve(__dirname, '../../client/dist');
    const clientDistDest = path.resolve(__dirname, '../dist/client');
    if (fs.existsSync(clientDistSrc)) {
      console.log(`[Build] Copying web client dist from ${clientDistSrc} to ${clientDistDest}...`);
      fs.cpSync(clientDistSrc, clientDistDest, { recursive: true });
    }

    console.log('[Build] Main & Preload built successfully.');
  }
}

build().catch((err) => {
  console.error('[Build Error]', err);
  process.exit(1);
});
