import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isWatch = process.argv.includes('--watch');

const commonConfig = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  external: ['electron'],
};

async function build() {
  console.log('[Build] Building Electron Main & Preload scripts...');

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
    console.log('[Build] Main & Preload built successfully.');
  }
}

build().catch((err) => {
  console.error('[Build Error]', err);
  process.exit(1);
});
