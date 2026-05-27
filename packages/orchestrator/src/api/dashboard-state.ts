import { ConnectionHealth, DevServerStatus, DiagnosticSeverity } from '@driftcode/shared';
import type { DashboardEditorState, DashboardState } from '@driftcode/shared';
import type { EventBus } from '../event-bus.js';
import type { ConfirmationManager } from '../safety/confirmation-manager.js';
import type { Session } from '../session.js';
import type { VscodeAdapter } from '../adapters/vscode-adapter.js';
import type { AiIntentLayer } from '../ai/ai-intent-layer.js';
import { defaultAdapterHealth } from '../helpers/factories.js';

function toDashboardEditor(session: Session): DashboardEditorState | undefined {
  const e = session.editorState;
  if (!e.connected && !e.activeFilePath) return undefined;
  const errors = e.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error).length;
  const warnings = e.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Warning).length;
  return {
    timestamp: e.timestamp,
    connectionStatus: e.connected ? ConnectionHealth.Connected : ConnectionHealth.Disconnected,
    hasActiveEditor: Boolean(e.activeFilePath),
    activeFilePath: e.activeFilePath,
    activeFileBasename: e.activeFilePath?.split(/[/\\]/).pop(),
    cursorLine: e.cursorLine,
    cursorCharacter: e.cursorCharacter,
    languageId: e.activeLanguageId,
    errorCount: errors,
    warningCount: warnings,
  };
}

export function buildDashboardState(
  session: Session,
  eventBus: EventBus,
  confirmations: ConfirmationManager,
  vscode: VscodeAdapter,
  aiLayer: AiIntentLayer,
  obs?: { isConnected(): boolean },
): DashboardState {
  const health = defaultAdapterHealth();
  health.vscode = vscode.getConnectionHealth();
  health.openai = aiLayer.isEnabledForMode(session.activeModeId) ? ConnectionHealth.Connected : ConnectionHealth.Disconnected;
  health.browser = session.browserState.connected ? ConnectionHealth.Connected : ConnectionHealth.Disconnected;
  health.obs = obs?.isConnected() ? ConnectionHealth.Connected : ConnectionHealth.Disconnected;

  return {
    sessionId: session.sessionId,
    activeModeId: session.activeModeId,
    activeModeDisplayName: session.activeModeDisplayName,
    previousModeId: session.previousModeId,
    activeProfileId: session.activeProfileId,
    activeProjectId: session.activeProjectId,
    emergencyStopActive: session.emergencyStopActive,
    streamPrivacyActive: session.streamPrivacyActive,
    pendingConfirmations: confirmations.getPending(),
    lastNormalizedUtterance: session.lastNormalizedUtterance,
    lastParsedIntent: session.lastParsedIntent,
    editorState: toDashboardEditor(session),
    browserState: session.browserState,
    focusTarget: session.focusTarget,
    adapterHealth: health,
    sessionCostUsd: session.sessionCostUsd,
    aiCallsThisSession: session.aiCallsThisSession,
    deterministicCommandStreak: session.deterministicCommandStreak,
    devServerStatus: session.devServerStatus ?? DevServerStatus.Stopped,
    pendingPatchSummary: session.pendingPatchSummary,
    activeAiTask: session.activeAiTask,
    eventSequence: eventBus.getSequence(),
    commandHistory: session.commandHistory,
    recentEvents: eventBus.getRecentEvents(50),
    startedAt: session.startedAt,
    updatedAt: new Date().toISOString(),
  };
}
