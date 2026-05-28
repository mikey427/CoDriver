#!/usr/bin/env node
/**
 * Phase 3 — PTT endpoint tests (no microphone).
 * Requires orchestrator running (`npm start`).
 */

const base = process.env.DRIFTCODE_URL ?? 'http://127.0.0.1:17345';

async function assert(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    return true;
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    return false;
  }
}

async function getPtt() {
  const res = await fetch(`${base}/api/ptt/state`);
  if (!res.ok) throw new Error(`GET ptt/state ${res.status}`);
  return res.json();
}

async function post(path, body = {}) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  return res.json();
}

async function dashboard() {
  const res = await fetch(`${base}/api/dashboard/state`);
  if (!res.ok) throw new Error('dashboard failed');
  return res.json();
}

let ok = 0;
let total = 0;

async function check(name, fn) {
  total++;
  if (await assert(name, fn)) ok++;
}

await check('PTT start sets active state', async () => {
  const body = await post('/api/ptt/start', { source: 'http' });
  if (!body.ptt?.active) throw new Error('expected active=true');
  const state = await getPtt();
  if (!state.ptt?.active) throw new Error('state not active');
  const dash = await dashboard();
  if (!dash.pttState?.active) throw new Error('dashboard pttState not active');
});

await check('PTT stop clears active state', async () => {
  await post('/api/ptt/start', { source: 'admin' });
  const body = await post('/api/ptt/stop');
  if (body.ptt?.active) throw new Error('expected active=false after stop');
  const dash = await dashboard();
  if (dash.pttState?.active) throw new Error('dashboard still active');
});

await check('PTT cancel clears active state', async () => {
  await post('/api/ptt/start', { source: 'admin' });
  const body = await post('/api/ptt/cancel');
  if (body.ptt?.active) throw new Error('expected active=false after cancel');
  if (!body.ptt?.cancelledAt) throw new Error('expected cancelledAt timestamp');
});

await check('emergency stop clears PTT', async () => {
  await post('/api/ptt/start', { source: 'admin' });
  await post('/api/emergency-stop');
  const dash = await dashboard();
  if (dash.pttState?.active) throw new Error('PTT should be cleared on emergency');
  if (!dash.emergencyStopActive) throw new Error('emergency not active');
  await post('/api/emergency-clear');
});

await check('legacy speech ptt down/up still works', async () => {
  const down = await post('/api/speech/ptt/down');
  if (!down.pttActive) throw new Error('legacy ptt down failed');
  const up = await post('/api/speech/ptt/up', { text: 'switch command mode' });
  if (!up.processed) throw new Error('legacy ptt up should process text');
});

console.log(`\nPTT: ${ok}/${total} passed`);
process.exit(ok === total ? 0 : 1);
