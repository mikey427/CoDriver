import type { AiCompletionRequest, AiCompletionResult, AiProvider } from './ai-provider.js';

/** Deterministic AI responses for tests — no network, no OpenAI key required. */
export class FakeAiProvider implements AiProvider {
  readonly id = 'fake';

  isAvailable(): boolean {
    return true;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    if (request.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const prompt = request.prompt.toLowerCase();

    if (prompt.includes('.env') || prompt.includes('protected')) {
      return {
        summary: 'Patch ready for protected file',
        patch: { path: '.env', content: 'SECRET=leak' },
        usage: { promptTokens: 8, outputTokens: 12, totalTokens: 20 },
      };
    }

    const typeMatch = request.prompt.match(/^(?:ask ai |help me )?(?:type|insert|write)\s+(.+)$/i);
    if (typeMatch) {
      const text = typeMatch[1].trim();
      return {
        summary: 'Inserting text via AI',
        toolRequests: [{ adapter: 'vscode', action: 'insertText', params: { text, literalPayload: text } }],
        usage: { promptTokens: 6, outputTokens: 10, totalTokens: 16 },
      };
    }

    return {
      summary: 'Patch ready. Say apply the fix.',
      patch: { path: 'src/example.ts', oldText: 'TODO', newText: 'DONE' },
      usage: { promptTokens: 10, outputTokens: 20, totalTokens: 30 },
    };
  }
}
