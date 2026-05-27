#!/usr/bin/env node
/**
 * MVP benchmark: sends deterministic commands and reports pass/fail.
 * Requires orchestrator running on DRIFTCODE_URL (default http://127.0.0.1:17345).
 */

const base = process.env.DRIFTCODE_URL ?? 'http://127.0.0.1:17345';

const COMMANDS = [
  'switch command mode',
  'switch manual dictation mode',
  'what mode',
  'switch ai assist mode',
  'delete current line',
  'undo',
  'save file',
  'select current function',
  'go to line 1',
  'privacy on',
  'privacy off',
  'emergency stop',
  'resume previous mode',
  'switch command mode',
  'switch terminal mode',
  'git status',
  'switch browser mode',
  'open app',
  'check console',
  'switch app testing mode',
  'run login flow',
  'stop talking',
  'cancel',
  'switch ai assist mode',
  'apply the fix',
  'switch stream control mode',
  'switch review mode',
  'switch research mode',
  'switch vibe coding mode',
  'undo last phrase',
  'select current line',
];

async function postUtterance(text) {
  const res = await fetch(`${base}/api/utterance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for "${text}"`);
  return res.json();
}

async function getState() {
  const res = await fetch(`${base}/api/dashboard/state`);
  if (!res.ok) throw new Error(`State HTTP ${res.status}`);
  return res.json();
}

const results = [];
let passed = 0;

for (const text of COMMANDS) {
  try {
    const body = await postUtterance(text);
    const intentKnown = body.intent?.intentType !== 'unknown';
    const ok = intentKnown && !body.blocked;
    if (ok) passed++;
    results.push({
      text,
      ok,
      intent: body.intent?.summary,
      intentType: body.intent?.intentType,
      blocked: body.blocked,
      tools: body.toolResults?.map((t) => t.message ?? t.errorCode),
    });
  } catch (err) {
    results.push({ text, ok: false, error: err.message });
  }
}

let stateOk = false;
try {
  const state = await getState();
  stateOk = Boolean(state.sessionId && state.activeModeId);
} catch (err) {
  results.push({ text: '__state__', ok: false, error: err.message });
}

console.log(JSON.stringify({
  total: COMMANDS.length,
  passed,
  failed: COMMANDS.length - passed,
  stateOk,
  passRate: `${Math.round((passed / COMMANDS.length) * 100)}%`,
  results,
}, null, 2));

process.exit(passed >= COMMANDS.length * 0.8 && stateOk ? 0 : 1);
