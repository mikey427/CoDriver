#!/usr/bin/env node
/**
 * End-to-end MVP smoke test for DriftCode Harness.
 * Starts nothing — run `npm start` in another terminal first.
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

async function post(text) {
  const res = await fetch(`${base}/api/utterance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

let ok = 0;
let total = 0;

async function check(name, fn) {
  total++;
  if (await assert(name, fn)) ok++;
}

await check('orchestrator reachable', async () => {
  const res = await fetch(`${base}/api/health`);
  if (!res.ok) throw new Error('health failed');
});

await check('mode switch works', async () => {
  const body = await post('switch command mode');
  if (body.intent?.intentType === 'unknown') throw new Error('unknown intent');
});

await check('dictation grammar parses', async () => {
  await post('switch manual dictation mode');
  const body = await post('const user equals await get user open paren id close paren');
  if (body.intent?.intentType !== 'dictation') throw new Error(`got ${body.intent?.intentType}`);
});

await check('emergency stop + resume', async () => {
  await post('emergency stop');
  const resumed = await post('resume previous mode');
  if (resumed.intent?.intentType === 'unknown') throw new Error('resume failed');
  const state = await fetch(`${base}/api/dashboard/state`).then((r) => r.json());
  if (state.emergencyStopActive) throw new Error('emergency still active after resume');
});

await check('registry navigation command', async () => {
  await post('switch ai assist mode');
  const body = await post('go to line 1');
  if (body.intent?.intentType === 'unknown') throw new Error('navigation not registered');
});

await check('dashboard state has session', async () => {
  const res = await fetch(`${base}/api/dashboard/state`);
  const state = await res.json();
  if (!state.sessionId) throw new Error('missing session');
});

await check('admin static served', async () => {
  const res = await fetch(`${base}/admin/`);
  if (!res.ok) throw new Error(`admin ${res.status}`);
});

await check('overlay static served', async () => {
  const res = await fetch(`${base}/overlay/`);
  if (!res.ok) throw new Error(`overlay ${res.status}`);
});

console.log(`\nMVP smoke: ${ok}/${total} passed`);
process.exit(ok === total ? 0 : 1);
