import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { RuntimeEvent } from '@/api/types';
import { SEVERITIES, SUBSYSTEMS } from '@/constants/modes';

export function Logs() {
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<RuntimeEvent['severity'] | ''>('');
  const [subsystem, setSubsystem] = useState<RuntimeEvent['subsystem'] | ''>('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getEvents({
        severity: severity || undefined,
        subsystem: subsystem || undefined,
        search: search || undefined,
        limit: 200,
      });
      setEvents(res.events);
      setTotal(res.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [severity, subsystem, search]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [load]);

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Runtime Logs</h1>
        <p className="page-subtitle">Event stream with filters — auto-refreshes every 3s</p>
      </header>

      <div className="filters">
        <div className="field">
          <label htmlFor="log-severity">Severity</label>
          <select
            id="log-severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as RuntimeEvent['severity'] | '')}
          >
            <option value="">All</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="log-subsystem">Subsystem</label>
          <select
            id="log-subsystem"
            value={subsystem}
            onChange={(e) => setSubsystem(e.target.value as RuntimeEvent['subsystem'] | '')}
          >
            <option value="">All</option>
            {SUBSYSTEMS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: '12rem' }}>
          <label htmlFor="log-search">Search</label>
          <input
            id="log-search"
            type="search"
            placeholder="Message, event type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field" style={{ alignSelf: 'flex-end' }}>
          <button type="button" className="btn" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>

      <div className="card">
        {loading && events.length === 0 ? (
          <p className="empty-state">Loading events…</p>
        ) : error ? (
          <p className="empty-state">{error}</p>
        ) : events.length === 0 ? (
          <p className="empty-state">No events match filters</p>
        ) : (
          <ul className="event-list">
            {events.map((event) => (
              <li key={event.id} className="event-item">
                <span className="event-time">{formatTime(event.timestamp)}</span>
                <span>
                  <span className={`severity ${event.severity}`}>{event.severity}</span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{event.subsystem}</div>
                </span>
                <span>
                  <div>{event.message ?? event.eventType}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{event.eventType}</div>
                </span>
                <span>
                  <div className="mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    #{event.sequenceNumber}
                  </div>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Showing {events.length} of {total} events
      </p>
    </>
  );
}
