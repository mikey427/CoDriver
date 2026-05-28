#!/usr/bin/env node
/**
 * Phase 2.5 — preview patch command (no apply, privacy-safe summary).
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

async function post(text) {
  const res = await fetch(`${base}/api/utterance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

async function clearPatch() {
  await fetch(`${base}/api/patch/pending`, { method: 'DELETE' }).catch(() => {});
}

let ok = 0;
let total = 0;

async function check(name, fn) {
  total++;
  if (await assert(name, fn)) ok++;
}

await check('enable fake AI', async () => {
  await putConfig({ aiProviderId: 'fake', openAiApiKey: 'test-fake-key' });
});

await check('preview patch with no patch returns NO_PATCH', async () => {
  await clearPatch();
  await post('switch command mode');
  const body = await post('preview patch');
  const result = body.toolResults?.[0];
  if (!result || result.errorCode !== 'NO_PATCH') {
    throw new Error(`expected NO_PATCH, got ${JSON.stringify(result)}`);
  }
  const pending = await fetch(`${base}/api/patch/pending`).then((r) => r.json());
  if (pending.patch) throw new Error('patch store should still be empty');
});

await check('preview patch after fake AI shows summary without applying', async () => {
  await post('switch ai assist mode');
  await post('ask ai fix this');
  const pendingBefore = await fetch(`${base}/api/patch/pending`).then((r) => r.json());
  if (!pendingBefore.patch?.path) throw new Error('expected pending patch from fake AI');

  const body = await post('what is the fix');
  const result = body.toolResults?.[0];
  if (!result?.success) throw new Error(`preview failed: ${JSON.stringify(result)}`);
  if (!result.message?.includes(pendingBefore.patch.path)) {
    throw new Error(`summary missing path: ${result.message}`);
  }
  if (result.message.includes('SECRET') || result.message.includes('apiKey')) {
    throw new Error('summary leaked sensitive content');
  }

  const pendingAfter = await fetch(`${base}/api/patch/pending`).then((r) => r.json());
  if (!pendingAfter.patch?.path) throw new Error('preview must not clear pending patch');
});

await check('preview patch warns on protected path without storing secrets', async () => {
  await post('switch ai assist mode');
  const aiBody = await post('ask ai fix protected .env file');
  const msg = (aiBody.message ?? aiBody.toolResults?.[0]?.message ?? '').toLowerCase();
  if (!msg.includes('protected')) throw new Error(`fake AI should reject protected patch: ${msg}`);
  const pending = await fetch(`${base}/api/patch/pending`).then((r) => r.json());
  if (pending.patch?.path === '.env') throw new Error('protected patch must not be stored');
});

console.log(`\nPreview patch: ${ok}/${total} passed`);
process.exit(ok === total ? 0 : 1);
