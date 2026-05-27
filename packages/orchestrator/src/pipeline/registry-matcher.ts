import { BUILTIN_VOICE_COMMANDS, ModeId } from '@driftcode/shared';
import type { VoiceCommand } from '@driftcode/shared';

export interface RegistryMatch {
  command: VoiceCommand;
  slots: Record<string, string>;
  confidence: number;
}

const SLOT_CAPTURE = /\{(\w+)\}/g;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patternToRegex(pattern: string): RegExp {
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(SLOT_CAPTURE.source, 'g');
  while ((match = re.exec(pattern)) !== null) {
    parts.push(escapeRegex(pattern.slice(lastIndex, match.index)));
    parts.push(`(?<${match[1]}>.+?)`);
    lastIndex = match.index + match[0].length;
  }
  parts.push(escapeRegex(pattern.slice(lastIndex)));
  return new RegExp(`^${parts.join('')}$`, 'i');
}

interface CompiledPattern {
  command: VoiceCommand;
  pattern: string;
  regex: RegExp;
}

const COMPILED: CompiledPattern[] = BUILTIN_VOICE_COMMANDS.flatMap((command) =>
  command.grammarPatterns.map((pattern) => ({
    command,
    pattern,
    regex: patternToRegex(pattern),
  })),
).sort((a, b) => {
  const slotDelta = countSlots(a.pattern) - countSlots(b.pattern);
  if (slotDelta !== 0) return slotDelta;
  return b.pattern.length - a.pattern.length;
});

function countSlots(pattern: string): number {
  return (pattern.match(/\{[^}]+\}/g) ?? []).length;
}

function isAllowedInMode(command: VoiceCommand, modeId: string): boolean {
  if (command.allowedModeIds.includes(modeId)) return true;
  if (command.tags?.includes('global')) return true;
  if (modeId === ModeId.EmergencySafe) {
    return command.tags?.some((tag) => ['safety', 'audio', 'confirmation'].includes(tag)) ?? false;
  }
  return false;
}

/** Match utterance text against the built-in voice command registry. */
export function matchRegistryCommand(text: string, modeId: string): RegistryMatch | null {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');

  for (const entry of COMPILED) {
    if (!isAllowedInMode(entry.command, modeId)) continue;
    const result = entry.regex.exec(normalized);
    if (!result?.groups) continue;

    const slots: Record<string, string> = {};
    for (const [key, value] of Object.entries(result.groups)) {
      if (value != null) slots[key] = value.trim();
    }

    if (entry.pattern === 'run login flow' || (entry.command.id === 'browser.runFlow' && normalized === 'run login flow')) {
      slots.flowId = slots.flowId ?? 'login';
    }

    return { command: entry.command, slots, confidence: 0.94 };
  }

  return null;
}
