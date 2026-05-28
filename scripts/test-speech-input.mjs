#!/usr/bin/env node
/**
 * Phase 3 — speech input source + confidence tests (no microphone).
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

async function utterance(body) {
  const res = await fetch(`${base}/api/utterance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function dashboard() {
  const res = await fetch(`${base}/api/dashboard/state`);
  if (!res.ok) throw new Error('dashboard failed');
  return res.json();
}

async function putConfig(partial) {
  const res = await fetch(`${base}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  });
  if (!res.ok) throw new Error(`config PUT ${res.status}`);
  return res.json();
}

let ok = 0;
let total = 0;

async function check(name, fn) {
  total++;
  if (await assert(name, fn)) ok++;
}

await check('HTTP utterance defaults source http', async () => {
  const body = await utterance({ text: 'switch command mode' });
  if (body.source && body.source !== 'http') throw new Error(`expected http source, got ${body.source}`);
  const dash = await dashboard();
  if (dash.lastNormalizedUtterance?.source && dash.lastNormalizedUtterance.source !== 'http') {
    throw new Error(`dashboard source ${dash.lastNormalizedUtterance.source}`);
  }
});

await check('admin-manual source tracked', async () => {
  const body = await utterance({ text: 'switch manual dictation mode', source: 'admin-manual' });
  if (body.source !== 'admin-manual') throw new Error(`got ${body.source}`);
  const dash = await dashboard();
  if (dash.lastNormalizedUtterance?.source !== 'admin-manual') {
    throw new Error(`dashboard ${dash.lastNormalizedUtterance?.source}`);
  }
});

await check('admin-mic simulated source routes normally', async () => {
  const before = await dashboard();
  const callsBefore = before.aiCallsThisSession ?? 0;
  const body = await utterance({
    text: 'const user equals await get user open paren id close paren',
    source: 'admin-mic',
    confidence: 0.92,
  });
  if (body.source !== 'admin-mic') throw new Error(`source ${body.source}`);
  if (body.intent?.intentType !== 'dictation') throw new Error(`intent ${body.intent?.intentType}`);
  const after = await dashboard();
  if ((after.aiCallsThisSession ?? 0) !== callsBefore) throw new Error('mic dictation invoked AI');
});

await check('missing confidence behaves like HTTP (no block)', async () => {
  const body = await utterance({ text: 'switch command mode', source: 'test' });
  if (body.blocked) throw new Error('should not block without confidence');
  if (body.toolResults?.[0]?.errorCode === 'LOW_CONFIDENCE') throw new Error('unexpected LOW_CONFIDENCE');
});

await check('high confidence processes normally', async () => {
  const body = await utterance({ text: 'switch command mode', source: 'admin-mic', confidence: 0.95 });
  if (body.blocked) throw new Error('high confidence blocked');
  if (body.intent?.intentType !== 'mode_switch') throw new Error(`got ${body.intent?.intentType}`);
});

await check('low confidence blocks non-emergency utterance', async () => {
  await putConfig({ speechConfidenceThreshold: 0.65 });
  const body = await utterance({ text: 'switch command mode', source: 'admin-mic', confidence: 0.3 });
  if (!body.blocked) throw new Error('expected blocked=true');
  const err = body.toolResults?.find((r) => r.errorCode === 'LOW_CONFIDENCE');
  if (!err) throw new Error(`expected LOW_CONFIDENCE, got ${JSON.stringify(body.toolResults)}`);
  const dash = await dashboard();
  if (!dash.lastBlockedLowConfidence) throw new Error('lastBlockedLowConfidence missing');
});

await check('low confidence still allows emergency phrase', async () => {
  await putConfig({ speechConfidenceThreshold: 0.65 });
  const body = await utterance({ text: 'emergency stop', source: 'admin-mic', confidence: 0.2 });
  if (!body.blocked) throw new Error('emergency should report blocked harness');
  const dash = await dashboard();
  if (!dash.emergencyStopActive) throw new Error('emergency not activated');
  await fetch(`${base}/api/emergency-clear`, { method: 'POST' });
});

console.log(`\nSpeech input: ${ok}/${total} passed`);
process.exit(ok === total ? 0 : 1);
