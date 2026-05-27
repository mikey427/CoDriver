import { v4 as uuidv4 } from 'uuid';
import { CONFIRMATION_PHRASE_REGISTRY, RiskTier, RuntimeSubsystem } from '@driftcode/shared';
import type { DashboardPendingConfirmation, ToolResult } from '@driftcode/shared';
import type { EventBus } from '../event-bus.js';
import type { InternalParsedIntent } from '../helpers/factories.js';

export type PendingExecutor = () => Promise<ToolResult>;

interface PendingEntry {
  confirmation: DashboardPendingConfirmation;
  intent: InternalParsedIntent;
  execute: PendingExecutor;
}

export class ConfirmationManager {
  private queue: PendingEntry[] = [];

  constructor(private eventBus: EventBus) {}

  queueConfirmation(
    intent: InternalParsedIntent,
    summary: string,
    riskTier: RiskTier | string,
    execute: PendingExecutor,
  ): DashboardPendingConfirmation {
    const confirmation: DashboardPendingConfirmation = {
      id: uuidv4(),
      actionSummary: summary,
      requiredPhrase: CONFIRMATION_PHRASE_REGISTRY.execute,
      riskTier,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    this.queue.push({ confirmation, intent, execute });
    this.eventBus.emit('confirmation.queued', { confirmation }, { subsystem: RuntimeSubsystem.Safety, intentId: intent.id });
    return confirmation;
  }

  getPending(): DashboardPendingConfirmation[] {
    return this.queue.map((entry) => entry.confirmation);
  }

  hasPending(): boolean {
    return this.queue.length > 0;
  }

  cancel(): boolean {
    if (!this.queue.length) return false;
    const removed = this.queue.pop()!;
    this.eventBus.emit('confirmation.resolved', { confirmationId: removed.confirmation.id, approved: false }, { subsystem: RuntimeSubsystem.Safety });
    return true;
  }

  async confirm(action: 'execute' | 'destructive' = 'execute'): Promise<{ approved: boolean; result?: ToolResult }> {
    const entry = this.queue[this.queue.length - 1];
    if (!entry) return { approved: false };

    const phrase = action === 'destructive'
      ? CONFIRMATION_PHRASE_REGISTRY.destructive
      : CONFIRMATION_PHRASE_REGISTRY.execute;

    if (entry.confirmation.requiredPhrase !== phrase && action === 'execute' && entry.confirmation.requiredPhrase === CONFIRMATION_PHRASE_REGISTRY.destructive) {
      return { approved: false };
    }

    this.queue.pop();
    this.eventBus.emit('confirmation.resolved', { confirmationId: entry.confirmation.id, approved: true }, { subsystem: RuntimeSubsystem.Safety });
    const result = await entry.execute();
    return { approved: true, result };
  }

  clear(): void {
    this.queue = [];
  }
}
