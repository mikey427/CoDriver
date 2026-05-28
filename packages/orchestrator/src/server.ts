import http from 'node:http';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pino from 'pino';
import { WebSocketServer, WebSocket } from 'ws';
import type { RuntimeEvent } from '@driftcode/shared';
import { RuntimeSubsystem } from '@driftcode/shared';
import { ConfigStore } from './config/config-store.js';
import { EventBus } from './event-bus.js';
import { Session } from './session.js';
import { ModeManager } from './modes/mode-manager.js';
import { UtteranceNormalizer } from './pipeline/utterance-normalizer.js';
import { IntentParser } from './pipeline/intent-parser.js';
import { ConfirmationManager } from './safety/confirmation-manager.js';
import { VscodeAdapter } from './adapters/vscode-adapter.js';
import { TerminalAdapter } from './adapters/terminal-adapter.js';
import { BrowserAdapter } from './adapters/browser-adapter.js';
import { CostTracker } from './ai/cost-tracker.js';
import { AiIntentLayer } from './ai/ai-intent-layer.js';
import { AuditLog } from './logging/audit-log.js';
import { CommandRouter } from './router/command-router.js';
import { ObsAdapter } from './adapters/obs-adapter.js';
import { PatchStore } from './services/patch-store.js';
import { DevServerManager } from './services/dev-server-manager.js';
import { AudioFeedback } from './services/audio-feedback.js';
import { SpeechInputService } from './services/speech-input-service.js';
import { SttManager } from './stt/stt-manager.js';
import { OnboardingStore } from './onboarding/onboarding-store.js';
import { PracticeEvaluator } from './onboarding/practice-evaluator.js';
import { buildDashboardState } from './api/dashboard-state.js';
import { registerRoutes } from './api/routes.js';

export interface OrchestratorServer {
  port: number;
  host: string;
  close: () => Promise<void>;
}

export async function createServer(): Promise<OrchestratorServer> {
  const log = pino({ name: 'driftcode-orchestrator' });
  const configStore = new ConfigStore();
  const config = configStore.get();

  const session = new Session(config);
  const eventBus = new EventBus(session.sessionId);
  const auditLog = new AuditLog(configStore.getPath());
  auditLog.wire(eventBus);

  const modeManager = new ModeManager(session, eventBus);
  const normalizer = new UtteranceNormalizer(config);
  const parser = new IntentParser(session, modeManager);
  const confirmations = new ConfirmationManager(eventBus);
  const vscode = new VscodeAdapter(session, eventBus, log);
  const terminal = new TerminalAdapter(config, session);
  const browser = new BrowserAdapter(config, session, eventBus);
  const obs = new ObsAdapter(config, session, eventBus);
  const patchStore = new PatchStore();
  const devServer = new DevServerManager(config, session);
  const audio = new AudioFeedback(log);
  const costTracker = new CostTracker();
  const aiLayer = new AiIntentLayer(config, session, eventBus, costTracker, log, vscode, patchStore);
  await aiLayer.initialize();
  await obs.initialize();

  const router = new CommandRouter(
    session,
    eventBus,
    modeManager,
    normalizer,
    parser,
    confirmations,
    vscode,
    terminal,
    browser,
    aiLayer,
    auditLog,
    patchStore,
    devServer,
    obs,
    audio,
    config,
  );

  const sttManager = new SttManager(config, log);
  await sttManager.ensureClient();

  const onboarding = new OnboardingStore(dirname(configStore.getPath()));
  const practice = new PracticeEvaluator(normalizer, parser);

  const speech = new SpeechInputService(config, session, router, eventBus, log, configStore.getPath(), sttManager);
  if (config.speechInboxEnabled !== false) {
    speech.start();
  }

  eventBus.emit(
    'session.started',
    { profileId: session.activeProfileId, modeId: session.activeModeId },
    { subsystem: RuntimeSubsystem.Orchestrator, message: 'DriftCode Harness session started' },
  );
  eventBus.emit('config.loaded', { path: configStore.getPath() }, { subsystem: RuntimeSubsystem.Orchestrator });

  auditLog.append('session', 'started', { sessionId: session.sessionId, configPath: configStore.getPath() });

  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  app.options('*', (_req, res) => {
    res.sendStatus(204);
  });

  const apiCtx = {
    session,
    eventBus,
    router,
    configStore,
    auditLog,
    costTracker,
    confirmations,
    vscode,
    aiLayer,
    obs,
    speech,
    onboarding,
    practice,
    patchStore,
  };

  registerRoutes(app, apiCtx);

  const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
  const adminDist = path.join(repoRoot, 'packages/admin/dist');
  const overlayDir = path.join(repoRoot, 'overlay');

  app.use('/admin', express.static(adminDist, { index: 'index.html' }));
  app.get('/admin/*', (_req, res) => {
    res.sendFile(path.join(adminDist, 'index.html'));
  });

  app.use('/overlay', express.static(overlayDir));
  app.get('/overlay', (_req, res) => {
    res.sendFile(path.join(overlayDir, 'index.html'));
  });

  const host = '127.0.0.1';
  const port = config.serverPort;

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  const adminClients = new Set<WebSocket>();

  const broadcastAdmin = (payload: unknown) => {
    const msg = JSON.stringify(payload);
    for (const client of adminClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  };

  eventBus.onAny((event: RuntimeEvent) => {
    broadcastAdmin({ type: 'runtime.event', payload: event });
    if (
      event.eventType.startsWith('mode.') ||
      event.eventType.startsWith('emergency.') ||
      event.eventType.startsWith('tool.') ||
      event.eventType.startsWith('utterance.') ||
      event.eventType.startsWith('confirmation.') ||
      event.eventType.startsWith('intent.')
    ) {
      broadcastAdmin({
        type: 'dashboard.state',
        payload: buildDashboardState(session, eventBus, confirmations, vscode, aiLayer, obs, speech),
      });
    }
  });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = request.url ?? '';

    if (url.startsWith('/ws/vscode')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        vscode.attach(ws);
      });
      return;
    }

    if (url.startsWith('/ws/admin')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        adminClients.add(ws);
        ws.send(
          JSON.stringify({
            type: 'dashboard.state',
            payload: buildDashboardState(session, eventBus, confirmations, vscode, aiLayer, obs, speech),
          }),
        );
        ws.on('close', () => adminClients.delete(ws));
      });
      return;
    }

    socket.destroy();
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => {
      log.info({ host, port, configPath: configStore.getPath() }, 'DriftCode orchestrator listening');
      resolve();
    });
  });

  return {
    host,
    port,
    close: () =>
      new Promise((resolve, reject) => {
        speech.stop();
        for (const client of adminClients) {
          client.close();
        }
        wss.close();
        httpServer.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
