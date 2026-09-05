import { createServer } from 'vite';
import { spawn } from 'child_process';
import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import electronPath from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function startDev() {
  console.log('[Dev] Starting Server App Vite Renderer Dev Server...');
  const viteServer = await createServer({
    configFile: path.resolve(rootDir, 'vite.config.ts'),
    server: { port: 5175 },
  });
  await viteServer.listen();
  console.log('[Dev] Server App Vite listening on http://localhost:5175');

  const commonConfig = {
    bundle: true,
    platform: 'node',
    target: 'node20',
    sourcemap: 'inline',
    external: ['electron', 'ws', 'fsevents'],
    define: {
      'process.env.VITE_DEV_SERVER_URL': JSON.stringify('http://localhost:5175'),
      'process.env.NODE_ENV': JSON.stringify('development'),
    },
  };

  let electronProcess = null;

  const restartElectron = () => {
    if (electronProcess) {
      console.log('[Dev] Restarting Electron...');
      electronProcess.kill('SIGINT');
      electronProcess = null;
    }

    electronProcess = spawn(String(electronPath), [path.resolve(rootDir, 'dist/main/index.cjs')], {
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: 'http://localhost:5175',
        NODE_ENV: 'development',
      },
    });

    electronProcess.on('exit', (code) => {
      if (code !== null && code !== 0) {
        console.log(`[Dev] Electron exited with code ${code}`);
      }
    });
  };

  const mainContext = await esbuild.context({
    ...commonConfig,
    entryPoints: [path.resolve(rootDir, 'src/main/index.ts')],
    outfile: path.resolve(rootDir, 'dist/main/index.cjs'),
    format: 'cjs',
    plugins: [
      {
        name: 'electron-reloader',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length === 0) {
              restartElectron();
            }
          });
        },
      },
    ],
  });

  const preloadContext = await esbuild.context({
    ...commonConfig,
    entryPoints: [path.resolve(rootDir, 'src/preload/index.ts')],
    outfile: path.resolve(rootDir, 'dist/preload/index.cjs'),
    format: 'cjs',
  });

  await preloadContext.watch();
  await mainContext.watch();
  console.log('[Dev] Server App Dev environment ready.');
}

startDev().catch((err) => {
  console.error('[Dev Error]', err);
  process.exit(1);
});
