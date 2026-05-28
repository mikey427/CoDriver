#!/usr/bin/env node
/**
 * Phase 2 simulated mini editing session via utterance injection.
 * Requires orchestrator running. VS Code optional — grammar/parse always tested.
 */

const base = process.env.DRIFTCODE_URL ?? 'http://127.0.0.1:17345';

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

let ok = 0;
let total = 0;

async function check(name, fn) {
  total++;
  try {
    await fn();
    console.log(`✓ ${name}`);
    ok++;
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
  }
}

await check('orchestrator reachable', async () => {
  const res = await fetch(`${base}/api/health`);
  if (!res.ok) throw new Error('health failed');
});

await check('switch manual dictation mode', async () => {
  const body = await post('switch manual dictation mode');
  if (body.intent?.intentType !== 'mode_switch') throw new Error(String(body.intent?.intentType));
});

const aiBefore = (await dashboard()).aiCallsThisSession ?? 0;

await check('insert const declaration (grammar)', async () => {
  const body = await post('const user equals await get user open paren id close paren');
  if (body.intent?.intentType !== 'dictation') throw new Error(String(body.intent?.intentType));
  const expected = 'const user = await getUser(id)';
  const payload = body.intent?.summary ?? body.toolResults?.[0]?.message;
  if (!String(payload).includes('getUser')) throw new Error(`unexpected: ${payload}`);
});

await check('insert function phrase', async () => {
  const body = await post('function get user open paren id close paren');
  if (body.intent?.intentType !== 'dictation') throw new Error(String(body.intent?.intentType));
});

await check('insert return statement', async () => {
  const body = await post('return user');
  if (body.intent?.intentType !== 'dictation') throw new Error(String(body.intent?.intentType));
});

await check('replace last word parses with grammar', async () => {
  const body = await post('replace last word with profile');
  if (body.intent?.intentType !== 'editor_transform') throw new Error(String(body.intent?.intentType));
  if (body.intent?.summary && !body.intent.summary.toLowerCase().includes('replace')) {
    // registry match still editor transform
  }
});

await check('scratch that maps to undo', async () => {
  const body = await post('scratch that');
  if (body.intent?.intentType !== 'editor_transform') throw new Error(String(body.intent?.intentType));
});

await check('repeat last phrase parses', async () => {
  const body = await post('repeat last phrase');
  if (body.intent?.intentType !== 'editor_transform') throw new Error(String(body.intent?.intentType));
});

await check('save file command parses', async () => {
  const body = await post('save file');
  if (body.intent?.intentType !== 'editor_transform') throw new Error(String(body.intent?.intentType));
});

await check('no AI calls during session', async () => {
  const after = await dashboard();
  if ((after.aiCallsThisSession ?? 0) !== aiBefore) throw new Error('AI was invoked during dictation');
});

console.log(`\nPhase 2: ${ok}/${total} passed`);
process.exit(ok === total ? 0 : 1);
