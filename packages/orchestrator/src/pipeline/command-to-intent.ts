import { v4 as uuidv4 } from 'uuid';
import {
  AdapterType,
  ConfidenceBand,
  IntentType,
  ModeId,
  VoiceCommandCategory,
} from '@driftcode/shared';
import type { VoiceCommand } from '@driftcode/shared';
import type { InternalParsedIntent, InternalUtterance } from '../helpers/factories.js';
import type { RegistryMatch } from './registry-matcher.js';
import { emitDictationSlot } from './code-grammar/code-emitter.js';

const TRANSFORM_ACTIONS: Record<string, string> = {
  'editor.deleteLine': 'deleteLine',
  'editor.duplicateLine': 'duplicateLine',
  'editor.moveLineUp': 'moveLineUp',
  'editor.moveLineDown': 'moveLineDown',
  'editor.commentLine': 'commentLine',
  'editor.wrapInIf': 'wrapInIf',
  'editor.formatDocument': 'formatDocument',
};

const SELECT_ACTIONS: Record<string, string> = {
  'editor.selectFunction': 'selectFunction',
  'editor.selectWord': 'selectWord',
  'editor.selectLine': 'selectLine',
};

const TERMINAL_COMMANDS: Record<string, string> = {
  'terminal.runDevServer': '__dev_server__',
  'terminal.runTests': 'npm test',
  'terminal.runLint': 'npm run lint',
  'terminal.gitStatus': 'git status',
};

const MODE_ALIASES: Record<string, ModeId> = {
  command: ModeId.Command,
  'command-mode': ModeId.Command,
  manual: ModeId.ManualDictation,
  dictation: ModeId.ManualDictation,
  'manual-dictation': ModeId.ManualDictation,
  'manual-dictation-mode': ModeId.ManualDictation,
  ai: ModeId.AiAssist,
  'ai-assist': ModeId.AiAssist,
  'ai-assist-mode': ModeId.AiAssist,
  vibe: ModeId.VibeCoding,
  'vibe-coding': ModeId.VibeCoding,
  research: ModeId.Research,
  browser: ModeId.Browser,
  'app-testing': ModeId.AppTesting,
  review: ModeId.Review,
  terminal: ModeId.Terminal,
  'stream-control': ModeId.StreamControl,
  'emergency-safe': ModeId.EmergencySafe,
};

function normalizeModeId(raw: string): ModeId | string {
  const key = raw.toLowerCase().trim().replace(/\s+/g, '-').replace(/-mode$/, '');
  if (MODE_ALIASES[key]) return MODE_ALIASES[key];
  const withMode = `${key}-mode`;
  if (MODE_ALIASES[withMode]) return MODE_ALIASES[withMode];
  if (Object.values(ModeId).includes(key as ModeId)) return key;
  return raw;
}

function baseIntent(
  utterance: InternalUtterance,
  intentType: IntentType,
  summary: string,
  targetAdapter: AdapterType,
  confidence: number,
  slots: Record<string, unknown>,
  commandId: string,
  literalPayload?: string,
): InternalParsedIntent {
  return {
    id: uuidv4(),
    utteranceId: utterance.id,
    intentType,
    commandId,
    confidence,
    confidenceBand: confidence >= 0.9 ? ConfidenceBand.High : ConfidenceBand.Medium,
    slots,
    literalPayload,
    targetAdapter,
    requiresAiFallback: false,
    routingPath: 'deterministic',
    summary,
  };
}

