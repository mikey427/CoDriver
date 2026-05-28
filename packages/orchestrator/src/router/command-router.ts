import { v4 as uuidv4 } from 'uuid';
import {
  AdapterType,
  IntentType,
  ModeId,
  RuntimeEventSeverity,
  RuntimeSubsystem,
  FocusTarget,
} from '@driftcode/shared';
import type { AiIntentLayer } from '../ai/ai-intent-layer.js';
import type { BrowserAdapter } from '../adapters/browser-adapter.js';
import type { TerminalAdapter } from '../adapters/terminal-adapter.js';
import type { VscodeAdapter } from '../adapters/vscode-adapter.js';
import type { EventBus } from '../event-bus.js';
import type { AuditLog } from '../logging/audit-log.js';
import type { ModeManager } from '../modes/mode-manager.js';
import type { IntentParser } from '../pipeline/intent-parser.js';
import type { UtteranceNormalizer } from '../pipeline/utterance-normalizer.js';
import { RiskClassifier } from '../safety/risk-classifier.js';
import type { ConfirmationManager } from '../safety/confirmation-manager.js';
import type { Session } from '../session.js';
import { createToolRequest, createToolResult, toDashboardIntent } from '../helpers/factories.js';
import type { InternalParsedIntent } from '../helpers/factories.js';
import type { AudioFeedback } from '../services/audio-feedback.js';
import type { DevServerManager } from '../services/dev-server-manager.js';
import type { PatchStore } from '../services/patch-store.js';
import type { ObsAdapter } from '../adapters/obs-adapter.js';
import type { HarnessConfig, DashboardCommandHistoryEntry, ToolRequest, ToolResult, UtteranceResponse } from '@driftcode/shared';
import { AppTestRunner } from '../services/app-test-runner.js';
import { isProtectedPath } from '../services/protected-paths.js';
import { validatePatch } from '../services/patch-validator.js';
import { focusApplication } from '../services/speech-input-service.js';
import { redactSecrets } from '../services/redact-secrets.js';

export class CommandRouter {
  private riskClassifier = new RiskClassifier();
  private appTestRunner: AppTestRunner;

  constructor(
    private session: Session,
    private eventBus: EventBus,
    private modeManager: ModeManager,
    private normalizer: UtteranceNormalizer,
    private parser: IntentParser,
    private confirmations: ConfirmationManager,
    private vscode: VscodeAdapter,
    private terminal: TerminalAdapter,
    private browser: BrowserAdapter,
    private aiLayer: AiIntentLayer,
    private auditLog: AuditLog,
    private patchStore: PatchStore,
    private devServer: DevServerManager,
    private obs: ObsAdapter,
    private audio: AudioFeedback,
    private config: HarnessConfig,
  ) {
    this.appTestRunner = new AppTestRunner(config, browser);
  }

  refreshConfig(config: HarnessConfig): void {
    this.config = config;
    this.appTestRunner = new AppTestRunner(config, this.browser);
  }

