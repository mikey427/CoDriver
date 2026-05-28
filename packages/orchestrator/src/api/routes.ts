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
import type { SpeechInputService } from '../services/speech-input-service.js';
import type { OnboardingStore } from '../onboarding/onboarding-store.js';
import type { PracticeEvaluator } from '../onboarding/practice-evaluator.js';
import type { PatchStore } from '../services/patch-store.js';
import { STT_PROVIDERS, TUTORIAL_LESSONS, ONBOARDING_CHECKLIST } from '@driftcode/shared';
import type { OnboardingStepId } from '@driftcode/shared';

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
  speech?: SpeechInputService;
  onboarding: OnboardingStore;
  practice: PracticeEvaluator;
  patchStore: PatchStore;
}

function dashboardPayload(ctx: ApiContext) {
  return buildDashboardState(ctx.session, ctx.eventBus, ctx.confirmations, ctx.vscode, ctx.aiLayer, ctx.obs, ctx.speech);
}

export function registerRoutes(app: Express, ctx: ApiContext): void {
  const sendDashboard = (_req: Request, res: Response) => {
    res.json(dashboardPayload(ctx));
  };

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      sessionId: ctx.session.sessionId,
      aiProviderId: ctx.aiLayer.getProviderId(),
      emergencyStopActive: ctx.session.emergencyStopActive,
    });
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

  app.get('/api/patch/pending', (_req, res) => {
    const patch = ctx.patchStore.get();
    res.json({ patch: patch ? { id: patch.id, path: patch.path, summary: patch.summary, createdAt: patch.createdAt } : null });
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
    ctx.speech?.refreshConfig(updated);
    ctx.router.refreshConfig(updated);
    ctx.aiLayer.updateConfig(updated);
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

  app.get('/api/speech/status', (_req, res) => {
    res.json(ctx.speech?.getStatus() ?? { connected: false, pttActive: false, providerId: 'none', inboxPath: '' });
  });

  app.post('/api/speech/ptt/down', (_req, res) => {
    ctx.speech?.pttDown('api');
    res.json({ ok: true, pttActive: true });
  });

  app.post('/api/speech/ptt/up', async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : undefined;
    const result = ctx.speech ? await ctx.speech.pttUp(text) : { processed: false };
    res.json({ ok: true, ...result, dashboard: dashboardPayload(ctx) });
  });

  app.post('/api/speech/ingest', async (req, res) => {
    const text = req.body?.text;
    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'text required' });
      return;
    }
    await ctx.speech?.ingestText(text.trim(), 'api');
    res.json({ ok: true, dashboard: dashboardPayload(ctx) });
  });

  app.get('/api/app-test/flows', (_req, res) => {
    res.json({ flows: ctx.configStore.get().appTestFlows ?? [] });
  });

  app.put('/api/app-test/flows', (req, res) => {
    const flows = req.body?.flows;
    if (!Array.isArray(flows)) {
      res.status(400).json({ error: 'flows array required' });
      return;
    }
    ctx.configStore.update({ appTestFlows: flows });
    ctx.router.refreshConfig(ctx.configStore.get());
    res.json({ flows: ctx.configStore.get().appTestFlows ?? [] });
  });

  app.get('/api/stt/providers', (_req, res) => {
    res.json({ providers: STT_PROVIDERS, activeId: ctx.configStore.get().sttProviderId ?? 'http-inbox' });
  });

  app.post('/api/speech/transcribe', async (req, res) => {
    const audioBase64 = req.body?.audioBase64;
    if (typeof audioBase64 !== 'string' || !audioBase64.length) {
      res.status(400).json({ error: 'audioBase64 required' });
      return;
    }
    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : 'audio/webm';
    const processAsCommand = req.body?.processAsCommand !== false;
    try {
      const audio = Buffer.from(audioBase64, 'base64');
      if (!ctx.speech) {
        res.status(503).json({ error: 'Speech service unavailable' });
        return;
      }
      const outcome = await ctx.speech.transcribeAndIngest(audio, mimeType, processAsCommand);
      res.json({
        ok: true,
        transcript: outcome.transcript,
        processed: outcome.processed,
        dashboard: processAsCommand ? dashboardPayload(ctx) : undefined,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Transcription failed' });
    }
  });

  app.get('/api/onboarding', (_req, res) => {
    const config = ctx.configStore.get();
    const progress = ctx.onboarding.get();
    res.json({
      progress,
      isComplete: ctx.onboarding.isComplete() || config.onboardingCompleted === true,
      checklist: ONBOARDING_CHECKLIST,
      steps: progress.steps,
      tutorialLessons: TUTORIAL_LESSONS,
      prerequisites: {
        orchestrator: true,
        openai: Boolean(config.openAiApiKey),
        stt: Boolean(config.sttProviderId),
        vscode: ctx.vscode.isConnected(),
        mic: progress.micTestPassed ?? false,
        tutorial: progress.tutorialCompletedIds.length >= 3,
      },
    });
  });

  app.post('/api/onboarding/step', (req, res) => {
    const stepId = req.body?.stepId as OnboardingStepId | undefined;
    const completed = req.body?.completed !== false;
    if (!stepId) {
      res.status(400).json({ error: 'stepId required' });
      return;
    }
    const progress = ctx.onboarding.setStep(stepId, completed);
    if (stepId === 'complete') {
      ctx.configStore.update({ onboardingCompleted: true });
    }
    res.json({ progress, isComplete: ctx.onboarding.isComplete() });
  });

  app.post('/api/onboarding/advance', (_req, res) => {
    const next = ctx.onboarding.nextStep();
    const progress = ctx.onboarding.advanceTo(next);
    res.json({ progress, nextStep: next });
  });

  app.post('/api/onboarding/dismiss', (_req, res) => {
    res.json({ progress: ctx.onboarding.dismiss() });
  });

  app.post('/api/onboarding/reset', (_req, res) => {
    ctx.configStore.update({ onboardingCompleted: false });
    res.json({ progress: ctx.onboarding.reset() });
  });

  app.post('/api/onboarding/mic-test', async (req, res) => {
    const audioBase64 = req.body?.audioBase64;
    if (typeof audioBase64 !== 'string') {
      res.status(400).json({ error: 'audioBase64 required' });
      return;
    }
    try {
      const audio = Buffer.from(audioBase64, 'base64');
      const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : 'audio/webm';
      const outcome = await ctx.speech!.transcribeAndIngest(audio, mimeType, false);
      const passed = outcome.transcript.length > 0;
      ctx.onboarding.setMicTestPassed(passed);
      res.json({ passed, transcript: outcome.transcript, progress: ctx.onboarding.get() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Mic test failed' });
    }
  });

  app.get('/api/tutorial/lessons', (_req, res) => {
    res.json({
      lessons: TUTORIAL_LESSONS,
      completedIds: ctx.onboarding.get().tutorialCompletedIds,
    });
  });

  app.post('/api/tutorial/practice', (req, res) => {
    const lessonId = req.body?.lessonId;
    const text = req.body?.text;
    if (typeof lessonId !== 'string' || typeof text !== 'string') {
      res.status(400).json({ error: 'lessonId and text required' });
      return;
    }
    const dryRun = req.body?.dryRun !== false;
    const result = ctx.practice.evaluate(lessonId, text);
    if (result.passed) {
      ctx.onboarding.markTutorialLesson(lessonId);
      if (ctx.onboarding.get().tutorialCompletedIds.length >= 3) {
        ctx.onboarding.setStep('tutorial', true);
      }
    }
    if (!dryRun && result.passed) {
      void ctx.router.processUtterance(text);
    }
    res.json({ ...result, completedIds: ctx.onboarding.get().tutorialCompletedIds });
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
      if (
        event.eventType.startsWith('mode.') ||
        event.eventType.startsWith('emergency.') ||
        event.eventType.startsWith('tool.') ||
        event.eventType.startsWith('utterance.') ||
        event.eventType.startsWith('confirmation.') ||
        event.eventType.startsWith('intent.')
      ) {
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
