#!/usr/bin/env node
/**
 * Audit built-in voice command registry vs orchestrator intent mapping.
 * Run after `npm run build`.
 */

import { BUILTIN_VOICE_COMMANDS } from '../packages/shared/dist/constants/commands.js';
import { matchRegistryCommand } from '../packages/orchestrator/dist/pipeline/registry-matcher.js';

/** adapterAction values handled in command-to-intent.ts */
const HANDLED_ADAPTER_ACTIONS = new Set([
  'emergency_stop',
  'switch_mode',
  'resume_previous_mode',
  'cancel_pending',
  'confirm',
  'set_focus',
  'status',
  'getMode',
  'set_privacy',
  'stop_tts',
  'create_ai_task',
  'cancel_ai_task',
  'phraseUndo',
  'undo',
  'redo',
  'save',
  'applyPatch',
  'previewPatch',
  'select',
  'transform',
  'runVsCodeCommand',
  'navigate',
  'insertText',
  'run_command',
  'kill_process',
  'get_console',
  'run_flow_step',
  'click',
  'fill',
  'set_scene',
  'toggle_source',
  'set_overlay_layout',
  'repeat_last',
  'set_verbosity',
  'replaceLastWord',
  'replaceLastPhrase',
  'deleteLastWord',
  'repeatLastPhrase',
  'mute_stream_narration',
]);

/** Parser hardcoded phrases that overlap registry (informational). */
const PARSER_HARDCODED = [
  'resume previous mode',
  'apply the fix',
  'apply patch',
  'emergency stop',
  'switch command mode',
  'delete current line',
];

let issues = 0;

console.log('Registry audit\n');

const unhandled = BUILTIN_VOICE_COMMANDS.filter((c) => !HANDLED_ADAPTER_ACTIONS.has(c.adapterAction));
if (unhandled.length) {
  issues += unhandled.length;
  console.log(`⚠ ${unhandled.length} command(s) with unmapped adapterAction:`);
  for (const c of unhandled) {
    console.log(`  - ${c.id} → ${c.adapterAction}`);
  }
} else {
  console.log('✓ All adapterAction values have intent mappers');
}

const noExamples = BUILTIN_VOICE_COMMANDS.filter((c) => !c.examples?.length && c.enabled);
if (noExamples.length) {
  console.log(`\nℹ ${noExamples.length} enabled command(s) without examples (not a failure)`);
}

const exampleFailures = [];
for (const command of BUILTIN_VOICE_COMMANDS) {
  if (!command.examples?.length) continue;
  for (const example of command.examples) {
    const modeId = command.allowedModeIds[0] ?? 'manual-dictation';
    const match = matchRegistryCommand(example, modeId);
    if (!match || match.command.id !== command.id) {
      exampleFailures.push({ commandId: command.id, example, modeId, matched: match?.command.id });
    }
  }
}

if (exampleFailures.length) {
  issues += exampleFailures.length;
  console.log(`\n⚠ ${exampleFailures.length} registry example(s) failed to match:`);
  for (const f of exampleFailures.slice(0, 15)) {
    console.log(`  - ${f.commandId}: "${f.example}" in ${f.modeId} → ${f.matched ?? 'no match'}`);
  }
  if (exampleFailures.length > 15) console.log(`  … and ${exampleFailures.length - 15} more`);
} else {
  console.log('✓ All registry examples match in their primary mode');
}

console.log('\nℹ Parser hardcoded overlaps (duplicate paths, not necessarily bugs):');
for (const phrase of PARSER_HARDCODED) {
  const match = matchRegistryCommand(phrase, 'command');
  console.log(`  "${phrase}" → registry: ${match?.command.id ?? 'none'}`);
}

console.log(`\nAudit: ${issues === 0 ? 'PASS' : `${issues} issue(s)`}`);
process.exit(issues === 0 ? 0 : 1);