  async processUtterance(rawText: string): Promise<UtteranceResponse> {
    this.eventBus.emit('utterance.received', { rawText }, { subsystem: RuntimeSubsystem.Speech });

    const utterance = this.normalizer.normalize(rawText);
    this.session.lastNormalizedUtterance = {
      ...utterance,
      rawText: this.session.streamPrivacyActive ? redactSecrets(utterance.rawText) : utterance.rawText,
      normalizedText: this.session.streamPrivacyActive ? redactSecrets(utterance.normalizedText) : utterance.normalizedText,
    };
    this.eventBus.emit('utterance.normalized', { utterance }, { subsystem: RuntimeSubsystem.Normalizer, utteranceId: utterance.id });

    if (utterance.isEmergencyPhrase) {
      const result = this.activateEmergency('utterance');
      const intent = this.parser.parse(utterance);
      this.session.lastParsedIntent = toDashboardIntent(intent);
      return {
        utterance,
        intent: this.session.lastParsedIntent,
        toolResults: [{ success: result.success, message: result.output }],
        blocked: true,
        message: 'Emergency stop activated — say resume previous mode to continue',
      };
    }

    const intent = this.parser.parse(utterance);
    this.session.lastParsedIntent = toDashboardIntent(intent);
    this.eventBus.emit('intent.parsed', { intent: this.session.lastParsedIntent }, { subsystem: RuntimeSubsystem.Parser, intentId: intent.id });

    if (intent.intentType === IntentType.Unknown && intent.requiresAiFallback) {
      const aiResult = await this.aiLayer.process(utterance, rawText);
      const toolResults: ToolResult[] = [];
      for (const req of aiResult.toolRequests) {
        toolResults.push(await this.dispatch(req, intent));
      }
      if (aiResult.usedAi) {
        this.audio.speakBrief(redactSecrets(aiResult.summary, this.session.streamPrivacyActive));
      }
      if (aiResult.usedAi && this.patchStore.get()) this.audio.beep('confirm');
      return {
        utterance: this.session.lastNormalizedUtterance ?? utterance,
        intent: this.session.lastParsedIntent,
        toolResults: toolResults.map((r) => ({ success: r.success, message: r.output, errorCode: r.errorCode })),
        blocked: false,
        message: redactSecrets(aiResult.summary, this.session.streamPrivacyActive),
      };
    }

    const results = await this.routeIntent(intent);
    const blocked = results.some((r) => r.errorCode === 'BLOCKED' || r.errorCode === 'PENDING_CONFIRMATION');
    if (results.some((r) => r.success)) this.audio.beep('success');
    else if (results.some((r) => !r.success && r.errorCode !== 'PENDING_CONFIRMATION')) this.audio.beep('error');
    this.auditLog.append('utterance', 'processed', { rawText, intentType: intent.intentType, success: !blocked });

    const responseMessage =
      intent.intentType === IntentType.AiRequest
        ? results.find((r) => r.output)?.output
        : undefined;

    if (!blocked && intent.intentType !== IntentType.EmergencyStop) {
      this.session.lastUtteranceForRepeat = rawText;
    }

    return {
      utterance: this.session.lastNormalizedUtterance ?? utterance,
      intent: this.session.lastParsedIntent,
      toolResults: results.map((r) => ({ success: r.success, message: r.output, errorCode: r.errorCode })),
      blocked,
      message: responseMessage,
    };
  }

  async routeIntent(intent: InternalParsedIntent) {
    if (this.session.emergencyStopActive && intent.intentType !== IntentType.Cancel && intent.intentType !== IntentType.EmergencyStop) {
      return [createToolResult({
        toolRequest: createToolRequest({
          sessionId: this.session.sessionId,
          correlationId: uuidv4(),
          adapter: AdapterType.Orchestrator,
          action: intent.intentType,
          parameters: {},
          description: intent.summary,
          sourceId: intent.id,
        }),
        success: false,
        errorCode: 'EMERGENCY_STOP',
        errorMessage: 'Emergency stop active',
      })];
    }

    switch (intent.intentType) {
      case IntentType.EmergencyStop:
        return [this.activateEmergency('intent')];
      case IntentType.Cancel:
        if (intent.slots.action === 'cancelAi') return [this.handleNoop(intent)];
        if (intent.slots.privacyOn) {
          this.session.streamPrivacyActive = true;
          return [createToolResult({ toolRequest: createToolRequest({ sessionId: this.session.sessionId, correlationId: uuidv4(), adapter: AdapterType.Orchestrator, action: 'privacy.on', parameters: {}, description: 'Privacy on', sourceId: intent.id }), success: true, message: 'Privacy mode on' })];
        }
        if (intent.slots.privacyOff) {
          this.session.streamPrivacyActive = false;
          return [createToolResult({ toolRequest: createToolRequest({ sessionId: this.session.sessionId, correlationId: uuidv4(), adapter: AdapterType.Orchestrator, action: 'privacy.off', parameters: {}, description: 'Privacy off', sourceId: intent.id }), success: true, message: 'Privacy mode off' })];
        }
        return [this.clearEmergency()];
      case IntentType.ModeSwitch:
        return [this.handleModeSwitch(intent)];
      case IntentType.Dictation:
      case IntentType.SymbolInsert:
      case IntentType.EditorTransform:
        return [await this.dispatchEditor(intent)];
      case IntentType.TerminalRun:
        return [await this.dispatchTerminal(intent)];
      case IntentType.AiRequest:
        return this.handleAiRequest(intent);
      case IntentType.BrowserAction:
        return [await this.dispatchBrowser(intent)];
      case IntentType.AppTestRun:
        return this.handleAppTestRun(intent);
      case IntentType.ObsAction:
        return [await this.dispatchObs(intent)];
      case IntentType.ConfirmationResponse:
        return [await this.handleConfirmation(intent)];
      case IntentType.AudioControl:
        return [this.handleAudioControl(intent)];
      case IntentType.Noop:
        return [this.handleNoop(intent)];
      case IntentType.FocusChange:
        return [await this.handleFocusChange(intent)];
      default:
        return [createToolResult({
          toolRequest: createToolRequest({
            sessionId: this.session.sessionId,
            correlationId: uuidv4(),
            adapter: AdapterType.Orchestrator,
            action: 'unknown',
            parameters: {},
            description: intent.summary,
            sourceId: intent.id,
          }),
          success: false,
          errorCode: 'UNKNOWN_INTENT',
          errorMessage: intent.summary,
        })];
    }
  }

