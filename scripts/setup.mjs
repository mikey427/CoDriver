#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

function run(cmd, args, opts = {}) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('npm', ['install']);

// Optional peers for browser/AI/OBS paths
run('npm', ['install', '-w', '@driftcode/orchestrator', 'playwright', 'openai', 'obs-websocket-js'], { stdio: 'inherit' });

try {
  run('npx', ['playwright', 'install', 'chromium'], { cwd: join(root, 'packages/orchestrator') });
} catch {
  console.warn('Playwright browser install skipped (optional)');
}

run('npm', ['run', 'build']);

const driftDir = join(root, '.driftcode');
if (!existsSync(driftDir)) mkdirSync(driftDir, { recursive: true });
const example = join(root, '.driftcode/config.example.json');
const config = join(driftDir, 'config.json');
if (existsSync(example) && !existsSync(config)) {
  copyFileSync(example, config);
  console.log('Created .driftcode/config.json from example');
}

console.log('\nSetup complete.');
console.log('  npm start              — start orchestrator');
console.log('  npm run test:mvp       — smoke test (orchestrator must be running)');
console.log('  npm run test:benchmark — 30-command registry benchmark');
console.log('  npm run test:utterance — send a single utterance');
