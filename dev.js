// Starts both "dev servers": the esbuild watcher (rebuilds client/public/assets/bundle.js
// on every save) and the Node backend (REST + WebSocket + static file serving on :8787).
// Run with: node dev.js
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run(name, cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, stdio: 'pipe' });
  child.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
  child.on('exit', (code) => console.log(`[${name}] exited with code ${code}`));
  return child;
}

const esbuildWatch = run('build', 'node', ['build.js', '--watch'], path.join(__dirname, 'client'));
const server = run('server', 'node', ['index.js'], path.join(__dirname, 'server'));

function shutdown() {
  esbuildWatch.kill();
  server.kill();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
