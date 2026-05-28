import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { HarnessAppTestFlow } from '@/api/types';

export function AppTests() {
  const [flows, setFlows] = useState<HarnessAppTestFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getAppTestFlows();
      setFlows(res.flows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.saveAppTestFlows(flows);
      setFlows(res.flows);
      setMessage('Flows saved to config');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function addFlow() {
    setFlows((prev) => [
      ...prev,
      {
        id: `flow-${Date.now()}`,
        name: 'New Flow',
        steps: [{ type: 'navigate', url: '/' }],
      },
    ]);
  }

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">App Test Flows</h1>
        <p className="page-subtitle">Browser automation scripts — voice trigger: &quot;run login flow&quot;</p>
      </header>

      {loading ? (
        <div className="card empty-state">Loading flows…</div>
      ) : error ? (
        <div className="card empty-state">{error}</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <button type="button" className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save flows'}
            </button>
            <button type="button" className="btn" onClick={addFlow}>Add flow</button>
            {message && <span style={{ alignSelf: 'center', color: 'var(--text-secondary)' }}>{message}</span>}
          </div>

          {flows.length === 0 ? (
            <div className="card empty-state">No flows configured</div>
          ) : (
            flows.map((flow, flowIndex) => (
              <div key={flow.id} className="card" style={{ marginBottom: '1rem' }}>
                <div className="card-header">
                  <h2 className="card-title">{flow.name}</h2>
                  <code style={{ fontSize: '0.75rem' }}>{flow.id}</code>
                </div>
                <div className="field" style={{ marginBottom: '0.75rem' }}>
                  <label>Name</label>
                  <input
                    value={flow.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setFlows((prev) => prev.map((f, i) => (i === flowIndex ? { ...f, name } : f)));
                    }}
                  />
                </div>
                <div className="field" style={{ marginBottom: '0.75rem' }}>
                  <label>ID (voice: run flow {'{id}'})</label>
                  <input
                    value={flow.id}
                    onChange={(e) => {
                      const id = e.target.value;
                      setFlows((prev) => prev.map((f, i) => (i === flowIndex ? { ...f, id } : f)));
                    }}
                  />
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Type</th>
                      <th>Params</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flow.steps.map((step, stepIndex) => (
                      <tr key={stepIndex}>
                        <td>{stepIndex + 1}</td>
                        <td>{step.type}</td>
                        <td className="mono" style={{ fontSize: '0.75rem' }}>
                          {JSON.stringify({ url: step.url, selector: step.selector, value: step.value, text: step.text, timeoutMs: step.timeoutMs })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </>
      )}
    </>
  );
}