  activateEmergency(source: string) {
    this.session.activateEmergency();
    this.confirmations.clear();
    this.aiLayer.cancelActive();
    this.audio.stopTts();
    this.audio.beep('emergency');
    this.eventBus.emit('emergency.activated', { source }, { severity: RuntimeEventSeverity.Audit, subsystem: RuntimeSubsystem.Safety });
    this.auditLog.append('safety', 'emergency_stop', { source }, true);
    const req = createToolRequest({
      sessionId: this.session.sessionId,
      correlationId: uuidv4(),
      adapter: AdapterType.Orchestrator,
      action: 'emergency_stop',
      parameters: { source },
      description: 'Emergency stop',
      sourceId: uuidv4(),
    });
    return createToolResult({ toolRequest: req, success: true, message: 'Emergency stop activated' });
  }

  clearEmergency() {
    this.session.clearEmergency();
    this.eventBus.emit('emergency.cleared', {}, { subsystem: RuntimeSubsystem.Safety });
    const req = createToolRequest({
      sessionId: this.session.sessionId,
      correlationId: uuidv4(),
      adapter: AdapterType.Orchestrator,
      action: 'clear_emergency',
      parameters: {},
      description: 'Clear emergency',
      sourceId: uuidv4(),
    });
    return createToolResult({ toolRequest: req, success: true, message: 'Emergency stop cleared' });
  }

  private handleModeSwitch(intent: InternalParsedIntent) {
    const modeId = intent.slots.modeId as ModeId | string;
    const result = this.modeManager.switchMode(modeId);
    if (result.success) this.audio.beep('mode');
    const req = createToolRequest({
      sessionId: this.session.sessionId,
      correlationId: uuidv4(),
      adapter: AdapterType.Orchestrator,
      action: 'mode.switch',
      parameters: { modeId },
      description: `Switch to ${modeId}`,
      sourceId: intent.id,
    });
    return createToolResult({
      toolRequest: req,
      success: result.success,
      message: result.success ? `Switched to ${modeId}` : result.reason,
      errorCode: result.success ? undefined : 'MODE_BLOCKED',
      errorMessage: result.reason,
    });
  }

