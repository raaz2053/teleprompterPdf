#!/usr/bin/env node
/* eslint-disable no-console */
import { existsSync } from 'fs';
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWin = process.platform === 'win32';
const PORT = 4173;
const URL = `http://localhost:${PORT}`;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      stdio: 'inherit',
      shell: isWin,
      cwd: __dirname,
    });
    p.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))
    );
  });
}

function openBrowser(url) {
  const cmd = isWin
    ? `start "" "${url}"`
    : process.platform === 'darwin'
    ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.log(`Open this URL in your browser: ${url}`);
  });
}

async function main() {
  if (!existsSync(path.join(__dirname, 'node_modules'))) {
    console.log('📦 Installing dependencies (first run, takes a minute)...');
    await run('npm', ['install']);
  }

  if (!existsSync(path.join(__dirname, 'dist'))) {
    console.log('🔨 Building app (first run)...');
    await run('npm', ['run', 'build']);
  }

  console.log(`\n🚀 CuePDF running at ${URL}`);
  console.log('   Close this window to stop the server.\n');

  const server = spawn(
    'npx',
    ['vite', 'preview', '--port', String(PORT), '--strictPort'],
    { stdio: 'inherit', shell: isWin, cwd: __dirname }
  );

  // Give the server a moment, then open the browser
  setTimeout(() => openBrowser(URL), 2000);

  server.on('exit', (code) => process.exit(code ?? 0));

  process.on('SIGINT', () => {
    server.kill();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('\n❌ Launcher failed:', err.message);
  console.error('\nTry running manually:');
  console.error('   npm install && npm run build && npm run preview');
  if (isWin) {
    // keep the window open so the user can read the error
    spawn('cmd', ['/c', 'pause'], { stdio: 'inherit' });
  }
  process.exit(1);
});