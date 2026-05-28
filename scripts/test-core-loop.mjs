#!/usr/bin/env node
/**
 * Phase 1 acceptance test — full hands-free core loop via utterance injection.
 * Requires orchestrator running (`npm start`).
 *
 * Uses fake AI provider (no OpenAI key). Enables via PUT /api/config before tests.
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

// Enable fake AI for deterministic patch flow
await check('enable fake AI provider', async () => {
  await putConfig({ aiProviderId: 'fake', openAiApiKey: 'test-fake-key' });
  const health = await fetch(`${base}/api/health`).then((r) => r.json());
  if (health.aiProviderId !== 'fake') throw new Error(`expected fake, got ${health.aiProviderId}`);
});

await check('deterministic mode switch (no AI)', async () => {
  const before = await dashboard();
  const callsBefore = before.aiCallsThisSession ?? 0;
  const body = await post('switch command mode');
  if (body.intent?.intentType !== 'mode_switch') throw new Error(`got ${body.intent?.intentType}`);
  const after = await dashboard();
  if ((after.aiCallsThisSession ?? 0) !== callsBefore) throw new Error('mode switch invoked AI');
});

await check('deterministic dictation parses (no AI)', async () => {
  const before = await dashboard();
  const callsBefore = before.aiCallsThisSession ?? 0;
  await post('switch manual dictation mode');
  const body = await post('const user equals await get user open paren id close paren');
  if (body.intent?.intentType !== 'dictation') throw new Error(`got ${body.intent?.intentType}`);
  const after = await dashboard();
  if ((after.aiCallsThisSession ?? 0) !== callsBefore) throw new Error('dictation invoked AI');
});

await check('emergency stop halts harness', async () => {
  const body = await post('emergency stop');
  if (!body.blocked) throw new Error('emergency should report blocked=true');
  const state = await dashboard();
  if (!state.emergencyStopActive) throw new Error('emergency flag not set');
});

await check('emergency blocks dictation', async () => {
  const body = await post('const x equals 1');
  const err = body.toolResults?.find((r) => r.errorCode === 'EMERGENCY_STOP');
  if (!err) throw new Error(`expected EMERGENCY_STOP, got ${JSON.stringify(body.toolResults)}`);
});

await check('emergency blocks AI request', async () => {
  const body = await post('ask ai fix this bug');
  const state = await dashboard();
  if (!state.emergencyStopActive) throw new Error('should still be in emergency');
  const aiBlocked =
    body.toolResults?.some((r) => r.errorCode === 'EMERGENCY_STOP') ||
    body.message?.toLowerCase().includes('not available') ||
    !(body.toolResults ?? []).some((r) => r.success && r.message?.includes('Patch'));
  if (!aiBlocked) throw new Error('AI should not run during emergency');
});

await check('resume clears emergency', async () => {
  const body = await post('resume previous mode');
  if (body.intent?.intentType === 'unknown') throw new Error('resume failed');
  const state = await dashboard();
  if (state.emergencyStopActive) throw new Error('emergency still active');
});

await check('fake AI produces pending patch', async () => {
  await post('switch ai assist mode');
  const before = await dashboard();
  const callsBefore = before.aiCallsThisSession ?? 0;
  const body = await post('ask ai fix this');
  const msg = (body.message ?? body.toolResults?.[0]?.message ?? '').toLowerCase();
  if (!msg.includes('patch') && !msg.includes('ready')) throw new Error(`unexpected message: ${body.message}`);
  const after = await dashboard();
  if ((after.aiCallsThisSession ?? 0) <= callsBefore) throw new Error('AI call not recorded');
  if (!after.pendingPatchSummary) throw new Error('no pending patch summary');
  const pending = await fetch(`${base}/api/patch/pending`).then((r) => r.json());
  if (!pending.patch?.path) throw new Error('patch store empty');
});

await check('protected patch rejected by validator', async () => {
  await post('switch ai assist mode');
  const aiBody = await post('ask ai fix protected .env file');
  const msg = (aiBody.message ?? aiBody.toolResults?.[0]?.message ?? '').toLowerCase();
  if (!msg.includes('protected')) throw new Error(`AI should reject protected patch: ${msg}`);
  const pending = await fetch(`${base}/api/patch/pending`).then((r) => r.json());
  if (pending.patch?.path === '.env') throw new Error('protected patch should not be stored');
});

await check('apply patch requires VS Code or reports honestly', async () => {
  await post('ask ai fix this');
  const body = await post('apply the fix');
  const result = body.toolResults?.[0];
  if (!result) throw new Error('no tool result');
  // Without extension: NOT_CONNECTED; with extension: success
  if (!result.success && !['NOT_CONNECTED', 'NO_PATCH', 'PROTECTED_PATH'].includes(result.errorCode)) {
    throw new Error(`unexpected apply result: ${result.errorCode ?? result.message}`);
  }
});

await check('unknown intent fails closed (no AI)', async () => {
  const sw = await post('switch terminal mode');
  if (sw.intent?.intentType !== 'mode_switch') throw new Error(`terminal mode switch failed: ${sw.intent?.intentType}`);
  const before = await dashboard();
  const callsBefore = before.aiCallsThisSession ?? 0;
  const body = await post('xyzzy plugh totally unknown phrase');
  if (body.intent?.intentType !== 'unknown') throw new Error(`expected unknown, got ${body.intent?.intentType}`);
  const after = await dashboard();
  if ((after.aiCallsThisSession ?? 0) !== callsBefore) throw new Error('unknown intent invoked AI');
});

console.log(`\nCore loop: ${ok}/${total} passed`);
process.exit(ok === total ? 0 : 1);