  private async dispatchEditor(intent: InternalParsedIntent) {
    if (intent.slots.action === 'applyPatch') {
      const patch = this.patchStore.get();
      if (!patch) {
        return createToolResult({
          toolRequest: createToolRequest({ sessionId: this.session.sessionId, correlationId: uuidv4(), adapter: AdapterType.Vscode, action: 'applyPatch', parameters: {}, description: 'Apply patch', sourceId: intent.id }),
          success: false,
          errorCode: 'NO_PATCH',
          errorMessage: 'No pending patch',
        });
      }
      const validation = validatePatch(patch, this.config);
      if (!validation.valid) {
        return createToolResult({
          toolRequest: createToolRequest({ sessionId: this.session.sessionId, correlationId: uuidv4(), adapter: AdapterType.Vscode, action: 'applyPatch', parameters: {}, description: 'Apply patch', sourceId: intent.id }),
          success: false,
          errorCode: validation.errorCode,
          errorMessage: validation.errorMessage,
        });
      }
      if (isProtectedPath(patch.path, this.config.protectedFileGlobs)) {
        return createToolResult({
          toolRequest: createToolRequest({ sessionId: this.session.sessionId, correlationId: uuidv4(), adapter: AdapterType.Vscode, action: 'applyPatch', parameters: {}, description: 'Apply patch', sourceId: intent.id }),
          success: false,
          errorCode: 'PROTECTED_PATH',
          errorMessage: `Protected path: ${patch.path}`,
        });
      }
      const req = createToolRequest({
        sessionId: this.session.sessionId,
        correlationId: uuidv4(),
        adapter: AdapterType.Vscode,
        action: 'applyPatch',
        parameters: { path: patch.path, content: patch.content, oldText: patch.oldText, newText: patch.newText },
        description: patch.summary,
        sourceId: intent.id,
      });
      const result = await this.dispatch(req, intent);
      if (result.success) {
        this.patchStore.clear();
        this.session.pendingPatchSummary = undefined;
        this.audio.speakBrief('Patch applied');
      }
      return result;
    }

    if (intent.slots.action === 'undoPhrase') {
      const hasPhrase = this.session.getLastDictationPhrase() || this.session.dictationHistory.length > 0;
      if (!hasPhrase) {
        return createToolResult({
          toolRequest: createToolRequest({
            sessionId: this.session.sessionId,
            correlationId: uuidv4(),
            adapter: AdapterType.Vscode,
            action: 'undoPhrase',
            parameters: {},
            description: 'Undo phrase',
            sourceId: intent.id,
          }),
          success: false,
          errorCode: 'NOTHING_TO_UNDO',
          errorMessage: 'No dictation phrase to undo',
        });
      }
    }

    if (intent.slots.action === 'replaceLastWord' || intent.slots.action === 'replaceLastPhrase') {
      const req = createToolRequest({
        sessionId: this.session.sessionId,
        correlationId: uuidv4(),
        adapter: AdapterType.Vscode,
        action: String(intent.slots.action),
        parameters: { replacement: intent.slots.replacement ?? intent.literalPayload },
        description: intent.summary,
        sourceId: intent.id,
      });
      const result = await this.dispatch(req, intent);
      if (result.success) {
        const last = this.session.getLastDictationPhrase();
        if (last && intent.literalPayload) last.text = String(intent.literalPayload);
      }
      return result;
    }

    if (intent.slots.action === 'deleteLastWord' || intent.slots.action === 'repeatLastPhrase') {
      const req = createToolRequest({
        sessionId: this.session.sessionId,
        correlationId: uuidv4(),
        adapter: AdapterType.Vscode,
        action: String(intent.slots.action),
        parameters: { ...intent.slots },
        description: intent.summary,
        sourceId: intent.id,
      });
      const result = await this.dispatch(req, intent);
      if (result.success && intent.slots.action === 'repeatLastPhrase') {
        const last = this.session.getLastDictationPhrase();
        if (last) {
          this.session.pushDictationPhrase({
            ...last,
            id: uuidv4(),
            timestamp: new Date().toISOString(),
          });
        }
      }
      if (result.success && intent.slots.action === 'deleteLastWord') {
        const last = this.session.getLastDictationPhrase();
        if (last && result.output) last.text = result.output;
      }
      return result;
    }

    const classification = this.riskClassifier.classify(intent);
    if (classification.blocked) {
      return this.blocked(intent, classification.blockReason ?? 'Blocked');
    }

    const req = createToolRequest({
      sessionId: this.session.sessionId,
      correlationId: uuidv4(),
      adapter: AdapterType.Vscode,
      action: String(intent.slots.action ?? 'insertText'),
      parameters: { ...intent.slots, literalPayload: intent.literalPayload },
      description: intent.summary,
      sourceId: intent.id,
    });
    const result = await this.dispatch(req, intent);
    return result;
  }

