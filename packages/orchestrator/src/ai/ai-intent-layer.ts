import { v4 as uuidv4 } from 'uuid';
import {
  AdapterType,
  AiTaskStatus,
  AiTaskType,
  ModeId,
  RuntimeSubsystem,
  ToolRequestSource,
} from '@driftcode/shared';
import type { HarnessConfig, ToolRequest } from '@driftcode/shared';
import type { EventBus } from '../event-bus.js';
import type { Session } from '../session.js';
import type { CostTracker } from './cost-tracker.js';
import { createToolRequest } from '../helpers/factories.js';
import type { InternalUtterance } from '../helpers/factories.js';
import type { VscodeAdapter } from '../adapters/vscode-adapter.js';
import type { PatchStore } from '../services/patch-store.js';
import { validatePatch } from '../services/patch-validator.js';
import type { AiProvider } from './ai-provider.js';
import { FakeAiProvider } from './fake-ai-provider.js';
import { OpenAiProvider } from './openai-ai-provider.js';
import type pino from 'pino';

const AI_MODES = new Set<ModeId | string>([
  ModeId.AiAssist,
  ModeId.VibeCoding,
  ModeId.Research,
  ModeId.AppTesting,
  ModeId.Review,
]);

function resolveProviderId(config: HarnessConfig): string {
  if (process.env.DRIFTCODE_AI_PROVIDER === 'fake') return 'fake';
  return config.aiProviderId ?? 'openai';
}

export class AiIntentLayer {
  private openAi = new OpenAiProvider();
  private fake = new FakeAiProvider();
  private generation = 0;
  private abortController: AbortController | null = null;

  constructor(
    private config: HarnessConfig,
    private session: Session,
    private eventBus: EventBus,
    private costTracker: CostTracker,
    private log: pino.Logger,
    private vscode: VscodeAdapter,
    private patchStore: PatchStore,
  ) {}

  async initialize(): Promise<void> {
    if (resolveProviderId(this.config) === 'openai') {
      const ok = await this.openAi.ensureClient(this.config);
      if (!ok && this.config.openAiApiKey) {
        this.log.warn('openai optional peer not installed — OpenAI AI layer disabled');
      }
    }
  }

  updateConfig(config: HarnessConfig): void {
    this.config = config;
    this.openAi.resetClient();
    void this.initialize();
  }

  getProviderId(): string {
    return resolveProviderId(this.config);
  }

  private getProvider(): AiProvider | null {
    const id = resolveProviderId(this.config);
    if (id === 'fake') return this.fake;
    if (id === 'openai' && this.openAi.isAvailable(this.config)) return this.openAi;
    return null;
  }

  isEnabledForMode(modeId: ModeId | string): boolean {
    if (!AI_MODES.has(modeId)) return false;
    return this.getProvider() != null;
  }

  cancelActive(): void {
    this.generation += 1;
    this.abortController?.abort();
    this.abortController = null;
    this.session.activeAiTask = undefined;
  }

  async process(utterance: InternalUtterance, prompt: string): Promise<{ toolRequests: ToolRequest[]; summary: string; usedAi: boolean }> {
    const provider = this.getProvider();
    if (!this.isEnabledForMode(this.session.activeModeId) || !provider || this.session.emergencyStopActive) {
      return { toolRequests: [], summary: 'AI not available', usedAi: false };
    }

    const budget = this.config.sessionCostBudgetUsd ?? Infinity;
    if (this.session.sessionCostUsd >= budget) {
      return { toolRequests: [], summary: 'Session AI budget exceeded', usedAi: false };
    }

    const callGeneration = this.generation;
    this.abortController?.abort();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.session.activeAiTask = {
      summary: prompt.slice(0, 80),
      taskType: AiTaskType.CodeAssist,
      status: AiTaskStatus.Running,
    };

    let editorContext = '';
    const ctxResult = await this.vscode.getSelectionContext();
    if (ctxResult.success && ctxResult.context) {
      editorContext = ctxResult.context;
    }

    if (callGeneration !== this.generation || this.session.emergencyStopActive) {
      this.session.activeAiTask = undefined;
      return { toolRequests: [], summary: 'AI cancelled', usedAi: false };
    }

    try {
      const result = await provider.complete({
        prompt,
        editorContext,
        config: this.config,
        signal,
      });

      if (callGeneration !== this.generation || this.session.emergencyStopActive || signal.aborted) {
        this.session.activeAiTask = undefined;
        return { toolRequests: [], summary: 'AI cancelled', usedAi: false };
      }

      if (result.usage) {
        const usage = this.costTracker.record({
          sessionId: this.session.sessionId,
          profileId: this.session.activeProfileId,
          model: provider.id === 'fake' ? 'fake-ai' : this.config.openAiModel,
          inputTokens: result.usage.promptTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
          modeId: this.session.activeModeId,
          utteranceId: utterance.id,
        });
        this.session.sessionCostUsd += usage.costUsd;
        this.session.aiCallsThisSession += 1;
        this.eventBus.emit('ai.usage', { costUsd: usage.costUsd, model: usage.model }, { subsystem: RuntimeSubsystem.Ai });
      }

      const correlationId = uuidv4();
      const toolRequests: ToolRequest[] = [];

      if (result.patch) {
        const validation = validatePatch(result.patch, this.config);
        if (!validation.valid) {
          this.session.activeAiTask = undefined;
          this.log.warn({ error: validation.errorCode, path: result.patch.path }, 'Rejected invalid AI patch');
          return {
            toolRequests: [],
            summary: validation.errorMessage ?? 'Invalid patch rejected',
            usedAi: true,
          };
        }
        this.patchStore.set({
          summary: result.summary,
          path: result.patch.path,
          content: result.patch.content,
          oldText: result.patch.oldText,
          newText: result.patch.newText,
        });
        this.session.pendingPatchSummary = result.summary;
      }

      for (const tr of result.toolRequests ?? []) {
        toolRequests.push(
          createToolRequest({
            sessionId: this.session.sessionId,
            correlationId,
            adapter:
              tr.adapter === 'terminal'
                ? AdapterType.Terminal
                : tr.adapter === 'browser'
                  ? AdapterType.Browser
                  : AdapterType.Vscode,
            action: tr.action,
            parameters: tr.params ?? {},
            description: tr.action,
            sourceId: utterance.id,
            source: ToolRequestSource.AiTask,
          }),
        );
      }

      this.session.activeAiTask = {
        summary: result.summary,
        taskType: AiTaskType.CodeAssist,
        status: AiTaskStatus.Completed,
      };

      const summary = result.summary ?? (this.patchStore.get() ? 'Patch ready. Say apply the fix.' : 'AI response ready');
      return { toolRequests, summary, usedAi: true };
    } catch (err) {
      if (callGeneration !== this.generation || signal.aborted) {
        this.session.activeAiTask = undefined;
        return { toolRequests: [], summary: 'AI cancelled', usedAi: false };
      }
      this.session.activeAiTask = undefined;
      return { toolRequests: [], summary: err instanceof Error ? err.message : 'AI failed', usedAi: false };
    }
  }
}
