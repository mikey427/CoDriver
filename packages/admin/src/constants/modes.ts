import { DEFAULT_MODE_CONFIG_LIST, MODE_OVERLAY_COLORS, ModeId } from '@driftcode/shared';

export interface ModeMeta {
  id: string;
  displayName: string;
  shortLabel: string;
  color: string;
  icon: string;
  description: string;
}

const ICONS: Record<string, string> = {
  [ModeId.ManualDictation]: '⌨',
  [ModeId.Command]: '▸',
  [ModeId.AiAssist]: '✦',
  [ModeId.VibeCoding]: '◈',
  [ModeId.Research]: '⌕',
  [ModeId.Browser]: '◉',
  [ModeId.AppTesting]: '✓',
  [ModeId.Review]: '◎',
  [ModeId.Terminal]: '$',
  [ModeId.StreamControl]: '▣',
  [ModeId.EmergencySafe]: '⛔',
};

/** Admin panel colors — Manual=green, Command=blue, AI=purple */
const ADMIN_MODE_COLORS: Record<string, string> = {
  [ModeId.ManualDictation]: '#22c55e',
  [ModeId.Command]: '#3b82f6',
  [ModeId.AiAssist]: '#a855f7',
};

export const MODE_CATALOG: ModeMeta[] = DEFAULT_MODE_CONFIG_LIST.map((mode) => {
  const id = String(mode.id);
  return {
    id,
    displayName: mode.displayName,
    shortLabel: mode.displayName.split(' ')[0] ?? mode.displayName,
    color: ADMIN_MODE_COLORS[id] ?? MODE_OVERLAY_COLORS[mode.id as ModeId],
    icon: ICONS[id] ?? '◫',
    description: mode.description,
  };
});

export function getModeMeta(modeId: string): ModeMeta {
  return MODE_CATALOG.find((m) => m.id === modeId) ?? MODE_CATALOG[1];
}

export const SUBSYSTEMS = [
  'orchestrator',
  'speech',
  'normalizer',
  'parser',
  'ai',
  'router',
  'safety',
  'vscode',
  'terminal',
  'browser',
  'obs',
  'overlay',
  'audio',
  'admin',
] as const;

export const SEVERITIES = ['debug', 'info', 'warn', 'error', 'audit'] as const;

export const ROUTING_PATHS = ['deterministic', 'ai', 'blocked'] as const;

export { DEFAULT_MODE_CONFIG_LIST };
