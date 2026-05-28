import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import type { OpenAiSettingsView, SttProviderInfo, SttSettingsView } from '@/api/types';

export function Settings() {
  const [openAi, setOpenAi] = useState<OpenAiSettingsView | null>(null);
  const [stt, setStt] = useState<SttSettingsView | null>(null);
  const [providers, setProviders] = useState<SttProviderInfo[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ai, speech, prov] = await Promise.all([
          api.getOpenAiSettings(),
          api.getSttSettings(),
          api.getSttProviders(),
        ]);
        if (!cancelled) {
          setOpenAi(ai);
          setStt(speech);
          setProviders(prov.providers);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load settings');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stt) return;
    setSaving(true);
    setMessage(null);
    try {
      const [nextStt, nextAi] = await Promise.all([
        api.updateSttSettings({
          providerId: stt.providerId,
          sttModel: stt.sttModel,
          sttLanguage: stt.sttLanguage,
          customVocabulary: stt.customVocabulary,
          speechCorrections: stt.speechCorrections,
        }),
        apiKeyInput
          ? api.updateOpenAiSettings({ apiKey: apiKeyInput })
          : Promise.resolve(openAi!),
      ]);
      setStt(nextStt);
      if (nextAi) setOpenAi(nextAi);
      setApiKeyInput('');
      setMessage('Settings saved');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const activeProvider = providers.find((p) => p.id === stt?.providerId);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">OpenAI and speech-to-text configuration</p>
      </header>

      {loading ? (
        <div className="card empty-state">Loading settings…</div>
      ) : error ? (
        <div className="card empty-state">{error}</div>
      ) : (
        <form className="settings-grid" onSubmit={(e) => void handleSubmit(e)}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">OpenAI</h2>
            </div>
            <div className="field" style={{ marginBottom: '1rem' }}>
              <label htmlFor="api-key">API Key</label>
              <input
                id="api-key"
                type="password"
                placeholder={openAi?.hasApiKey ? openAi.apiKeyMasked : 'sk-…'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                autoComplete="off"
              />
              {openAi?.hasApiKey && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Current: {openAi.apiKeyMasked}
                </span>
              )}
            </div>
            <dl style={{ margin: 0 }}>
              <div className="kv-row">
                <dt>Default model</dt>
                <dd>{openAi?.defaultModel ?? '—'}</dd>
              </div>
              <div className="kv-row">
                <dt>Session budget</dt>
                <dd>{openAi?.sessionBudgetUsd != null ? `$${openAi.sessionBudgetUsd}` : '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Speech-to-Text</h2>
            </div>
            {stt && (
              <>
                <div className="field" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="stt-provider">Provider</label>
                  <select
                    id="stt-provider"
                    value={stt.providerId}
                    onChange={(e) => setStt({ ...stt, providerId: e.target.value })}
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.displayName}</option>
                    ))}
                  </select>
                  {activeProvider && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {activeProvider.description}
                    </span>
                  )}
                </div>
                {stt.providerId === 'openai-whisper' && (
                  <>
                    <div className="field" style={{ marginBottom: '1rem' }}>
                      <label htmlFor="stt-model">Whisper model</label>
                      <input
                        id="stt-model"
                        value={stt.sttModel}
                        onChange={(e) => setStt({ ...stt, sttModel: e.target.value })}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: '1rem' }}>
                      <label htmlFor="stt-lang">Language</label>
                      <input
                        id="stt-lang"
                        value={stt.sttLanguage}
                        onChange={(e) => setStt({ ...stt, sttLanguage: e.target.value })}
                        placeholder="en"
                      />
                    </div>
                    <div className="kv-row" style={{ marginBottom: '1rem' }}>
                      <dt>Whisper ready</dt>
                      <dd style={{ color: stt.whisperAvailable ? 'var(--status-ok)' : 'var(--status-warn)' }}>
                        {stt.whisperAvailable ? 'Yes' : 'No — set API key and install openai package'}
                      </dd>
                    </div>
                  </>
                )}
                {stt.customVocabulary.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div className="card-title" style={{ marginBottom: '0.5rem' }}>Custom vocabulary</div>
                    <div className="tag-list">
                      {stt.customVocabulary.map((w) => (
                        <span key={w} className="tag">{w}</span>
                      ))}
                    </div>
                  </div>
                )}
                {stt.speechCorrections.length > 0 && (
                  <div>
                    <div className="card-title" style={{ marginBottom: '0.5rem' }}>Speech corrections</div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Misrecognition</th>
                          <th>Correction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stt.speechCorrections.map((c) => (
                          <tr key={c.misrecognition}>
                            <td>{c.misrecognition}</td>
                            <td>{c.correction}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p style={{ fontSize: '0.8125rem', marginTop: '1rem' }}>
                  <Link to="/onboarding">Run the setup wizard</Link>
                  {' · '}
                  <Link to="/tutorial">Practice voice commands</Link>
                </p>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            {message && (
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{message}</span>
            )}
          </div>
        </form>
      )}
    </>
  );
}
