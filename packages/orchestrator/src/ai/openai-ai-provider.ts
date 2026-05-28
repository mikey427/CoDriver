import type { HarnessConfig } from '@driftcode/shared';
import type { AiCompletionRequest, AiCompletionResult, AiProvider } from './ai-provider.js';

interface AiPatchResponse {
  summary?: string;
  path?: string;
  content?: string;
  oldText?: string;
  newText?: string;
  toolRequests?: Array<{ adapter: string; action: string; params?: Record<string, unknown> }>;
}

export class OpenAiProvider implements AiProvider {
  readonly id = 'openai';
  private client: { chat: { completions: { create: (args: unknown) => Promise<unknown> } } } | null = null;

  isAvailable(config: HarnessConfig): boolean {
    return Boolean(config.openAiApiKey);
  }

  async ensureClient(config: HarnessConfig): Promise<boolean> {
    if (!config.openAiApiKey) return false;
    if (this.client) return true;
    try {
      const mod = await import('openai');
      this.client = new mod.default({ apiKey: config.openAiApiKey }) as unknown as typeof this.client;
      return true;
    } catch {
      return false;
    }
  }

  resetClient(): void {
    this.client = null;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const ready = await this.ensureClient(request.config);
    if (!ready || !this.client) {
      throw new Error('OpenAI unavailable — set openAiApiKey and npm install openai');
    }

    const vocabulary = request.config.customVocabulary.slice(0, 40).join(', ');
    const promptHint = vocabulary
      ? `DriftCode voice coding harness. Vocabulary: ${vocabulary}. Coding commands and symbols.`
      : 'DriftCode voice coding harness. Coding commands, modes, and TypeScript dictation.';

    const response = (await this.client.chat.completions.create({
      model: request.config.openAiModel,
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
  "toolRequests": [{ "adapter": "terminal|browser|vscode", "action": "...", "params": {} }]
}
Never include secrets. Prefer oldText/newText patches over full content.`,
        },
        {
          role: 'user',
          content: `${promptHint}\n\nRequest: ${request.prompt}\n\nEditor context:\n${request.editorContext.slice(0, 6000)}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 800,
    })) as {
      choices: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    if (request.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as AiPatchResponse;
    const toolRequests = (parsed.toolRequests ?? []).map((tr) => ({
      adapter: (tr.adapter === 'terminal' ? 'terminal' : tr.adapter === 'browser' ? 'browser' : 'vscode') as 'vscode' | 'terminal' | 'browser',
      action: tr.action,
      params: tr.params,
    }));

    const result: AiCompletionResult = {
      summary: parsed.summary ?? 'AI response ready',
      toolRequests,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens ?? 0,
            outputTokens: response.usage.completion_tokens ?? 0,
            totalTokens: response.usage.total_tokens ?? 0,
          }
        : undefined,
    };

    if (parsed.path && (parsed.content != null || (parsed.oldText != null && parsed.newText != null))) {
      result.patch = {
        path: parsed.path,
        content: parsed.content,
        oldText: parsed.oldText,
        newText: parsed.newText,
      };
    }

    return result;
  }
}
