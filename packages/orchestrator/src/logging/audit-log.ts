import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { AuditLogEntry } from '@driftcode/shared';
import type { EventBus } from '../event-bus.js';

export class AuditLog {
  private logPath: string;

  constructor(configPath: string) {
    this.logPath = join(dirname(configPath), 'audit.jsonl');
    const dir = dirname(this.logPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  append(category: string, action: string, details: Record<string, unknown>, success = true, actor = 'orchestrator'): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      category,
      action,
      actor,
      details,
      success,
    };
    appendFileSync(this.logPath, `${JSON.stringify(entry)}\n`, 'utf-8');
    return entry;
  }

  readRecent(limit = 200): AuditLogEntry[] {
    if (!existsSync(this.logPath)) return [];
    const lines = readFileSync(this.logPath, 'utf-8').trim().split('\n').filter(Boolean);
    return lines
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line) as AuditLogEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is AuditLogEntry => e != null);
  }

  wire(eventBus: EventBus): void {
    eventBus.on('audit.entry', ({ entry }) => {
      appendFileSync(this.logPath, `${JSON.stringify(entry)}\n`, 'utf-8');
    });
  }
}