  private async dispatchTerminal(intent: InternalParsedIntent) {
    if (intent.slots.devServer) {
      const outcome = await this.devServer.start();
      return createToolResult({
        toolRequest: createToolRequest({ sessionId: this.session.sessionId, correlationId: uuidv4(), adapter: AdapterType.Terminal, action: 'devServer.start', parameters: {}, description: 'Start dev server', sourceId: intent.id }),
        success: outcome.success,
        message: outcome.message,
        errorCode: outcome.success ? undefined : 'DEVSERVER_FAILED',
      });
    }
    if (intent.slots.devServerStop) {
      const outcome = await this.devServer.stop();
      return createToolResult({
        toolRequest: createToolRequest({ sessionId: this.session.sessionId, correlationId: uuidv4(), adapter: AdapterType.Terminal, action: 'devServer.stop', parameters: {}, description: 'Stop dev server', sourceId: intent.id }),
        success: outcome.success,
        message: outcome.message,
      });
    }

    if (intent.slots.terminalKill) {
      return createToolResult({
        toolRequest: createToolRequest({ sessionId: this.session.sessionId, correlationId: uuidv4(), adapter: AdapterType.Terminal, action: 'terminal.kill', parameters: {}, description: 'Cancel terminal', sourceId: intent.id }),
        success: true,
        message: 'Terminal interrupt sent (stub)',
      });
    }

    const commandLine = String(intent.slots.commandLine ?? '');
    if (!commandLine) {
      return createToolResult({
        toolRequest: createToolRequest({ sessionId: this.session.sessionId, correlationId: uuidv4(), adapter: AdapterType.Terminal, action: 'terminal.run', parameters: {}, description: intent.summary, sourceId: intent.id }),
        success: false,
        errorCode: 'NO_COMMAND',
        errorMessage: 'No terminal command specified',
      });
    }

    if (intent.slots.commandLine) {
      const line = String(intent.slots.commandLine);
      const classification = this.riskClassifier.classify(intent, line);
      if (classification.blocked) return this.blocked(intent, classification.blockReason ?? 'Blocked');
      if (classification.confirmationRequired) {
        this.confirmations.queueConfirmation(intent, `Run: ${line}`, classification.riskTier, async () => {
          const req = createToolRequest({
            sessionId: this.session.sessionId,
            correlationId: uuidv4(),
            adapter: AdapterType.Terminal,
            action: 'terminal.run',
            parameters: { commandLine: line },
            description: line,
            sourceId: intent.id,
          });
          return this.dispatch(req, intent);
        });
        return createToolResult({
          toolRequest: createToolRequest({
            sessionId: this.session.sessionId,
            correlationId: uuidv4(),
            adapter: AdapterType.Terminal,
            action: 'terminal.run',
            parameters: { commandLine: line },
            description: line,
            sourceId: intent.id,
          }),
          success: false,
          errorCode: 'PENDING_CONFIRMATION',
          errorMessage: 'Confirmation required — say confirm execute',
        });
      }
    }

    const req = createToolRequest({
      sessionId: this.session.sessionId,
      correlationId: uuidv4(),
      adapter: AdapterType.Terminal,
      action: 'terminal.run',
      parameters: { commandLine },
      description: commandLine,
      sourceId: intent.id,
    });
    return this.dispatch(req, intent);
  }

  private async handleAiRequest(intent: InternalParsedIntent) {
    const utterance = this.session.lastNormalizedUtterance;
    if (!utterance) return [];
    const aiResult = await this.aiLayer.process({ ...utterance, tokens: [], wordCount: 0, isEmpty: false }, String(intent.slots.prompt ?? ''));
    const results: ToolResult[] = [];
    for (const req of aiResult.toolRequests) {
      results.push(await this.dispatch(req, intent));
    }
    if (aiResult.usedAi) this.audio.speakBrief(aiResult.summary);
    return results.length ? results : [createToolResult({
      toolRequest: createToolRequest({
        sessionId: this.session.sessionId,
        correlationId: uuidv4(),
        adapter: AdapterType.Ai,
        action: 'ai.request',
        parameters: { prompt: intent.slots.prompt },
        description: 'AI request',
        sourceId: intent.id,
      }),
      success: aiResult.usedAi,
      message: aiResult.summary,
    })];
  }

  private async dispatchBrowser(intent: InternalParsedIntent) {
    const action = String(intent.slots.browserAction ?? 'browser.open');
    const req = createToolRequest({
      sessionId: this.session.sessionId,
      correlationId: uuidv4(),
      adapter: AdapterType.Browser,
      action,
      parameters: intent.slots,
      description: intent.summary,
      sourceId: intent.id,
    });
    return this.dispatch(req, intent);
  }

