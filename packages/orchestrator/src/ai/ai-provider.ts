import type { HarnessConfig } from '@driftcode/shared';

export interface AiPatchPayload {
  path: string;
  content?: string;
  oldText?: string;
  newText?: string;
}

export interface AiToolRequestPayload {
  adapter: 'vscode' | 'terminal' | 'browser';
  action: string;
  params?: Record<string, unknown>;
}

export interface AiCompletionRequest {
  prompt: string;
  editorContext: string;
  config: HarnessConfig;
  signal?: AbortSignal;
}

export interface AiCompletionResult {
  summary: string;
  patch?: AiPatchPayload;
  toolRequests?: AiToolRequestPayload[];
  usage?: { promptTokens: number; outputTokens: number; totalTokens: number };
}

export interface AiProvider {
  readonly id: string;
  isAvailable(config: HarnessConfig): boolean;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
