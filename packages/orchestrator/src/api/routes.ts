import type { Express, Request, Response } from 'express';
import type { HarnessConfig, UtteranceRequest } from '@driftcode/shared';
import { DEFAULT_MODE_CONFIG_LIST, RuntimeSubsystem } from '@driftcode/shared';
import type { CommandRouter } from '../router/command-router.js';
import type { ConfigStore } from '../config/config-store.js';
import type { AuditLog } from '../logging/audit-log.js';
import type { CostTracker } from '../ai/cost-tracker.js';
import type { EventBus } from '../event-bus.js';
import { buildDashboardState } from './dashboard-state.js';
import type { Session } from '../session.js';
import type { ConfirmationManager } from '../safety/confirmation-manager.js';
import type { VscodeAdapter } from '../adapters/vscode-adapter.js';
import type { AiIntentLayer } from '../ai/ai-intent-layer.js';
import type { ObsAdapter } from '../adapters/obs-adapter.js';

export interface ApiContext {
  session: Session;
  eventBus: EventBus;
  router: CommandRouter;
  configStore: ConfigStore;
  auditLog: AuditLog;
  costTracker: CostTracker;
  confirmations: ConfirmationManager;
  vscode: VscodeAdapter;
  aiLayer: AiIntentLayer;
  obs: ObsAdapter;
}

function dashboardPayload(ctx: ApiContext) {
  return buildDashboardState(ctx.session, ctx.eventBus, ctx.confirmations, ctx.vscode, ctx.aiLayer, ctx.obs);
}

export function registerRoutes(app: Express, ctx: ApiContext): void {
  const sendDashboard = (_req: Request, res: Response) => {
    res.json(dashboardPayload(ctx));
  };

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, sessionId: ctx.session.sessionId });
  });

  app.get('/api/dashboard', sendDashboard);
  app.get('/api/dashboard/state', sendDashboard);

  app.post('/api/utterance', async (req, res) => {
    const body = req.body as UtteranceRequest;
    if (!body?.text || typeof body.text !== 'string') {
      res.status(400).json({ error: 'text field required' });
      return;
    }
    try {
      res.json(await ctx.router.processUtterance(body.text));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Processing failed' });
    }
  });

  app.post('/api/emergency-stop', (_req, res) => {
    const result = ctx.router.activateEmergency('api');
    res.json({ ok: true, result, dashboard: dashboardPayload(ctx) });
  });

  app.post('/api/emergency-clear', (_req, res) => {
    const result = ctx.router.clearEmergency();
    res.json({ ok: true, result, dashboard: dashboardPayload(ctx) });
  });

  app.get('/api/config', (_req, res) => {
    const config = ctx.configStore.get();
    const { openAiApiKey, ...safe } = config;
    res.json({
      config: { ...safe, openAiApiKey: openAiApiKey ? '***configured***' : undefined },
      path: ctx.configStore.getPath(),
    });
  });

  app.put('/api/config', (req, res) => {
    const partial = req.body as Partial<HarnessConfig>;
    const updated = ctx.configStore.update(partial);
    ctx.eventBus.emit('config.updated', { keys: Object.keys(partial) }, { subsystem: RuntimeSubsystem.Admin });
    const { openAiApiKey, ...safe } = updated;
    res.json({ config: { ...safe, openAiApiKey: openAiApiKey ? '***configured***' : undefined } });
  });

  app.get('/api/logs/audit', (req, res) => {
    res.json({ entries: ctx.auditLog.readRecent(Number(req.query.limit ?? 200)) });
  });

  app.get('/api/events', (req, res) => {
    const events = ctx.eventBus.getRecentEvents(Number(req.query.limit ?? 200));
    res.json({ events, total: events.length });
  });

  app.get('/api/logs/events', (req, res) => {
    const events = ctx.eventBus.getRecentEvents(Number(req.query.limit ?? 200));
    res.json({ events });
  });

  app.get('/api/logs/ai-usage', (req, res) => {
    res.json({ events: ctx.costTracker.getEvents(Number(req.query.limit ?? 100)) });
  });

  app.get('/api/modes', (_req, res) => {
    res.json({ modes: DEFAULT_MODE_CONFIG_LIST, activeModeId: ctx.session.activeModeId });
  });

  const streamHandler = (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendDashboardEvent = () => {
      const payload = dashboardPayload(ctx);
      res.write(`event: dashboard.state\ndata: ${JSON.stringify({ type: 'dashboard.state', payload })}\n\n`);
    };

    sendDashboardEvent();

    const unsubscribe = ctx.eventBus.onAny((event) => {
      res.write(`event: runtime.event\ndata: ${JSON.stringify({ type: 'runtime.event', payload: event })}\n\n`);
      if (event.eventType.startsWith('mode.') || event.eventType.startsWith('emergency.') || event.eventType.startsWith('tool.')) {
        sendDashboardEvent();
      }
    });

    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  };

  app.get('/api/events/stream', streamHandler);
  app.get('/api/dashboard/stream', streamHandler);
}
