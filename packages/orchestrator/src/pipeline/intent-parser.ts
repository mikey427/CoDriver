import { v4 as uuidv4 } from 'uuid';
import {
  AdapterType,
  ConfidenceBand,
  IntentType,
  ModeId,
} from '@driftcode/shared';
import type { InternalParsedIntent, InternalUtterance } from '../helpers/factories.js';
import type { ModeManager } from '../modes/mode-manager.js';
import type { Session } from '../session.js';
import { intentFromRegistryMatch } from './command-to-intent.js';
import { matchRegistryCommand } from './registry-matcher.js';

const SYMBOL_PHRASES: Record<string, string> = {
  'open paren': '(',
  'close paren': ')',
  'open bracket': '[',
  'close bracket': ']',
  'open brace': '{',
  'close brace': '}',
  semicolon: ';',
  comma: ',',
  dot: '.',
  'fat arrow': '=>',
  'equals equals': '==',
  'triple equals': '===',
  'new line': '\n',
  space: ' ',
};

const KEYWORD_MAP: Record<string, string> = {
  const: 'const',
  let: 'let',
  function: 'function',
  async: 'async',
  await: 'await',
  return: 'return',
  import: 'import',
  export: 'export',
  type: 'type',
};

const EDITOR_COMMANDS: Record<string, string> = {
  'delete current line': 'deleteLine',
  'undo last phrase': 'undoPhrase',
  undo: 'undo',
  redo: 'redo',
  'select current function': 'selectFunction',
};

