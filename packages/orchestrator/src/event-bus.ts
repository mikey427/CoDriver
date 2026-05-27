import { EventEmitter } from 'node:events';
import { v4 as uuidv4 } from 'uuid';
import type { RuntimeEvent, RuntimeEventMap, RuntimeEventType, Severity, Subsystem } from '@driftcode/shared';
import { RuntimeEventSeverity, RuntimeSubsystem } from '@driftcode/shared';
import { SCHEMA_VERSION } from './helpers/factories.js';

type EventHandler<T extends RuntimeEventType> = (payload: RuntimeEventMap[T], event: RuntimeEvent) => void;

export class EventBus {
  private emitter = new EventEmitter();
  private sequence = 0;
  private ringBuffer: RuntimeEvent[] = [];
  private readonly maxBuffer = 500;

  constructor(private sessionId: string) {
    this.emitter.setMaxListeners(50);
  }

  on<T extends RuntimeEventType>(type: T, handler: EventHandler<T>): () => void {
    const wrapped = (event: RuntimeEvent) => {
      handler(event.payload as RuntimeEventMap[T], event);
    };
    this.emitter.on(type, wrapped);
    return () => this.emitter.off(type, wrapped);
  }

  emit<T extends RuntimeEventType>(
    type: T,
    payload: RuntimeEventMap[T],
    options: {
      severity?: Severity;
      subsystem?: Subsystem;
      message?: string;
      correlationId?: string;
      utteranceId?: string;
      intentId?: string;
      success?: boolean;
    } = {},
  ): RuntimeEvent {
    this.sequence += 1;
    const event: RuntimeEvent = {
      id: uuidv4(),
      schemaVersion: SCHEMA_VERSION,
      sessionId: this.sessionId,
      sequenceNumber: this.sequence,
      timestamp: new Date().toISOString(),
      eventType: type,
      severity: options.severity ?? RuntimeEventSeverity.Info,
      subsystem: options.subsystem ?? RuntimeSubsystem.Orchestrator,
      correlationId: options.correlationId,
      utteranceId: options.utteranceId,
      intentId: options.intentId,
      payload: payload as Record<string, unknown>,
      message: options.message,
      success: options.success,
    };

    this.ringBuffer.push(event);
    if (this.ringBuffer.length > this.maxBuffer) {
      this.ringBuffer.shift();
    }

    this.emitter.emit(type, event);
    this.emitter.emit('*', event);
    return event;
  }

  getRecentEvents(limit = 100): RuntimeEvent[] {
    return this.ringBuffer.slice(-limit);
  }

  getSequence(): number {
    return this.sequence;
  }

  onAny(handler: (event: RuntimeEvent) => void): () => void {
    this.emitter.on('*', handler);
    return () => this.emitter.off('*', handler);
  }
}
