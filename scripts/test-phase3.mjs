#!/usr/bin/env node
/**
 * Phase 3 acceptance — runs PTT + speech-input tests.
 * Requires orchestrator running (`npm start`).
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [join(root, 'scripts', script)], { stdio: 'inherit', env: process.env });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`))));
  });
}

const health = await fetch(`${process.env.DRIFTCODE_URL ?? 'http://127.0.0.1:17345'}/api/health`);
if (!health.ok) {
  console.error('Orchestrator not reachable — run npm start first');
  process.exit(1);
}

console.log('Phase 3 acceptance\n');
await run('test-ptt.mjs');
console.log('');
await run('test-speech-input.mjs');
console.log('\nPhase 3: all checks passed');
