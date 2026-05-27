import { getModeMeta } from '@/constants/modes';

interface ModeBadgeProps {
  modeId: string;
  label?: string;
  large?: boolean;
}

export function ModeBadge({ modeId, label, large }: ModeBadgeProps) {
  const meta = getModeMeta(modeId);
  const display = label ?? meta.displayName;

  return (
    <span
      className={`mode-badge${large ? ' mode-badge-lg' : ''}`}
      style={{ ['--mode-color' as string]: meta.color }}
    >
      <span aria-hidden>{meta.icon}</span>
      {display}
    </span>
  );
}

interface StatusPillProps {
  status: 'connected' | 'degraded' | 'disconnected';
  label?: string;
}

export function StatusPill({ status, label }: StatusPillProps) {
  return (
    <span className={`status-pill ${status}`}>
      <span className="badge-dot" />
      {label ?? status}
    </span>
  );
}

interface PathBadgeProps {
  path: 'deterministic' | 'ai_assisted' | 'ai' | 'blocked';
}

export function PathBadge({ path }: PathBadgeProps) {
  const cssClass =
    path === 'ai_assisted' || path === 'ai' ? 'ai' : path === 'blocked' ? 'blocked' : 'deterministic';
  const label = path === 'ai_assisted' ? 'ai' : path;
  return <span className={`path-badge ${cssClass}`}>{label}</span>;
}

interface ConfidenceBarProps {
  value: number;
  band?: 'high' | 'medium' | 'low' | 'reject';
}

export function ConfidenceBar({ value, band }: ConfidenceBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const cssBand = band === 'reject' ? 'low' : band;
  return (
    <div className="confidence-bar" title={`${pct}%`}>
      <div
        className={`confidence-fill${cssBand ? ` ${cssBand}` : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
