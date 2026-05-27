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
import type { InternalUtterance } from '../helpers/factories.js';
import { createToolRequest } from '../helpers/factories.js';
import type { VscodeAdapter } from '../adapters/vscode-adapter.js';
import type { PatchStore } from '../services/patch-store.js';
import type pino from 'pino';

const AI_MODES = new Set<ModeId | string>([
  ModeId.AiAssist,
  ModeId.VibeCoding,
  ModeId.Research,
  ModeId.AppTesting,
  ModeId.Review,
]);

interface AiPatchResponse {
  summary?: string;
  path?: string;
  content?: string;
  oldText?: string;
  newText?: string;
  toolRequests?: Array<{ adapter: string; action: string; params?: Record<string, unknown> }>;
}

export class AiIntentLayer {
  private client: { chat: { completions: { create: (args: unknown) => Promise<unknown> } } } | null = null;

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
    if (!this.config.openAiApiKey) return;
    try {
      const mod = await import('openai');
      this.client = new mod.default({ apiKey: this.config.openAiApiKey }) as typeof this.client;
    } catch {
      this.log.warn('openai optional peer not installed — AI layer disabled');
    }
  }

  isEnabledForMode(modeId: ModeId | string): boolean {
    return AI_MODES.has(modeId) && this.client != null;
  }

  cancelActive(): void {
    this.session.activeAiTask = undefined;
  }

  async process(utterance: InternalUtterance, prompt: string): Promise<{ toolRequests: ToolRequest[]; summary: string; usedAi: boolean }> {
    if (!this.isEnabledForMode(this.session.activeModeId) || !this.client || this.session.emergencyStopActive) {
      return { toolRequests: [], summary: 'AI not available', usedAi: false };
    }

    const budget = this.config.sessionCostBudgetUsd ?? Infinity;
    if (this.session.sessionCostUsd >= budget) {
      return { toolRequests: [], summary: 'Session AI budget exceeded', usedAi: false };
    }

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

    try {
      const response = (await this.client.chat.completions.create({
        model: this.config.openAiModel,
        messages: [
          {
            role: 'system',
            content: `You are a coding assistant for DriftCode Harness. Respond ONLY with JSON:
{
  "summary": "brief status for voice feedback (max 12 words)",
  "path": "relative file path if patching",
  "oldText": "exact text to replace (optional)",
  "newText": "replacement text (optional)",
  "content": "full file content (only for new/small files)",
  "toolRequests": [{ "adapter": "terminal|browser", "action": "...", "params": {} }]
}
Never include secrets. Prefer oldText/newText patches over full content.`,
          },
          {
            role: 'user',
            content: `Request: ${prompt}\n\nEditor context:\n${editorContext.slice(0, 6000)}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 800,
      })) as { choices: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };

      const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as AiPatchResponse;

      if (response.usage) {
        const usage = this.costTracker.record({
          sessionId: this.session.sessionId,
          profileId: this.session.activeProfileId,
          model: this.config.openAiModel,
          inputTokens: response.usage.prompt_tokens ?? 0,
          outputTokens: response.usage.completion_tokens ?? 0,
          totalTokens: response.usage.total_tokens ?? 0,
          modeId: this.session.activeModeId,
          utteranceId: utterance.id,
        });
        this.session.sessionCostUsd += usage.costUsd;
        this.session.aiCallsThisSession += 1;
        this.eventBus.emit('ai.usage', { costUsd: usage.costUsd, model: usage.model }, { subsystem: RuntimeSubsystem.Ai });
      }

      const correlationId = uuidv4();
      const toolRequests: ToolRequest[] = [];

      if (parsed.path && (parsed.content != null || (parsed.oldText != null && parsed.newText != null))) {
        this.patchStore.set({
          summary: parsed.summary ?? 'Patch ready',
          path: parsed.path,
          content: parsed.content,
          oldText: parsed.oldText,
          newText: parsed.newText,
        });
        this.session.pendingPatchSummary = parsed.summary ?? `Patch for ${parsed.path}`;
      }

      for (const tr of parsed.toolRequests ?? []) {
        toolRequests.push(
          createToolRequest({
            sessionId: this.session.sessionId,
            correlationId,
            adapter: tr.adapter === 'terminal' ? AdapterType.Terminal : tr.adapter === 'browser' ? AdapterType.Browser : AdapterType.Vscode,
            action: tr.action,
            parameters: tr.params ?? {},
            description: tr.action,
            sourceId: utterance.id,
            source: ToolRequestSource.AiTask,
          }),
        );
      }

      this.session.activeAiTask = {
        summary: parsed.summary ?? 'Done',
        taskType: AiTaskType.CodeAssist,
        status: AiTaskStatus.Completed,
      };

      const summary = parsed.summary ?? (this.patchStore.get() ? 'Patch ready. Say apply the fix.' : 'AI response ready');
      return { toolRequests, summary, usedAi: true };
    } catch (err) {
      this.session.activeAiTask = undefined;
      return { toolRequests: [], summary: err instanceof Error ? err.message : 'AI failed', usedAi: false };
    }
  }
}
