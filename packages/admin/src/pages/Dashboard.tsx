import { useOutletContext } from 'react-router-dom';
import type { LayoutOutletContext } from '@/components/Layout';
import { ConfidenceBar, PathBadge, StatusPill } from '@/components/ModeBadge';
import { ModeBadge } from '@/components/ModeBadge';
import { SpeechInputPanel } from '@/components/SpeechInputPanel';

function formatTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function Dashboard() {
  const { dashboard: state, connection, error } = useOutletContext<LayoutOutletContext>();

  if (!state) {
    return (
      <>
        <header className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Live harness state — glanceable monitoring surface</p>
        </header>
        <div className="card empty-state">
          {error ? (
            <>
              <p>Cannot reach orchestrator at <code>127.0.0.1:17345</code></p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }}>{error}</p>
            </>
          ) : (
            <p>Connecting to orchestrator…</p>
          )}
        </div>
      </>
    );
  }

  const editor = state.editorState;
  const intent = state.lastParsedIntent;
  const utterance = state.lastNormalizedUtterance;
  const browser = state.browserState;

  return (
    <>
      {state.emergencyStopActive && (
        <div className="emergency-banner" role="alert">
          <span aria-hidden>⛔</span>
          <div>
            <strong>Emergency stop active</strong>
            <div style={{ fontWeight: 400, fontSize: '0.875rem', marginTop: '0.125rem' }}>
              Only whitelisted commands accepted. Say &quot;resume&quot; or switch to manual dictation to recover.
            </div>
          </div>
        </div>
      )}

      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          {connection === 'live' ? 'Real-time via SSE' : connection === 'polling' ? 'Polling every 2s' : 'Offline'} ·
          {' '}Session {state.sessionId.slice(0, 8)}
        </p>
      </header>

      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Mode</h2>
          </div>
          <ModeBadge modeId={String(state.activeModeId)} label={state.activeModeDisplayName} large />
          {state.previousModeId && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Previous: {state.previousModeId}
            </p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">AI Cost</h2>
          </div>
          <div className="card-value">${state.sessionCostUsd.toFixed(4)}</div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {state.aiCallsThisSession} calls · {state.deterministicCommandStreak} deterministic streak
          </p>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Dev Server</h2>
          </div>
          <div className="card-value-sm">{state.devServerStatus}</div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Focus: {state.focusTarget}
            {browser?.domain ? ` · ${browser.domain}` : ''}
          </p>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Pending</h2>
          </div>
          <div className="card-value">{state.pendingConfirmations.length}</div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            confirmations queued
          </p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Speech Pipeline</h2>
          </div>
          <div className="pipeline-chain">
            <div className="pipeline-step">
              <strong>Last Utterance</strong>
              {utterance ? (
                <>
                  <div className="mono">{utterance.normalizedText}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    raw: {utterance.rawText} · {formatTime(utterance.timestamp)}
                    {utterance.source ? ` · ${utterance.source}` : ''}
                    {utterance.confidence != null ? ` · ${Math.round(utterance.confidence * 100)}% conf` : ''}
                  </div>
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>No utterance yet</span>
              )}
            </div>
            <div className="pipeline-step">
              <strong>Intent</strong>
              {intent ? (
                <>
                  <div>{intent.summary}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.375rem' }}>
                    <PathBadge path={intent.routingPath} />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {(intent.confidence * 100).toFixed(0)}% · {intent.intentType}
                    </span>
                  </div>
                  <ConfidenceBar
                    value={intent.confidence}
                    band={intent.confidenceBand as 'high' | 'medium' | 'low' | 'reject'}
                  />
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>No intent parsed</span>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Editor State</h2>
            {editor && <StatusPill status={editor.connectionStatus} />}
          </div>
          {editor?.hasActiveEditor ? (
            <dl style={{ margin: 0 }}>
              <div className="kv-row">
                <dt>File</dt>
                <dd>{editor.activeFileBasename ?? editor.activeFilePath ?? '—'}</dd>
              </div>
              <div className="kv-row">
                <dt>Cursor</dt>
                <dd>
                  L{editor.cursorLine ?? 0}:{editor.cursorCharacter ?? 0}
                </dd>
              </div>
              <div className="kv-row">
                <dt>Language</dt>
                <dd>{editor.languageId ?? '—'}</dd>
              </div>
              <div className="kv-row">
                <dt>Diagnostics</dt>
                <dd>
                  {editor.errorCount ?? 0} err · {editor.warningCount ?? 0} warn
                </dd>
              </div>
              <div className="kv-row">
                <dt>Updated</dt>
                <dd>{formatTime(editor.timestamp)}</dd>
              </div>
            </dl>
          ) : (
            <p className="empty-state" style={{ padding: '1rem 0' }}>No active editor</p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Subsystem Health</h2>
          </div>
          <div className="health-grid">
            {Object.entries(state.adapterHealth).map(([key, status]) => (
              <div key={key} className="health-card">
                <div className="health-card-label">{key}</div>
                <StatusPill status={status} />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Pending Confirmations</h2>
          </div>
          {state.pendingConfirmations.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>None</p>
          ) : (
            state.pendingConfirmations.map((c) => (
              <div
                key={c.id}
                className={`confirmation-card${c.riskTier === 'dangerous' ? ' dangerous' : ''}`}
              >
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{c.actionSummary}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Say: <code>{c.requiredPhrase}</code>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {c.riskTier} risk · expires {c.expiresAt ? formatTime(c.expiresAt) : 'never'}
                </div>
              </div>
            ))
          )}

          {state.activeAiTask && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div className="card-title" style={{ marginBottom: '0.5rem' }}>Active AI Task</div>
              <div style={{ fontWeight: 600 }}>{state.activeAiTask.summary}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {state.activeAiTask.taskType} · {state.activeAiTask.status}
              </div>
            </div>
          )}
        </div>
      </div>

          {state.speechStatus && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card-header">
                <h2 className="card-title">Input / PTT Status</h2>
                <StatusPill status={state.adapterHealth.stt ?? 'disconnected'} />
              </div>
              <dl style={{ margin: 0 }}>
                <div className="kv-row">
                  <dt>PTT</dt>
                  <dd>{state.pttState?.active || state.speechStatus.pttActive ? 'LISTENING' : 'Idle'}</dd>
                </div>
                {state.pttState?.source && (
                  <div className="kv-row">
                    <dt>PTT source</dt>
                    <dd>{state.pttState.source}</dd>
                  </div>
                )}
                <div className="kv-row">
                  <dt>Last input source</dt>
                  <dd>{state.speechStatus.lastInputSource ?? state.lastNormalizedUtterance?.source ?? '—'}</dd>
                </div>
                <div className="kv-row">
                  <dt>Provider</dt>
                  <dd>{state.speechStatus.providerId}</dd>
                </div>
                {state.speechStatus.lastTranscript && (
                  <div className="kv-row">
                    <dt>Last transcript</dt>
                    <dd>
                      {state.speechStatus.lastTranscript}
                      {state.speechStatus.lastTranscriptConfidence != null &&
                        ` (${Math.round(state.speechStatus.lastTranscriptConfidence * 100)}%)`}
                    </dd>
                  </div>
                )}
                {state.lastBlockedLowConfidence && (
                  <div className="kv-row">
                    <dt>Blocked (low conf)</dt>
                    <dd style={{ color: 'var(--status-warn)' }}>
                      {state.lastBlockedLowConfidence.text.slice(0, 80)} (
                      {Math.round(state.lastBlockedLowConfidence.confidence * 100)}%)
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

      <SpeechInputPanel />

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-header">
          <h2 className="card-title">Command History</h2>
        </div>
        {state.commandHistory.length === 0 ? (
          <p className="empty-state">No commands yet</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Path</th>
                <th>Command</th>
                <th>Result</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {state.commandHistory.slice(0, 20).map((cmd) => (
                <tr key={cmd.id}>
                  <td className="mono">{formatTime(cmd.timestamp)}</td>
                  <td><PathBadge path={cmd.routingPath} /></td>
                  <td>{cmd.summary}</td>
                  <td style={{ color: cmd.success ? 'var(--status-ok)' : 'var(--status-error)' }}>
                    {cmd.success ? 'OK' : 'FAIL'}
                  </td>
                  <td className="mono">{cmd.latencyMs != null ? `${cmd.latencyMs}ms` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
