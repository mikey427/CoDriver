import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { SafetyView } from '@/api/types';

export function Safety() {
  const [config, setConfig] = useState<SafetyView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getSafetyConfig();
        if (!cancelled) {
          setConfig(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load safety config');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Safety Settings</h1>
        <p className="page-subtitle">Read-only view — edits require safety unlock</p>
      </header>

      <div className="readonly-banner">
        {config?.locked !== false ? (
          <>Safety configuration is locked. Unlock via typed phrase &quot;Confirm safety change.&quot; to edit.</>
        ) : (
          <>Safety configuration unlocked — changes are audited.</>
        )}
      </div>

      {loading ? (
        <div className="card empty-state">Loading safety config…</div>
      ) : error || !config ? (
        <div className="card empty-state">{error ?? 'No safety config'}</div>
      ) : (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Policy</h2>
            </div>
            <dl style={{ margin: 0 }}>
              <div className="kv-row">
                <dt>Strictness</dt>
                <dd>{config.confirmationStrictness}</dd>
              </div>
              <div className="kv-row">
                <dt>Session budget</dt>
                <dd>{config.sessionCostBudgetUsd != null ? `$${config.sessionCostBudgetUsd}` : '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Emergency Phrases</h2>
            </div>
            <div className="tag-list">
              {config.emergencyPhrases.map((p) => (
                <span key={p} className="tag">{p}</span>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Terminal Allowlist</h2>
            </div>
            <div className="tag-list">
              {config.terminalAllowlist.map((p) => (
                <span key={p} className="tag mono">{p}</span>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Terminal Blocklist</h2>
            </div>
            <div className="tag-list">
              {config.terminalBlocklist.map((p) => (
                <span key={p} className="tag mono">{p}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