  private async handleAppTestRun(intent: InternalParsedIntent) {
    const flowId = String(intent.slots.flowId ?? 'login');
    const results = await this.appTestRunner.runFlow(flowId, this.session.sessionId);
    for (const result of results) {
      this.session.pushToolResult(result);
      this.pushHistory(intent, result);
    }
    return results.length ? results : [createToolResult({
      toolRequest: createToolRequest({
        sessionId: this.session.sessionId,
        correlationId: uuidv4(),
        adapter: AdapterType.Browser,
        action: 'browser.runFlow',
        parameters: { flowId },
        description: intent.summary,
        sourceId: intent.id,
      }),
      success: false,
      errorCode: 'FLOW_EMPTY',
      errorMessage: 'No steps executed',
    })];
  }

  private async dispatchObs(intent: InternalParsedIntent) {
    const action = String(intent.slots.obsAction ?? 'obs.setScene');
    const req = createToolRequest({
      sessionId: this.session.sessionId,
      correlationId: uuidv4(),
      adapter: AdapterType.Obs,
      action,
      parameters: intent.slots,
      description: intent.summary,
      sourceId: intent.id,
    });
    return this.dispatch(req, intent);
  }

  private async handleConfirmation(intent: InternalParsedIntent) {
    if (intent.slots.confirmAction === 'cancel') {
      const cancelled = this.confirmations.cancel();
      return createToolResult({
        toolRequest: createToolRequest({
          sessionId: this.session.sessionId,
          correlationId: uuidv4(),
          adapter: AdapterType.Orchestrator,
          action: 'confirmation.cancel',
          parameters: {},
          description: 'Cancel pending',
          sourceId: intent.id,
        }),
        success: cancelled,
        message: cancelled ? 'Pending action cancelled' : 'Nothing to cancel',
      });
    }

    const action = intent.slots.confirmAction === 'destructive' ? 'destructive' : 'execute';
    const outcome = await this.confirmations.confirm(action);
    if (!outcome.approved || !outcome.result) {
      return createToolResult({
        toolRequest: createToolRequest({
          sessionId: this.session.sessionId,
          correlationId: uuidv4(),
          adapter: AdapterType.Orchestrator,
          action: 'confirmation.execute',
          parameters: {},
          description: 'Confirm execute',
          sourceId: intent.id,
        }),
        success: false,
        errorCode: 'NO_PENDING_CONFIRMATION',
        errorMessage: 'No pending confirmation',
      });
    }
    return outcome.result;
  }

  private handleAudioControl(intent: InternalParsedIntent) {
    if (intent.slots.audioAction === 'stopTts') {
      this.audio.stopTts();
    }
    return createToolResult({
      toolRequest: createToolRequest({
        sessionId: this.session.sessionId,
        correlationId: uuidv4(),
        adapter: AdapterType.Orchestrator,
        action: 'audio.stopTts',
        parameters: {},
        description: 'Stop talking',
        sourceId: intent.id,
      }),
      success: true,
      message: 'Speech output stopped',
    });
  }

  private handleNoop(intent: InternalParsedIntent) {
    if (intent.slots.orchestratorAction === 'getMode') {
      return createToolResult({
        toolRequest: createToolRequest({
          sessionId: this.session.sessionId,
          correlationId: uuidv4(),
          adapter: AdapterType.Orchestrator,
          action: 'mode.status',
          parameters: {},
          description: 'Current mode',
          sourceId: intent.id,
        }),
        success: true,
        message: `Current mode is ${this.session.activeModeDisplayName}`,
      });
    }
    if (intent.slots.orchestratorAction === 'repeatLastCommand') {
      const last = this.session.lastUtteranceForRepeat;
      if (!last) {
        return createToolResult({
          toolRequest: createToolRequest({
            sessionId: this.session.sessionId,
            correlationId: uuidv4(),
            adapter: AdapterType.Orchestrator,
            action: 'repeat.last',
            parameters: {},
            description: 'Repeat last',
            sourceId: intent.id,
          }),
          success: false,
          errorCode: 'NOTHING_TO_REPEAT',
          errorMessage: 'No prior utterance to repeat',
        });
      }
      return createToolResult({
        toolRequest: createToolRequest({
          sessionId: this.session.sessionId,
          correlationId: uuidv4(),
          adapter: AdapterType.Orchestrator,
          action: 'repeat.last',
          parameters: { utterance: last },
          description: `Repeat: ${last}`,
          sourceId: intent.id,
        }),
        success: true,
        message: `Repeated: ${last}`,
      });
    }
    if (intent.slots.action === 'cancelAi') {
      this.aiLayer.cancelActive();
      return createToolResult({
        toolRequest: createToolRequest({
          sessionId: this.session.sessionId,
          correlationId: uuidv4(),
          adapter: AdapterType.Orchestrator,
          action: 'ai.cancel',
          parameters: {},
          description: 'Cancel AI',
          sourceId: intent.id,
        }),
        success: true,
        message: 'AI task cancelled',
      });
    }
    return createToolResult({
      toolRequest: createToolRequest({
        sessionId: this.session.sessionId,
        correlationId: uuidv4(),
        adapter: AdapterType.Orchestrator,
        action: 'noop',
        parameters: {},
        description: intent.summary,
        sourceId: intent.id,
      }),
      success: true,
      message: intent.summary,
    });
  }

