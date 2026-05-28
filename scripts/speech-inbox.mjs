#!/usr/bin/env node
/**
 * Drop a utterance into the speech inbox for processing.
 * Usage: npm run speech:send -- "switch command mode"
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const text = process.argv.slice(2).join(' ');
if (!text) {
  console.error('Usage: node scripts/speech-inbox.mjs "your utterance"');
  process.exit(1);
}

const inbox = process.env.DRIFTCODE_INBOX ?? join(homedir(), '.driftcode', 'inbox');
mkdirSync(inbox, { recursive: true });
const file = join(inbox, `${Date.now()}.txt`);
writeFileSync(file, text, 'utf-8');
console.log(`Queued: ${file}`);
