import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useDashboard } from '@/hooks/useDashboard';
import { ModeBadge } from '@/components/ModeBadge';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '◉' },
  { to: '/onboarding', label: 'Setup', icon: '✦' },
  { to: '/tutorial', label: 'Tutorial', icon: '▷' },
  { to: '/app-tests', label: 'App Tests', icon: '◎' },
  { to: '/commands', label: 'Commands', icon: '▸' },
  { to: '/logs', label: 'Logs', icon: '≡' },
  { to: '/modes', label: 'Modes', icon: '◫' },
  { to: '/safety', label: 'Safety', icon: '⛨' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
] as const;

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

function formatDuration(startedAt?: string): string {
  if (!startedAt) return '—';
  const ms = Date.now() - new Date(startedAt).getTime();
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return hrs > 0 ? `${hrs}h ${rem}m` : `${mins}m`;
}

export function Layout() {
  const { state, connection, error } = useDashboard();
  const [onboardingIncomplete, setOnboardingIncomplete] = useState(false);

  useEffect(() => {
    void api.getOnboarding()
      .then((data) => setOnboardingIncomplete(!data.isComplete && !data.progress.dismissed))
      .catch(() => setOnboardingIncomplete(false));
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">DC</div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">DriftCode</span>
            <span className="sidebar-brand-sub">Harness Admin</span>
          </div>
        </div>
        <nav>
          <ul className="nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="main-area">
        <header className="top-bar">
          <div className="top-bar-left">
            {state ? (
              <>
                <ModeBadge modeId={String(state.activeModeId)} label={state.activeModeDisplayName} large />
                {state.emergencyStopActive && (
                  <span className="badge" style={{ color: '#fecaca', borderColor: '#ef4444' }}>
                    E-STOP
                  </span>
                )}
                {state.streamPrivacyActive && (
                  <span className="badge" style={{ color: '#a5f3fc', borderColor: '#06b6d4' }}>
                    PRIVACY
                  </span>
                )}
              </>
            ) : (
              <span className="badge">No session</span>
            )}
          </div>
          <div className="top-bar-right">
            <span className={`connection-indicator ${connection}`}>
              <span className="dot" />
              {connection === 'live' ? 'Live' : connection === 'polling' ? 'Polling' : connection}
            </span>
            {state && (
              <>
                <span>{formatCost(state.sessionCostUsd)} session</span>
                <span>{formatDuration(state.startedAt)}</span>
              </>
            )}
            {error && <span style={{ color: 'var(--status-error)' }}>Offline</span>}
          </div>
        </header>

        {onboardingIncomplete && (
          <div className="onboarding-banner">
            <span>Complete setup to enable microphone transcription and voice commands.</span>
            <Link to="/onboarding" className="btn btn-primary btn-sm">Open wizard</Link>
          </div>
        )}

        <main className="page-content">
          <Outlet context={{ dashboard: state, connection, error }} />
        </main>
      </div>
    </div>
  );
}

export interface LayoutOutletContext {
  dashboard: ReturnType<typeof useDashboard>['state'];
  connection: ReturnType<typeof useDashboard>['connection'];
  error: ReturnType<typeof useDashboard>['error'];
}