function toCamelCase(words: string[]): string {
  if (words.length === 0) return '';
  const [first, ...rest] = words;
  return first.toLowerCase() + rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function findSymbol(tokens: string[], start: number): { len: number; emit: string } | null {
  for (let len = Math.min(3, tokens.length - start); len >= 1; len--) {
    const phrase = tokens.slice(start, start + len).join(' ');
    if (SYMBOL_PHRASES[phrase]) return { len, emit: SYMBOL_PHRASES[phrase] };
  }
  return null;
}

export class IntentParser {
  constructor(
    private session: Session,
    private modeManager: ModeManager,
  ) {}

  parse(utterance: InternalUtterance): InternalParsedIntent {
    const text = utterance.normalizedText;
    const tokens = utterance.tokens;

    if (utterance.isEmergencyPhrase) {
      return this.build(utterance, IntentType.EmergencyStop, 'Emergency stop', AdapterType.Orchestrator, 1, ConfidenceBand.High);
    }

    const registryMatch = matchRegistryCommand(text, this.session.activeModeId);
    if (registryMatch) {
      return intentFromRegistryMatch(utterance, registryMatch);
    }

    if (text === 'resume' || text === 'resume previous mode' || text === 'clear emergency') {
      return this.build(utterance, IntentType.Cancel, 'Clear emergency', AdapterType.Orchestrator, 1, ConfidenceBand.High, {
        action: 'clearEmergency',
      });
    }

    const targetMode = this.modeManager.resolveModeFromPhrase(text);
    if (targetMode) {
      return this.build(utterance, IntentType.ModeSwitch, `Switch to ${targetMode}`, AdapterType.Orchestrator, 0.95, ConfidenceBand.High, {
        modeId: targetMode,
      });
    }

    for (const [phrase, action] of Object.entries(EDITOR_COMMANDS)) {
      if (text === phrase) {
        return this.build(utterance, IntentType.EditorTransform, phrase, AdapterType.Vscode, 0.92, ConfidenceBand.High, { action });
      }
    }

    const casingMatch = text.match(/^(camel case|pascal case|snake case|kebab case) (.+)$/);
    if (casingMatch) {
      const words = casingMatch[2].split(/\s+/);
      let identifier = words.join('');
      if (casingMatch[1] === 'camel case') identifier = toCamelCase(words);
      return this.build(utterance, IntentType.Dictation, `Insert ${identifier}`, AdapterType.Vscode, 0.95, ConfidenceBand.High, {}, identifier);
    }

    const constMatch = text.match(/^const (.+?) equals (.+)$/);
    if (constMatch) {
      const name = toCamelCase(constMatch[1].split(/\s+/));
      const value = this.emitTokens(constMatch[2].split(/\s+/));
      return this.build(utterance, IntentType.Dictation, `const ${name} = ${value}`, AdapterType.Vscode, 0.9, ConfidenceBand.High, {}, `const ${name} = ${value}`);
    }

    const typeMatch = text.match(/^type (.+)$/);
    if (typeMatch) {
      const emitted = this.emitTokens(typeMatch[1].split(/\s+/));
      return this.build(utterance, IntentType.Dictation, `type ${emitted}`, AdapterType.Vscode, 0.88, ConfidenceBand.High, {}, `type ${emitted}`);
    }

    if (tokens.length === 1 && SYMBOL_PHRASES[tokens[0]]) {
      return this.build(utterance, IntentType.SymbolInsert, SYMBOL_PHRASES[tokens[0]], AdapterType.Vscode, 0.95, ConfidenceBand.High, {}, SYMBOL_PHRASES[tokens[0]]);
    }

    if (this.session.activeModeId === ModeId.AiAssist || this.session.activeModeId === ModeId.VibeCoding || this.session.activeModeId === ModeId.Review) {
      const aiTriggers = /^(ask ai |help me |fix this|explain this|add |build |implement |refactor )/;
      if (aiTriggers.test(text)) {
        return {
          ...this.build(utterance, IntentType.AiRequest, text, AdapterType.Ai, 0.85, ConfidenceBand.High, { prompt: text }),
          requiresAiFallback: true,
          routingPath: 'ai',
        };
      }
    }

    if (text === 'apply the fix' || text === 'apply patch') {
      return this.build(utterance, IntentType.EditorTransform, 'Apply pending patch', AdapterType.Vscode, 0.95, ConfidenceBand.High, { action: 'applyPatch' });
    }

    if (text === 'start dev server') {
      return this.build(utterance, IntentType.TerminalRun, 'Start dev server', AdapterType.Terminal, 0.95, ConfidenceBand.High, { devServer: true });
    }

    if (text === 'stop dev server') {
      return this.build(utterance, IntentType.TerminalRun, 'Stop dev server', AdapterType.Terminal, 0.95, ConfidenceBand.High, { devServerStop: true });
    }

    if (text === 'open app' || text === 'open local app') {
      return this.build(utterance, IntentType.BrowserAction, 'Open local app', AdapterType.Browser, 0.95, ConfidenceBand.High, { browserAction: 'browser.open' });
    }

    if (text === 'check console') {
      return this.build(utterance, IntentType.BrowserAction, 'Check console', AdapterType.Browser, 0.92, ConfidenceBand.High, { browserAction: 'browser.readConsole' });
    }

    if (text === 'privacy on' || text === 'enable privacy') {
      return this.build(utterance, IntentType.Cancel, 'Privacy on', AdapterType.Orchestrator, 0.95, ConfidenceBand.High, { privacyOn: true });
    }

    if (text === 'privacy off' || text === 'disable privacy') {
      return this.build(utterance, IntentType.Cancel, 'Privacy off', AdapterType.Orchestrator, 0.95, ConfidenceBand.High, { privacyOff: true });
    }

    if (this.session.activeModeId === ModeId.Terminal && (text.startsWith('run ') || text.startsWith('terminal '))) {
      const commandLine = text.replace(/^(run|terminal)\s+/, '');
      return this.build(utterance, IntentType.TerminalRun, commandLine, AdapterType.Terminal, 0.85, ConfidenceBand.High, { commandLine });
    }

    if (this.session.activeModeId === ModeId.ManualDictation || this.session.activeModeId === ModeId.Command) {
      const emitted = this.emitTokens(tokens);
      if (emitted) {
        return this.build(utterance, IntentType.Dictation, emitted, AdapterType.Vscode, 0.75, ConfidenceBand.Medium, {}, emitted);
      }
    }

    return {
      id: uuidv4(),
      utteranceId: utterance.id,
      intentType: IntentType.Unknown,
      confidence: 0.2,
      confidenceBand: ConfidenceBand.Reject,
      slots: {},
      requiresAiFallback: false,
      routingPath: 'blocked',
      summary: "Didn't catch that",
    };
  }

  private emitTokens(tokens: string[]): string {
    const parts: string[] = [];
    let i = 0;

    const isKeyword = (t: string) => Boolean(KEYWORD_MAP[t]);
    const readIdentifier = (): string => {
      const words: string[] = [];
      while (i < tokens.length) {
        const sym = findSymbol(tokens, i);
        if (sym || isKeyword(tokens[i]) || tokens[i] === 'equals') break;
        words.push(tokens[i]);
        i++;
      }
      return words.length > 1 ? toCamelCase(words) : words[0] ?? '';
    };

    while (i < tokens.length) {
      const sym = findSymbol(tokens, i);
      if (sym) {
        parts.push(sym.emit);
        i += sym.len;
        continue;
      }
      if (tokens[i] === 'equals') {
        parts.push(' = ');
        i++;
        continue;
      }
      if (isKeyword(tokens[i])) {
        parts.push(KEYWORD_MAP[tokens[i]]);
        i++;
        const id = readIdentifier();
        if (id) parts.push(' ', id);
        continue;
      }
      const id = readIdentifier();
      if (id) parts.push(id);
      else i++;
    }

    return parts.join('').replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
  }

  private build(
    utterance: InternalUtterance,
    intentType: IntentType,
    summary: string,
    targetAdapter: AdapterType,
    confidence: number,
    confidenceBand: ConfidenceBand,
    slots: Record<string, unknown> = {},
    literalPayload?: string,
  ): InternalParsedIntent {
    return {
      id: uuidv4(),
      utteranceId: utterance.id,
      intentType,
      commandId: `${targetAdapter}.${intentType}`,
      confidence,
      confidenceBand,
      slots,
      literalPayload,
      targetAdapter,
      requiresAiFallback: false,
      routingPath: 'deterministic',
      summary,
    };
  }
}
