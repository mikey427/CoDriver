import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { DEFAULT_MODE_CONFIG_LIST } from '@driftcode/shared';
import { api } from '@/api/client';
import type { LayoutOutletContext } from '@/components/Layout';
import { MODE_CATALOG } from '@/constants/modes';

export function Modes() {
  const { dashboard } = useOutletContext<LayoutOutletContext>();
  const [activeModeId, setActiveModeId] = useState(dashboard?.activeModeId ?? 'command');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dashboard?.activeModeId) {
      setActiveModeId(dashboard.activeModeId);
    }
  }, [dashboard?.activeModeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getModes();
        if (!cancelled) {
          setActiveModeId(res.activeModeId ?? dashboard?.activeModeId ?? 'command');
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('Using local mode catalog — orchestrator unavailable');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboard?.activeModeId]);

  const modes = DEFAULT_MODE_CONFIG_LIST;

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Modes</h1>
        <p className="page-subtitle">11 harness operating modes — current mode highlighted</p>
      </header>

      {error && <div className="readonly-banner">{error}</div>}

      {loading ? (
        <div className="card empty-state">Loading modes…</div>
      ) : (
        <div className="mode-grid">
          {modes.map((mode) => {
            const meta = MODE_CATALOG.find((m) => m.id === mode.id);
            const isActive = String(mode.id) === String(activeModeId);
            return (
              <article
                key={mode.id}
                className={`mode-card${isActive ? ' active' : ''}`}
                style={{ ['--mode-color' as string]: meta?.color ?? '#3b82f6' }}
              >
                <div className="mode-card-header">
                  <div className="mode-card-icon">{meta?.icon ?? '◫'}</div>
                  <div>
                    <div className="mode-card-title">{mode.displayName}</div>
                    {isActive && (
                      <span
                        className="badge"
                        style={{
                          marginTop: '0.25rem',
                          color: meta?.color,
                          borderColor: meta?.color,
                        }}
                      >
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>
                <p className="mode-card-desc">{mode.description || mode.purpose}</p>
                <div className="tag-list">
                  <span className="tag">AI: {mode.openAiEnabledDefault ? 'on' : 'off'}</span>
                  <span className="tag">{mode.aiAutonomyLevel.replace(/_/g, ' ')}</span>
                  {!mode.enabled && <span className="tag">disabled</span>}
                </div>
                {mode.enterPhrases.length > 0 && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Enter: {mode.enterPhrases.slice(0, 2).join(' · ')}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
