import type { RuntimeEvent } from './models.js';
import type {
  AiTaskStatus,
  AiTaskType,
  ConfidenceBand,
  ConnectionHealth,
  DevServerStatus,
  FocusTarget,
  IntentType,
  ModeId,
  RiskTier,
  RuntimeEventSeverity,
  RuntimeSubsystem,
} from './enums.js';

/** Local orchestrator JSON config persisted to ~/.driftcode/config.json */
export interface HarnessConfig {
  schemaVersion: number;
  serverPort: number;
  defaultProfileId: string;
  defaultModeId: ModeId | string;
  openAiApiKey?: string;
  openAiModel: string;
  sessionCostBudgetUsd?: number;
  emergencyPhrases: string[];
  terminalAllowlist: string[];
  terminalBlocklist: string[];
  customVocabulary: string[];
  speechCorrections: Array<{ misrecognition: string; correction: string }>;
  /** Project workspace root for terminal/dev server */
  projectRoot?: string;
  devServerCommand?: string;
  devServerUrl?: string;
  devServerPort?: number;
  devServerReadyTimeoutMs?: number;
  browserProfilePath?: string;
  browserHeadless?: boolean;
  browserDomainAllowlist?: string[];
  obsEnabled?: boolean;
  obsWebSocketUrl?: string;
  protectedFileGlobs?: string[];
  appTestFlows?: HarnessAppTestFlow[];
  sttProviderId?: string;
  sttModel?: string;
  sttLanguage?: string;
  sttFallbackProviderId?: string;
  speechInboxPath?: string;
  speechInboxEnabled?: boolean;
  onboardingCompleted?: boolean;
  /** AI backend: `openai` (default) or `fake` for deterministic tests. Overridden by DRIFTCODE_AI_PROVIDER=fake. */
  aiProviderId?: 'openai' | 'fake';
}

export interface HarnessAppTestStep {
  type: 'navigate' | 'click' | 'fill' | 'assertText' | 'wait';
  selector?: string;
  value?: string;
  url?: string;
  text?: string;
  timeoutMs?: number;
}

export interface HarnessAppTestFlow {
  id: string;
  name: string;
  description?: string;
  steps: HarnessAppTestStep[];
}

export interface DashboardEditorState {
  timestamp: string;
  connectionStatus: ConnectionHealth;
  hasActiveEditor: boolean;
  activeFilePath?: string;
  activeFileBasename?: string;
  cursorLine?: number;
  cursorCharacter?: number;
  languageId?: string;
  errorCount?: number;
  warningCount?: number;
}

export interface DashboardUtterance {
  id: string;
  rawText: string;
  normalizedText: string;
  timestamp: string;
  isEmergencyPhrase: boolean;
}

export interface DashboardParsedIntent {
  id: string;
  summary: string;
  routingPath: 'deterministic' | 'ai' | 'blocked';
  intentType: IntentType | string;
  confidence: number;
  confidenceBand: ConfidenceBand | string;
}

export interface DashboardPendingConfirmation {
  id: string;
  actionSummary: string;
  requiredPhrase: string;
  riskTier: RiskTier | string;
  expiresAt?: string;
}

export interface DashboardActiveAiTask {
  summary: string;
  taskType: AiTaskType | string;
  status: AiTaskStatus | string;
}

export interface DashboardCommandHistoryEntry {
  id: string;
  timestamp: string;
  routingPath: 'deterministic' | 'ai' | 'blocked';
  summary: string;
  success: boolean;
  latencyMs?: number;
  modeId?: ModeId | string;
  aiInvoked?: boolean;
}

export interface DashboardAdapterHealth {
  vscode: ConnectionHealth;
  terminal: ConnectionHealth;
  browser: ConnectionHealth;
  openai: ConnectionHealth;
  stt?: ConnectionHealth;
  obs?: ConnectionHealth;
  admin?: ConnectionHealth;
}

export interface DashboardState {
  sessionId: string;
  activeModeId: ModeId | string;
  activeModeDisplayName: string;
  previousModeId?: ModeId | string;
  activeProfileId: string;
  activeProjectId?: string;
  emergencyStopActive: boolean;
  streamPrivacyActive: boolean;
  pendingConfirmations: DashboardPendingConfirmation[];
  lastNormalizedUtterance?: DashboardUtterance;
  lastParsedIntent?: DashboardParsedIntent;
  editorState?: DashboardEditorState;
  browserState?: { connected: boolean; url?: string; domain?: string };
  focusTarget: FocusTarget | string;
  adapterHealth: DashboardAdapterHealth;
  sessionCostUsd: number;
  aiCallsThisSession: number;
  deterministicCommandStreak: number;
  devServerStatus: DevServerStatus | string;
  eventSequence: number;
  commandHistory: DashboardCommandHistoryEntry[];
  activeAiTask?: DashboardActiveAiTask;
  pendingPatchSummary?: string;
  recentEvents?: RuntimeEvent[];
  speechStatus?: { pttActive: boolean; providerId: string; inboxPath: string; lastTranscript?: string };
  startedAt: string;
  updatedAt: string;
}

export interface UtteranceRequest {
  text: string;
  confidence?: number;
}

export interface UtteranceResponse {
  utterance: DashboardUtterance;
  intent: DashboardParsedIntent;
  toolResults: Array<{ success: boolean; message?: string; errorCode?: string }>;
  blocked: boolean;
  message?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: string;
  action: string;
  actor: string;
  details: Record<string, unknown>;
  success: boolean;
}

export interface RuntimeEventMap {
  'session.started': { profileId: string; modeId: ModeId | string };
  'session.updated': Partial<DashboardState>;
  'utterance.received': { rawText: string };
  'utterance.normalized': { utterance: DashboardUtterance };
  'intent.parsed': { intent: DashboardParsedIntent };
  'mode.entered': { modeId: ModeId | string; previousModeId: ModeId | string };
  'mode.exited': { modeId: ModeId | string };
  'mode.blocked': { targetModeId: ModeId | string; reason: string };
  'emergency.activated': { source: string };
  'emergency.cleared': Record<string, never>;
  'tool.requested': { action: string; adapter: string };
  'tool.completed': { success: boolean; action: string };
  'tool.blocked': { reason: string; intentId: string };
  'confirmation.queued': { confirmation: DashboardPendingConfirmation };
  'confirmation.resolved': { confirmationId: string; approved: boolean };
  'ai.usage': { costUsd: number; model: string };
  'adapter.connected': { adapter: string };
  'adapter.disconnected': { adapter: string };
  'config.loaded': { path: string };
  'config.updated': { keys: string[] };
  'audit.entry': { entry: AuditLogEntry };
}

export type RuntimeEventType = keyof RuntimeEventMap;

export type Subsystem = RuntimeSubsystem;
export type Severity = RuntimeEventSeverity;

export interface EventsQuery {
  severity?: RuntimeEventSeverity;
  subsystem?: RuntimeSubsystem;
  routingPath?: 'deterministic' | 'ai' | 'blocked';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface EventsResponse {
  events: RuntimeEvent[];
  total: number;
}
