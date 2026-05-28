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
import { emitCodeFromText, emitCodeFromTokens } from './code-grammar/code-emitter.js';
import { SYMBOL_MAP } from './code-grammar/symbol-map.js';
import { intentFromRegistryMatch } from './command-to-intent.js';
import { matchRegistryCommand } from './registry-matcher.js';

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

    if (text === 'preview patch' || text === 'show patch' || text === 'what is the fix') {
      return this.build(utterance, IntentType.EditorTransform, 'Preview pending patch', AdapterType.Orchestrator, 0.95, ConfidenceBand.High, { action: 'previewPatch' });
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

    if (this.session.activeModeId === ModeId.ManualDictation) {
      const emitted = emitCodeFromText(text);
      if (emitted.success && emitted.text) {
        const band = emitted.confidence >= 0.9 ? ConfidenceBand.High : ConfidenceBand.Medium;
        const intentType = tokens.length === 1 && SYMBOL_MAP[tokens[0]] ? IntentType.SymbolInsert : IntentType.Dictation;
        return this.build(utterance, intentType, emitted.text, AdapterType.Vscode, emitted.confidence, band, {}, emitted.text);
      }
    }

    if (this.session.activeModeId === ModeId.Command) {
      return {
        id: uuidv4(),
        utteranceId: utterance.id,
        intentType: IntentType.Unknown,
        confidence: 0.2,
        confidenceBand: ConfidenceBand.Reject,
        slots: {},
        requiresAiFallback: false,
        routingPath: 'blocked',
        summary: "Didn't catch that — switch to manual dictation mode to type code",
      };
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
