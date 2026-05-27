#!/usr/bin/env node
/**
 * Quick harness test: POST utterances to the orchestrator.
 * Usage: node scripts/test-utterance.mjs "switch command mode"
 */

const base = process.env.DRIFTCODE_URL ?? 'http://127.0.0.1:17345';
const text = process.argv.slice(2).join(' ') || 'switch command mode';

const res = await fetch(`${base}/api/utterance`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text }),
});

const body = await res.json();
console.log(JSON.stringify(body, null, 2));
