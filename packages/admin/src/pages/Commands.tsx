import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { CommandAliasRow } from '@/api/types';
import { PathBadge } from '@/components/ModeBadge';

export function Commands() {
  const [aliases, setAliases] = useState<CommandAliasRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getAliases();
        if (!cancelled) {
          setAliases(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load aliases');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = aliases.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.aliasPhrases.some((p) => p.toLowerCase().includes(q)) ||
      a.targetCommandId.toLowerCase().includes(q) ||
      (a.targetCommandName?.toLowerCase().includes(q) ?? false) ||
      (a.notes?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Commands & Aliases</h1>
        <p className="page-subtitle">Deterministic command vocabulary — from orchestrator API or speech corrections</p>
      </header>

      <div className="filters">
        <div className="field" style={{ flex: 1, minWidth: '16rem' }}>
          <label htmlFor="alias-search">Search</label>
          <input
            id="alias-search"
            type="search"
            placeholder="Phrase, command ID, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="empty-state">Loading aliases…</p>
        ) : error ? (
          <p className="empty-state">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">No aliases found</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Phrases</th>
                <th>Target</th>
                <th>Modes</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((alias) => (
                <tr key={alias.id}>
                  <td>
                    <div className="tag-list">
                      {alias.aliasPhrases.map((phrase) => (
                        <span key={phrase} className="tag">{phrase}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{alias.targetCommandName ?? alias.targetCommandId}</div>
                    <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {alias.targetCommandId}
                    </div>
                    {alias.notes && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        {alias.notes}
                      </div>
                    )}
                  </td>
                  <td>
                    {alias.modeAllowlist.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)' }}>All modes</span>
                    ) : (
                      <div className="tag-list">
                        {alias.modeAllowlist.map((m) => (
                          <span key={m} className="tag">{m}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="mono">{alias.priority}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        color: alias.enabled ? 'var(--status-ok)' : 'var(--text-muted)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      {alias.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        {filtered.length} alias{filtered.length !== 1 ? 'es' : ''} · deterministic path{' '}
        <PathBadge path="deterministic" />
      </p>
    </>
  );
}
