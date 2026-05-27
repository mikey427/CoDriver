import { AdapterType, RuntimeSubsystem } from '@driftcode/shared';
import type { HarnessConfig, ToolRequest, ToolResult } from '@driftcode/shared';
import type { EventBus } from '../event-bus.js';
import type { Session } from '../session.js';
import { createToolResult } from '../helpers/factories.js';

type ObsClient = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  call(requestType: string, requestData?: Record<string, unknown>): Promise<{ requestStatus: { code: number }; responseData?: Record<string, unknown> }>;
};

export class ObsAdapter {
  private client: ObsClient | null = null;
  private connected = false;

  constructor(
    private config: HarnessConfig,
    private session: Session,
    private eventBus: EventBus,
  ) {}

  async initialize(): Promise<void> {
    if (!this.config.obsEnabled || !this.config.obsWebSocketUrl) return;
    try {
      const mod = await import('obs-websocket-js') as { default: new () => ObsClient };
      this.client = new mod.default();
      await this.client.connect();
      this.connected = true;
      this.eventBus.emit('adapter.connected', { adapter: 'obs' }, { subsystem: RuntimeSubsystem.Obs });
    } catch {
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async execute(request: ToolRequest): Promise<ToolResult> {
    if (this.session.emergencyStopActive) {
      return createToolResult({ toolRequest: request, success: false, errorCode: 'EMERGENCY_STOP', errorMessage: 'Emergency stop active' });
    }
    if (!this.client || !this.connected) {
      return createToolResult({ toolRequest: request, success: false, errorCode: 'NOT_CONNECTED', errorMessage: 'OBS not connected — enable obsEnabled in config' });
    }

    const sceneName = String(request.parameters.sceneName ?? request.parameters.name ?? '');
    try {
      if (request.action === 'obs.switchScene' && sceneName) {
        await this.client.call('SetCurrentProgramScene', { sceneName });
        return createToolResult({ toolRequest: request, success: true, message: `Scene: ${sceneName}` });
      }
      if (request.action === 'obs.getScene') {
        const res = await this.client.call('GetCurrentProgramScene');
        const name = res.responseData?.currentProgramSceneName as string | undefined;
        return createToolResult({ toolRequest: request, success: true, message: name ?? 'unknown', structuredData: { sceneName: name } });
      }
      return createToolResult({ toolRequest: request, success: false, errorCode: 'UNKNOWN_ACTION', errorMessage: request.action });
    } catch (err) {
      return createToolResult({ toolRequest: request, success: false, errorCode: 'OBS_ERROR', errorMessage: err instanceof Error ? err.message : 'OBS failed' });
    }
  }
}