  private async handleFocusChange(intent: InternalParsedIntent) {
    const target = String(intent.slots.focusTarget ?? FocusTarget.Vscode);
    this.session.focusTarget = target;
    const outcome = await focusApplication(target);
    return createToolResult({
      toolRequest: createToolRequest({
        sessionId: this.session.sessionId,
        correlationId: uuidv4(),
        adapter: AdapterType.Orchestrator,
        action: 'focus.change',
        parameters: { focusTarget: target },
        description: intent.summary,
        sourceId: intent.id,
      }),
      success: outcome.success,
      message: outcome.message,
    });
  }

  private async dispatch(request: ToolRequest, intent: InternalParsedIntent) {
    this.eventBus.emit('tool.requested', { action: request.action, adapter: request.adapter }, { subsystem: RuntimeSubsystem.Router, intentId: intent.id });

    let result;
    switch (request.adapter) {
      case AdapterType.Vscode:
        result = await this.vscode.execute(request);
        break;
      case AdapterType.Terminal:
        result = await this.terminal.execute(request);
        break;
      case AdapterType.Browser:
        result = await this.browser.executeToolRequest(request);
        break;
      case AdapterType.Obs:
        result = await this.obs.execute(request);
        break;
      default:
        result = createToolResult({ toolRequest: request, success: false, errorCode: 'UNSUPPORTED_ADAPTER', errorMessage: `Unsupported adapter ${request.adapter}` });
    }

    this.session.pushToolResult(result);
    if (result.success && intent.routingPath === 'deterministic') {
      this.session.deterministicCommandStreak += 1;
    } else if (!result.success) {
      this.session.deterministicCommandStreak = 0;
    }

    const historyEntry: DashboardCommandHistoryEntry = {
      id: result.id,
      timestamp: result.completedAt,
      routingPath: intent.routingPath,
      summary: intent.summary,
      success: result.success,
      latencyMs: result.durationMs,
      modeId: this.session.activeModeId,
      aiInvoked: intent.intentType === IntentType.AiRequest || intent.routingPath === 'ai',
    };
    this.session.pushCommandHistory(historyEntry);

    this.eventBus.emit('tool.completed', { success: result.success, action: request.action }, { subsystem: RuntimeSubsystem.Router, success: result.success });
    return result;
  }

  private pushHistory(intent: InternalParsedIntent, result: ReturnType<typeof createToolResult>) {
    const historyEntry: DashboardCommandHistoryEntry = {
      id: result.id,
      timestamp: result.completedAt,
      routingPath: intent.routingPath,
      summary: intent.summary,
      success: result.success,
      latencyMs: result.durationMs,
      modeId: this.session.activeModeId,
      aiInvoked: intent.intentType === IntentType.AiRequest || intent.routingPath === 'ai',
    };
    this.session.pushCommandHistory(historyEntry);
  }

  private blocked(intent: InternalParsedIntent, reason: string) {
    this.eventBus.emit('tool.blocked', { reason, intentId: intent.id }, { severity: RuntimeEventSeverity.Warn, subsystem: RuntimeSubsystem.Safety });
    return createToolResult({
      toolRequest: createToolRequest({
        sessionId: this.session.sessionId,
        correlationId: uuidv4(),
        adapter: intent.targetAdapter ?? AdapterType.Orchestrator,
        action: intent.commandId ?? intent.intentType,
        parameters: intent.slots,
        description: intent.summary,
        sourceId: intent.id,
      }),
      success: false,
      errorCode: 'BLOCKED',
      errorMessage: reason,
    });
  }
}
