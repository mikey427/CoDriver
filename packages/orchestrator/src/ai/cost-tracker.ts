import { v4 as uuidv4 } from 'uuid';
import { AiUsageOperation } from '@driftcode/shared';
import type { AiUsageEvent } from '@driftcode/shared';

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
};

export class CostTracker {
  private events: AiUsageEvent[] = [];

  record(input: {
    sessionId: string;
    profileId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    modeId: string;
    utteranceId?: string;
  }): AiUsageEvent {
    const pricing = MODEL_PRICING[input.model] ?? { input: 1, output: 3 };
    const costUsd =
      (input.inputTokens / 1_000_000) * pricing.input + (input.outputTokens / 1_000_000) * pricing.output;

    const event: AiUsageEvent = {
      id: uuidv4(),
      schemaVersion: 1,
      sessionId: input.sessionId,
      aiTaskId: uuidv4(),
      timestamp: new Date().toISOString(),
      provider: 'openai',
      model: input.model,
      operation: AiUsageOperation.ChatCompletion,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      totalTokens: input.totalTokens,
      costUsd,
      rateTableVersion: 'mvp-1',
      modeId: input.modeId,
      profileId: input.profileId,
      utteranceId: input.utteranceId,
      wasAvoidable: false,
    };

    this.events.push(event);
    if (this.events.length > 1000) this.events.shift();
    return event;
  }

  getEvents(limit = 100): AiUsageEvent[] {
    return this.events.slice(-limit);
  }
}
