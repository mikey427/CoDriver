import type { EventBus } from '../event-bus.js';
import type { Session } from '../session.js';
import { ALL_MODE_IDS, DEFAULT_MODE_CONFIGS, ModeId, RuntimeEventSeverity, RuntimeSubsystem } from '@driftcode/shared';

const ALLOWED_FROM_EMERGENCY = new Set<ModeId>([ModeId.Command, ModeId.ManualDictation]);

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phraseMatches(normalized: string, phrase: string): boolean {
  const p = phrase.toLowerCase().trim();
  if (!p) return false;
  if (normalized === p) return true;
  if (p.includes(' ')) return normalized.includes(p);
  return new RegExp(`\\b${escapeRegex(p)}\\b`).test(normalized);
}

export class ModeManager {
  constructor(
    private session: Session,
    private eventBus: EventBus,
  ) {}

  resolveModeFromPhrase(text: string): ModeId | undefined {
    const normalized = text.toLowerCase().trim();
    for (const modeId of ALL_MODE_IDS) {
      const config = DEFAULT_MODE_CONFIGS[modeId];
      for (const phrase of [...config.enterPhrases, `switch ${config.displayName.toLowerCase()}`, config.displayName.toLowerCase()]) {
        if (phraseMatches(normalized, phrase)) {
          return modeId;
        }
      }
    }
    if (normalized.includes('manual dictation') || normalized.includes('dictation mode')) {
      return ModeId.ManualDictation;
    }
    return undefined;
  }

  canTransition(from: ModeId | string, to: ModeId | string): boolean {
    if (from === to) return true;
    if (to === ModeId.EmergencySafe) return true;
    if (from === ModeId.EmergencySafe) {
      return ALLOWED_FROM_EMERGENCY.has(to as ModeId);
    }
    if (from === ModeId.VibeCoding && to === ModeId.VibeCoding) return false;
    return true;
  }

  switchMode(targetModeId: ModeId | string, source = 'voice'): { success: boolean; reason?: string } {
    const current = this.session.activeModeId;

    if (this.session.emergencyStopActive && targetModeId !== ModeId.EmergencySafe && source !== 'api') {
      if (!ALLOWED_FROM_EMERGENCY.has(targetModeId as ModeId)) {
        const reason = 'Emergency stop active. Say "resume" or use admin to clear.';
        this.eventBus.emit('mode.blocked', { targetModeId, reason }, { subsystem: RuntimeSubsystem.Orchestrator, severity: RuntimeEventSeverity.Warn });
        return { success: false, reason };
      }
    }

    if (!this.canTransition(current, targetModeId)) {
      const reason = `Transition from ${current} to ${targetModeId} is not allowed.`;
      this.eventBus.emit('mode.blocked', { targetModeId, reason }, { subsystem: RuntimeSubsystem.Orchestrator, severity: RuntimeEventSeverity.Warn });
      return { success: false, reason };
    }

    if (current === targetModeId) return { success: true };

    this.eventBus.emit('mode.exited', { modeId: current }, { subsystem: RuntimeSubsystem.Orchestrator });
    this.session.previousModeId = current;
    this.session.activeModeId = targetModeId;
    if (targetModeId === ModeId.EmergencySafe) this.session.emergencyStopActive = true;

    this.eventBus.emit(
      'mode.entered',
      { modeId: targetModeId, previousModeId: current },
      { subsystem: RuntimeSubsystem.Orchestrator, message: `Entered ${DEFAULT_MODE_CONFIGS[targetModeId as ModeId]?.displayName ?? targetModeId}` },
    );

    return { success: true };
  }
}
