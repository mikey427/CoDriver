#!/usr/bin/env node
/**
 * Parser-level correction command tests (no VS Code required).
 */

import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(new URL(import.meta.url).pathname);
const dist = join(root, '../packages/orchestrator/dist');

async function loadModules() {
  const registryUrl = pathToFileURL(join(dist, 'pipeline/registry-matcher.js')).href;
  const intentUrl = pathToFileURL(join(dist, 'pipeline/command-to-intent.js')).href;
  const { matchRegistryCommand } = await import(registryUrl);
  const { intentFromRegistryMatch } = await import(intentUrl);
  return { matchRegistryCommand, intentFromRegistryMatch };
}

function utterance(text) {
  return {
    id: 'u1',
    rawText: text,
    normalizedText: text.toLowerCase().replace(/\s+/g, ' '),
    timestamp: new Date().toISOString(),
    isEmergencyPhrase: false,
    tokens: text.toLowerCase().split(/\s+/),
    wordCount: text.split(/\s+/).length,
    isEmpty: false,
  };
}

let ok = 0;
let total = 0;

function check(name, fn) {
  total++;
  try {
    fn();
    console.log(`✓ ${name}`);
    ok++;
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
  }
}

const { matchRegistryCommand, intentFromRegistryMatch } = await loadModules();
const mode = 'manual-dictation';

check('undo last phrase maps to undoPhrase', () => {
  const m = matchRegistryCommand('undo last phrase', mode);
  if (!m || m.command.id !== 'editor.phraseUndo') throw new Error(`got ${m?.command.id}`);
  const intent = intentFromRegistryMatch(utterance('undo last phrase'), m);
  if (intent.slots.action !== 'undoPhrase') throw new Error(String(intent.slots.action));
});

check('scratch that maps to undoPhrase', () => {
  const m = matchRegistryCommand('scratch that', mode);
  if (!m) throw new Error('no match');
  const intent = intentFromRegistryMatch(utterance('scratch that'), m);
  if (intent.slots.action !== 'undoPhrase') throw new Error(String(intent.slots.action));
});

check('replace last word applies grammar to replacement', () => {
  const m = matchRegistryCommand('replace last word with profile', mode);
  if (!m || m.command.id !== 'editor.replaceLastWord') throw new Error(`got ${m?.command.id}`);
  const intent = intentFromRegistryMatch(utterance('replace last word with profile'), m);
  if (intent.slots.action !== 'replaceLastWord') throw new Error(String(intent.slots.action));
  if (intent.literalPayload !== 'profile') throw new Error(`payload ${intent.literalPayload}`);
});

check('replace last phrase emits code grammar', () => {
  const text = 'replace last phrase with const user equals null';
  const m = matchRegistryCommand(text, mode);
  if (!m || m.command.id !== 'editor.replaceLastPhrase') throw new Error(`got ${m?.command.id}`);
  const intent = intentFromRegistryMatch(utterance(text), m);
  if (intent.literalPayload !== 'const user = null') throw new Error(`got ${intent.literalPayload}`);
});

check('delete last word maps correctly', () => {
  const m = matchRegistryCommand('delete last word', mode);
  if (!m || m.command.id !== 'editor.deleteLastWord') throw new Error(`got ${m?.command.id}`);
  const intent = intentFromRegistryMatch(utterance('delete last word'), m);
  if (intent.slots.action !== 'deleteLastWord') throw new Error(String(intent.slots.action));
});

check('repeat last phrase maps correctly', () => {
  const m = matchRegistryCommand('repeat last phrase', mode);
  if (!m || m.command.id !== 'editor.repeatLastPhrase') throw new Error(`got ${m?.command.id}`);
  const intent = intentFromRegistryMatch(utterance('repeat last phrase'), m);
  if (intent.slots.action !== 'repeatLastPhrase') throw new Error(String(intent.slots.action));
});

console.log(`\nCorrections: ${ok}/${total} passed`);
process.exit(ok === total ? 0 : 1);
