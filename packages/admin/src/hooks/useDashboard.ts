import { useCallback, useEffect, useRef, useState } from 'react';
import { api, parseStreamMessage } from '@/api/client';
import type { DashboardState } from '@/api/types';

export type DashboardConnection = 'connecting' | 'live' | 'polling' | 'offline';

export interface UseDashboardResult {
  state: DashboardState | null;
  connection: DashboardConnection;
  error: string | null;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 2000;
const RECONNECT_DELAY_MS = 3000;

export function useDashboard(): UseDashboardResult {
  const [state, setState] = useState<DashboardState | null>(null);
  const [connection, setConnection] = useState<DashboardConnection>('connecting');
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const clearReconnect = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const closeSse = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const fetchOnce = useCallback(async () => {
    try {
      const next = await api.getDashboardState();
      setState(next);
      setError(null);
      setConnection((prev) => (prev === 'live' ? 'live' : 'polling'));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(message);
      setConnection('offline');
    }
  }, []);

  const startPolling = useCallback(() => {
    clearPoll();
    void fetchOnce();
    pollTimerRef.current = window.setInterval(() => {
      void fetchOnce();
    }, POLL_INTERVAL_MS);
    setConnection('polling');
  }, [clearPoll, fetchOnce]);

  const connectSse = useCallback(() => {
    closeSse();
    clearReconnect();
    setConnection('connecting');

    try {
      const source = new EventSource(api.getDashboardStreamUrl());
      eventSourceRef.current = source;

      source.onopen = () => {
        setConnection('live');
        setError(null);
        clearPoll();
      };

      const handleDashboard = (event: MessageEvent<string>) => {
        const parsed = parseStreamMessage(event.data);
        if (parsed && 'activeModeId' in parsed) {
          setState(parsed);
          setConnection('live');
          setError(null);
        }
      };

      source.addEventListener('dashboard.state', handleDashboard);
      source.onmessage = handleDashboard;

      source.onerror = () => {
        closeSse();
        startPolling();
        reconnectTimerRef.current = window.setTimeout(connectSse, RECONNECT_DELAY_MS);
      };
    } catch {
      startPolling();
    }
  }, [clearPoll, clearReconnect, closeSse, startPolling]);

  useEffect(() => {
    connectSse();
    return () => {
      closeSse();
      clearPoll();
      clearReconnect();
    };
  }, [clearPoll, clearReconnect, closeSse, connectSse]);

  const refresh = useCallback(async () => {
    await fetchOnce();
  }, [fetchOnce]);

  return { state, connection, error, refresh };
}