/** Convert a registry match into a parsed intent for the command router. */
export function intentFromRegistryMatch(
  utterance: InternalUtterance,
  match: RegistryMatch,
): InternalParsedIntent {
  const { command, slots, confidence } = match;
  const action = command.adapterAction;
  const registrySlots = { ...slots, registryCommandId: command.id, adapterAction: action };

  if (action === 'emergency_stop') {
    return baseIntent(utterance, IntentType.EmergencyStop, command.displayName, AdapterType.Orchestrator, confidence, registrySlots, command.id);
  }

  if (action === 'switch_mode') {
    const modeId = normalizeModeId(slots.modeId ?? utterance.normalizedText);
    return baseIntent(utterance, IntentType.ModeSwitch, `Switch to ${modeId}`, AdapterType.Orchestrator, confidence, { ...registrySlots, modeId }, command.id);
  }

  if (action === 'resume_previous_mode') {
    return baseIntent(utterance, IntentType.Cancel, 'Resume previous mode', AdapterType.Orchestrator, confidence, { ...registrySlots, action: 'clearEmergency' }, command.id);
  }

  if (action === 'cancel_pending') {
    return baseIntent(utterance, IntentType.ConfirmationResponse, 'Cancel pending', AdapterType.Orchestrator, confidence, { ...registrySlots, confirmAction: 'cancel' }, command.id);
  }

  if (action === 'confirm') {
    const confirmAction = command.id.includes('destructive') ? 'destructive' : command.id.includes('apply') ? 'apply' : 'execute';
    return baseIntent(utterance, IntentType.ConfirmationResponse, command.displayName, AdapterType.Orchestrator, confidence, { ...registrySlots, confirmAction }, command.id);
  }

  if (action === 'set_focus') {
    const focusTarget = command.id.includes('browser') ? 'browser' : command.id.includes('terminal') ? 'terminal' : 'vscode';
    return baseIntent(utterance, IntentType.FocusChange, command.displayName, AdapterType.Orchestrator, confidence, { ...registrySlots, focusTarget }, command.id);
  }

  if (action === 'status') {
    return baseIntent(utterance, IntentType.Noop, command.displayName, AdapterType.Orchestrator, confidence, { ...registrySlots, orchestratorAction: command.id.includes('whatMode') ? 'getMode' : 'status' }, command.id);
  }

  if (action === 'getMode') {
    return baseIntent(utterance, IntentType.Noop, 'Current mode query', AdapterType.Orchestrator, confidence, { ...registrySlots, orchestratorAction: 'getMode' }, command.id);
  }

  if (action === 'set_privacy') {
    const on = command.id.includes('on') || utterance.normalizedText.includes(' on') || utterance.normalizedText.endsWith(' on');
    return baseIntent(utterance, IntentType.Cancel, on ? 'Privacy on' : 'Privacy off', AdapterType.Orchestrator, confidence, { ...registrySlots, ...(on ? { privacyOn: true } : { privacyOff: true }) }, command.id);
  }

  if (action === 'stop_tts' || action === 'mute_stream_narration') {
    return baseIntent(utterance, IntentType.AudioControl, command.displayName, AdapterType.Orchestrator, confidence, { ...registrySlots, audioAction: 'stopTts' }, command.id);
  }

  if (action === 'set_overlay_layout' || action === 'set_verbosity') {
    return baseIntent(utterance, IntentType.Noop, command.displayName, AdapterType.Orchestrator, confidence, { ...registrySlots, orchestratorAction: action }, command.id);
  }

  if (action === 'repeat_last') {
    return baseIntent(utterance, IntentType.Noop, command.displayName, AdapterType.Orchestrator, confidence, { ...registrySlots, orchestratorAction: 'repeatLastCommand' }, command.id);
  }

  if (action === 'create_ai_task') {
    return {
      ...baseIntent(utterance, IntentType.AiRequest, command.displayName, AdapterType.Ai, confidence, { ...registrySlots, prompt: utterance.rawText }, command.id),
      requiresAiFallback: true,
      routingPath: 'ai',
    };
  }

  if (action === 'cancel_ai_task') {
    return baseIntent(utterance, IntentType.Cancel, 'Cancel AI task', AdapterType.Orchestrator, confidence, { ...registrySlots, action: 'cancelAi' }, command.id);
  }

  if (action === 'phraseUndo') {
    return baseIntent(utterance, IntentType.EditorTransform, command.displayName, AdapterType.Vscode, confidence, { ...registrySlots, action: 'undoPhrase' }, command.id);
  }

  if (action === 'replaceLastWord') {
    const raw = slots.text ?? '';
    const emitted = emitDictationSlot(raw);
    return baseIntent(
      utterance,
      IntentType.EditorTransform,
      command.displayName,
      AdapterType.Vscode,
      confidence,
      { ...registrySlots, action: 'replaceLastWord', replacement: emitted.success ? emitted.text : raw },
      command.id,
      emitted.success ? emitted.text : raw,
    );
  }

  if (action === 'replaceLastPhrase') {
    const raw = slots.text ?? '';
    const emitted = emitDictationSlot(raw);
    return baseIntent(
      utterance,
      IntentType.EditorTransform,
      command.displayName,
      AdapterType.Vscode,
      confidence,
      { ...registrySlots, action: 'replaceLastPhrase', replacement: emitted.success ? emitted.text : raw },
      command.id,
      emitted.success ? emitted.text : raw,
    );
  }

  if (action === 'deleteLastWord') {
    return baseIntent(utterance, IntentType.EditorTransform, command.displayName, AdapterType.Vscode, confidence, { ...registrySlots, action: 'deleteLastWord' }, command.id);
  }

  if (action === 'repeatLastPhrase') {
    return baseIntent(utterance, IntentType.EditorTransform, command.displayName, AdapterType.Vscode, confidence, { ...registrySlots, action: 'repeatLastPhrase' }, command.id);
  }

  if (action === 'undo' || action === 'redo' || action === 'save') {
    return baseIntent(utterance, IntentType.EditorTransform, command.displayName, AdapterType.Vscode, confidence, { ...registrySlots, action }, command.id);
  }

  if (action === 'applyPatch') {
    return baseIntent(utterance, IntentType.EditorTransform, command.displayName, AdapterType.Vscode, confidence, { ...registrySlots, action: 'applyPatch' }, command.id);
  }

  if (action === 'select') {
    const editorAction = SELECT_ACTIONS[command.id] ?? 'selectFunction';
    return baseIntent(utterance, IntentType.EditorTransform, command.displayName, AdapterType.Vscode, confidence, { ...registrySlots, action: editorAction }, command.id);
  }

  if (action === 'transform' || action === 'runVsCodeCommand') {
    const editorAction = TRANSFORM_ACTIONS[command.id] ?? command.id.split('.').pop() ?? 'transform';
    return baseIntent(utterance, IntentType.EditorTransform, command.displayName, AdapterType.Vscode, confidence, { ...registrySlots, action: editorAction }, command.id);
  }

  if (action === 'navigate' && command.targetAdapter === AdapterType.Vscode) {
    const navSlots: Record<string, unknown> = { ...registrySlots, action: 'navigate' };
    if (slots.filePath) navSlots.file = slots.filePath;
    if (slots.count) navSlots.line = Number.parseInt(slots.count, 10);
    if (slots.symbolName) navSlots.symbol = slots.symbolName;
    return baseIntent(utterance, IntentType.EditorTransform, command.displayName, AdapterType.Vscode, confidence, navSlots, command.id);
  }

  if (action === 'insertText') {
    const raw = slots.text ?? slots.symbol ?? utterance.normalizedText;
    const emitted = emitDictationSlot(raw);
    const text = emitted.success ? emitted.text : raw;
    return baseIntent(utterance, IntentType.Dictation, `Insert ${text}`, AdapterType.Vscode, emitted.success ? emitted.confidence : confidence, registrySlots, command.id, text);
  }

  if (action === 'run_command' || action === 'kill_process') {
    const terminalSlots: Record<string, unknown> = { ...registrySlots };
    if (TERMINAL_COMMANDS[command.id] === '__dev_server__') {
      terminalSlots.devServer = true;
    } else if (TERMINAL_COMMANDS[command.id]) {
      terminalSlots.commandLine = TERMINAL_COMMANDS[command.id];
    } else if (slots.scriptName) {
      terminalSlots.commandLine = `npm run ${slots.scriptName}`;
    } else if (action === 'kill_process') {
      terminalSlots.terminalKill = true;
    }
    return baseIntent(utterance, IntentType.TerminalRun, command.displayName, AdapterType.Terminal, confidence, terminalSlots, command.id);
  }

  if (command.targetAdapter === AdapterType.Browser) {
    const browserSlots: Record<string, unknown> = { ...registrySlots };
    if (command.id === 'browser.openLocalhost') browserSlots.browserAction = 'browser.open';
    else if (command.id === 'browser.goBack') browserSlots.browserAction = 'browser.back';
    else if (action === 'get_console') browserSlots.browserAction = 'browser.readConsole';
    else if (action === 'run_flow_step') browserSlots.browserAction = 'browser.runFlow';
    else if (action === 'click') browserSlots.browserAction = 'browser.click';
    else if (action === 'fill') browserSlots.browserAction = 'browser.fill';
    else if (action === 'navigate') browserSlots.browserAction = 'browser.navigate';
    if (slots.url) browserSlots.url = slots.url;
    if (slots.flowId) browserSlots.flowId = slots.flowId;
    if (slots.target) browserSlots.target = slots.target;
    if (slots.value) browserSlots.value = slots.value;
    const intentType = action === 'run_flow_step' ? IntentType.AppTestRun : IntentType.BrowserAction;
    return baseIntent(utterance, intentType, command.displayName, AdapterType.Browser, confidence, browserSlots, command.id);
  }

  if (command.targetAdapter === AdapterType.Obs) {
    const obsSlots: Record<string, unknown> = { ...registrySlots };
    if (action === 'set_scene') obsSlots.obsAction = 'obs.setScene';
    else if (action === 'toggle_source') obsSlots.obsAction = 'obs.toggleSource';
    else obsSlots.obsAction = action;
    if (slots.sceneName) obsSlots.sceneName = slots.sceneName;
    return baseIntent(utterance, IntentType.ObsAction, command.displayName, AdapterType.Obs, confidence, obsSlots, command.id);
  }

  if (command.category === VoiceCommandCategory.Dictation) {
    return baseIntent(utterance, IntentType.Dictation, command.displayName, AdapterType.Vscode, confidence, registrySlots, command.id, slots.text);
  }

  return baseIntent(utterance, IntentType.Unknown, command.displayName, command.targetAdapter, confidence, registrySlots, command.id);
}
