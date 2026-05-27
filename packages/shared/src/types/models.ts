import type {
  AdapterType,
  AiAutonomyLevel,
  AiResponsesDefault,
  AiStatus,
  AiTaskCancelledBy,
  AiTaskStatus,
  AiTaskType,
  AiUsageOperation,
  AliasMatchMode,
  AliasTargetType,
  AppTestOnFailure,
  AppTestRunStatus,
  AppTestStatus,
  AppTestStepType,
  AudioOutputRoute,
  BrowserPageStatus,
  BrowserPrivacyIndicator,
  ButtonActionType,
  ButtonInputType,
  ConfirmationPolicy,
  ConfirmationResolvedBy,
  ConfirmationType,
  ConfidenceBand,
  ConnectionHealth,
  DeviceType,
  DevServerStatus,
  DiagnosticSeverity,
  EditSource,
  ErrorFeedback,
  EstimatedImpact,
  ExternalUrlPolicy,
  FailureBehavior,
  FocusTarget,
  IntentType,
  IsoDateTime,
  LogRedactionLevel,
  MacroStepType,
  ModeId,
  ObsPermissionLevel,
  PackageManager,
  ParsePath,
  PendingConfirmationStatus,
  ResponseLength,
  RiskTier,
  RuntimeEventSeverity,
  RuntimeSubsystem,
  SpeechCorrectionMatchType,
  SpeechCorrectionScope,
  StreamAudioDefault,
  StreamOverlayLayoutMode,
  StreamOverlayVisibility,
  TerminalCommandClassification,
  TerminalCommandSource,
  TerminalCommandStatus,
  ToolRequestPriority,
  ToolRequestSource,
  ToolRequestStatus,
  ToolResultType,
  UtteranceSource,
  VoiceCommandCategory,
  VoiceCommandSlotType,
} from './enums.js';

export interface SpeechCorrection {
  id: string;
  schemaVersion: number;
  scope: SpeechCorrectionScope;
  scopeId?: string;
  misrecognition: string;
  correction: string;
  matchType: SpeechCorrectionMatchType;
  caseSensitive: boolean;
  wholeWordOnly: boolean;
  priority: number;
  enabled: boolean;
  usageCount: number;
  lastUsedAt?: IsoDateTime;
  suggestedBySystem: boolean;
  sourceUtteranceId?: string;
  notes?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface NormalizedUtterance {
  id: string;
  schemaVersion: number;
  sessionId: string;
  rawTranscript: string;
  normalizedText: string;
  source: UtteranceSource;
  sttProviderId: string;
  sttConfidence: number;
  language: string;
  pttDurationMs?: number;
  buttonBindingId?: string;
  modeIdAtCapture: ModeId | string;
  profileId: string;
  projectId?: string;
  appliedCorrections: SpeechCorrection[];
  appliedAliasPreviews: string[];
  appliedAliasIds: string[];
  tokens?: string[];
  wordCount: number;
  isEmergencyPhrase: boolean;
  isEmpty: boolean;
  isTooShortForAi: boolean;
  capturedAt: IsoDateTime;
  metadata?: Record<string, unknown>;
}

export interface AlternativeIntent {
  intentType: IntentType;
  confidence: number;
  commandId?: string;
}

export interface ParsedIntent {
  id: string;
  schemaVersion: number;
  utteranceId: string;
  sessionId: string;
  path: ParsePath;
  intentType: IntentType;
  commandId?: string;
  aliasId?: string;
  confidence: number;
  confidenceBand: ConfidenceBand;
  modeId: ModeId | string;
  slots: Record<string, unknown>;
  literalPayload?: string;
  targetAdapter?: AdapterType;
  requiresAiFallback: boolean;
  blockedReason?: string;
  alternativeIntents?: AlternativeIntent[];
  parseTrace?: string[];
  parsedAt: IsoDateTime;
}

export interface VoiceCommandSlotDefinition {
  type: VoiceCommandSlotType;
  required: boolean;
  enum?: string[];
  description?: string;
}

export type VoiceCommandSlotSchema = Record<string, VoiceCommandSlotDefinition>;

export interface VoiceCommandProfileOverride {
  enabled?: boolean;
  requiresConfirmation?: boolean;
}

export interface VoiceCommand {
  id: string;
  schemaVersion: number;
  displayName: string;
  description: string;
  category: VoiceCommandCategory;
  grammarPatterns: string[];
  slotSchema?: VoiceCommandSlotSchema;
  targetAdapter: AdapterType;
  adapterAction: string;
  allowedModeIds: Array<ModeId | string>;
  defaultRiskTier: RiskTier;
  requiresConfirmation: boolean;
  enabled: boolean;
  isBuiltIn: boolean;
  profileOverrides?: Record<string, VoiceCommandProfileOverride>;
  examples?: string[];
  tags?: string[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface MacroStep {
  order: number;
  type: MacroStepType;
  commandId?: string;
  modeId?: ModeId | string;
  delayMs?: number;
  slotOverrides?: Record<string, unknown>;
}

export interface CommandAlias {
  id: string;
  schemaVersion: number;
  profileId: string;
  projectId?: string;
  phrase: string;
  matchMode: AliasMatchMode;
  fuzzyThreshold?: number;
  targetType: AliasTargetType;
  targetCommandId?: string;
  targetModeId?: ModeId | string;
  snippetText?: string;
  macroSteps?: MacroStep[];
  slotDefaults?: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  usageCount: number;
  lastUsedAt?: IsoDateTime;
  notes?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ModeConfig {
  id: ModeId | string;
  schemaVersion: number;
  displayName: string;
  description: string;
  purpose: string;
  enterPhrases: string[];
  exitPhrases: string[];
  enterButtonBindingId?: string;
  exitButtonBindingId?: string;
  openAiEnabledDefault: boolean;
  allowedToolIds: string[];
  aiAutonomyLevel: AiAutonomyLevel;
  defaultResponseLength: ResponseLength;
  confirmationPolicy: ConfirmationPolicy;
  overlayTemplateId?: string;
  audioRoutingOverrideId?: string;
  availableCommandCategories: VoiceCommandCategory[];
  deterministicGrammarSetId?: string;
  failureBehavior: FailureBehavior;
  streamOverlayVisibility: StreamOverlayVisibility;
  privateAudioDefault: AudioOutputRoute;
  streamAudioDefault: StreamAudioDefault;
  sortOrder: number;
  isSystemMode: boolean;
  enabled: boolean;
}

export interface ButtonBinding {
  id: string;
  schemaVersion: number;
  profileId: string;
  name: string;
  label?: string;
  deviceId: string;
  deviceType: DeviceType;
  inputType: ButtonInputType;
  inputCode: string;
  modifierKeys?: string[];
  actionType: ButtonActionType;
  targetModeId?: ModeId | string;
  targetCommandId?: string;
  debounceMs: number;
  requireHoldMs?: number;
  repeatEnabled: boolean;
  enabled: boolean;
  priority: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AudioRoutingConfig {
  id: string;
  schemaVersion: number;
  name: string;
  defaultOutput: AudioOutputRoute;
  modeOverrides?: Record<string, AudioOutputRoute>;
  privateDeviceId?: string;
  streamDeviceId?: string;
  beepSoundId?: string;
  beepVolume: number;
  ttsSpeed: number;
  ttsVolume: number;
  maxSpeechDurationSec: number;
  interruptEnabled: boolean;
  confirmationsPrivateOnly: boolean;
  aiResponsesDefault: AiResponsesDefault;
  errorFeedback: ErrorFeedback;
  modeEntryChime: boolean;
  successChime: boolean;
  failureChime: boolean;
}

export interface ProfileConfig {
  id: string;
  schemaVersion: number;
  name: string;
  description?: string;
  isDefault: boolean;
  defaultModeId: ModeId | string;
  safetyConfigId: string;
  audioRoutingConfigId: string;
  overlayProfileId?: string;
  sttProviderId: string;
  sttFallbackProviderId?: string;
  ttsProviderId: string;
  ttsVoiceId?: string;
  openAiModelDefault: string;
  openAiModelByMode?: Record<string, string>;
  aiVerbosityDefault: ResponseLength;
  askBeforeExpensiveAiCalls: boolean;
  expensiveCallThresholdTokens?: number;
  sessionCostBudgetUsd?: number;
  sessionCostHardStopUsd?: number;
  buttonBindings: ButtonBinding[];
  commandAliasIds: string[];
  modeOverrides?: Record<string, Partial<ModeConfig>>;
  wakePhraseEnabled: boolean;
  wakePhrase?: string;
  emergencyPhrases: string[];
  focusRecoveryEnabled: boolean;
  focusRecoveryDelaySec?: number;
  micDeviceId?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ProjectConfig {
  id: string;
  schemaVersion: number;
  name: string;
  rootPath: string;
  vscodeWorkspaceFile?: string;
  defaultProfileId?: string;
  devServerCommand?: string;
  devServerReadyUrl?: string;
  devServerReadyTimeoutMs?: number;
  devServerPort?: number;
  localAppUrl?: string;
  terminalAllowlist: string[];
  terminalBlocklist: string[];
  terminalDefaultShell?: string;
  protectedPaths: string[];
  aiEditablePaths: string[];
  readOnlyPaths?: string[];
  customVocabulary: string[];
  speechCorrections: SpeechCorrection[];
  appTestFlowIds: string[];
  packageManager?: PackageManager;
  installCommand?: string;
  testCommand?: string;
  buildCommand?: string;
  gitRemotePublishBlocked: boolean;
  browserAllowedDomains?: string[];
  browserBlockedDomains?: string[];
  envFilePatterns: string[];
  secretFilePatterns: string[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ConfirmationPhrases {
  execute: string;
  destructive: string;
  publish: string;
  stream_change: string;
  safety_change: string;
}

export interface SafetyConfig {
  id: string;
  schemaVersion: number;
  name: string;
  requireConfirmationForMediumRisk: boolean;
  mediumRiskAutoConfirmModeIds?: string[];
  dangerousAlwaysConfirm: boolean;
  confirmationPhrases: ConfirmationPhrases;
  confirmationTimeoutSec: number;
  allowVoiceConfirm: boolean;
  allowButtonConfirm: boolean;
  blockedCommandPatterns: string[];
  blockedShellCommands: string[];
  blockedGitCommands: string[];
  secretRedactionEnabled: boolean;
  secretPatterns: string[];
  streamPrivacyDefault: boolean;
  redactFromOverlay: boolean;
  redactFromStreamAudio: boolean;
  redactFromLogs: LogRedactionLevel;
  maxFilesPerPatchWithoutConfirm: number;
  maxLinesPerPatchWithoutConfirm?: number;
  allowPackageInstall: boolean;
  allowGitPush: boolean;
  allowGitForce: boolean;
  allowDeployPublish: boolean;
  allowObsSceneChange: ObsPermissionLevel;
  allowObsStreamStartStop: ObsPermissionLevel;
  allowExternalUrls: ExternalUrlPolicy;
  allowReadEnvFiles: boolean;
  safetySettingsLocked: boolean;
  auditLogRetentionDays: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface RiskClassification {
  id: string;
  schemaVersion: number;
  sessionId: string;
  sourceIntentId?: string;
  sourceToolRequestId?: string;
  actionSummary: string;
  actionKey: string;
  adapter: AdapterType;
  riskTier: RiskTier;
  confirmationRequired: boolean;
  confirmationType?: ConfirmationType;
  requiredPhrase?: string;
  blockReason?: string;
  matchedBlockPattern?: string;
  affectedResources: string[];
  estimatedImpact?: EstimatedImpact;
  secretExposureRisk: boolean;
  streamExposureRisk: boolean;
  promptInjectionRisk: boolean;
  evaluatedRules?: string[];
  evaluatedAt: IsoDateTime;
}

export interface PendingConfirmation {
  id: string;
  schemaVersion: number;
  sessionId: string;
  riskClassificationId: string;
  toolRequestId?: string;
  parsedIntentId?: string;
  batchToolRequestIds?: string[];
  confirmationType: ConfirmationType;
  requiredPhrase: string;
  promptTextPrivate: string;
  promptTextOverlay: string;
  promptTextShort: string;
  status: PendingConfirmationStatus;
  createdAt: IsoDateTime;
  expiresAt: IsoDateTime;
  resolvedAt?: IsoDateTime;
  resolvedBy?: ConfirmationResolvedBy;
  confirmUtteranceId?: string;
  denyReason?: string;
}

export interface RuntimeEvent {
  id: string;
  schemaVersion: number;
  sessionId: string;
  sequenceNumber: number;
  timestamp: IsoDateTime;
  eventType: string;
  severity: RuntimeEventSeverity;
  subsystem: RuntimeSubsystem;
  correlationId?: string;
  utteranceId?: string;
  intentId?: string;
  aiTaskId?: string;
  toolRequestId?: string;
  toolResultId?: string;
  payload: Record<string, unknown>;
  payloadStreamSafe?: Record<string, unknown>;
  message?: string;
  durationMs?: number;
  success?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface AiTaskContextRefs {
  editorFile?: string;
  selection?: string;
  diagnostics?: Array<Record<string, unknown>>;
  browserUrl?: string;
  terminalLastOutput?: string;
  recentIntents?: string[];
  modeId?: string;
  projectRoot?: string;
}

export interface AiTask {
  id: string;
  schemaVersion: number;
  sessionId: string;
  utteranceId: string;
  correlationId: string;
  modeId: ModeId | string;
  profileId: string;
  projectId?: string;
  taskType: AiTaskType;
  status: AiTaskStatus;
  model: string;
  systemPromptVersion: string;
  userPromptSummary: string;
  contextRefs: AiTaskContextRefs;
  toolRequestsEmitted: string[];
  responseSummary?: string;
  responseLength: ResponseLength;
  invocationReason: string;
  deterministicAttempted: boolean;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  actualInputTokens?: number;
  actualOutputTokens?: number;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  startedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  errorCode?: string;
  errorMessage?: string;
  cancelledBy?: AiTaskCancelledBy;
}

export interface AiUsageEvent {
  id: string;
  schemaVersion: number;
  sessionId: string;
  aiTaskId: string;
  timestamp: IsoDateTime;
  provider: string;
  model: string;
  operation: AiUsageOperation;
  inputTokens: number;
  outputTokens: number;
  audioSeconds?: number;
  totalTokens: number;
  costUsd: number;
  rateTableVersion: string;
  modeId: ModeId | string;
  profileId: string;
  projectId?: string;
  utteranceId?: string;
  wasAvoidable: boolean;
  avoidabilitySuggestion?: string;
  requestId?: string;
  latencyMs?: number;
}

export interface ToolRequest {
  id: string;
  schemaVersion: number;
  sessionId: string;
  correlationId: string;
  source: ToolRequestSource;
  sourceId: string;
  adapter: AdapterType;
  action: string;
  parameters: Record<string, unknown>;
  description: string;
  priority: ToolRequestPriority;
  idempotencyKey?: string;
  requiresRiskCheck: boolean;
  riskClassificationId?: string;
  status: ToolRequestStatus;
  dependsOnRequestId?: string;
  timeoutMs?: number;
  createdAt: IsoDateTime;
}

export interface ToolResultArtifact {
  type: string;
  path: string;
  redacted: boolean;
}

export interface ToolResult {
  id: string;
  schemaVersion: number;
  toolRequestId: string;
  sessionId: string;
  correlationId: string;
  adapter: AdapterType;
  action: string;
  success: boolean;
  resultType: ToolResultType;
  output?: string;
  structuredData?: Record<string, unknown>;
  stateSnapshot?: Record<string, unknown>;
  artifacts?: ToolResultArtifact[];
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
  startedAt: IsoDateTime;
  completedAt: IsoDateTime;
  auditRedacted: boolean;
  retryCount: number;
}

export interface EditorSelection {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
  text: string;
  isEmpty: boolean;
}

export interface EditorSelectedSymbol {
  name: string;
  kind: string;
  range: EditorSelection;
  containerName?: string;
}

export interface EditorVisibleRange {
  startLine: number;
  endLine: number;
}

export interface EditorDiagnostic {
  file: string;
  line: number;
  character: number;
  severity: DiagnosticSeverity;
  message: string;
  code?: string | number;
  source?: string;
}

export interface EditorState {
  timestamp: IsoDateTime;
  connected: boolean;
  workspaceName?: string;
  workspaceFolders: string[];
  activeFilePath?: string;
  activeFileAbsolutePath?: string;
  activeLanguageId?: string;
  cursorLine?: number;
  cursorCharacter?: number;
  selection?: EditorSelection;
  selectedSymbol?: EditorSelectedSymbol;
  visibleRange?: EditorVisibleRange;
  openEditors: string[];
  diagnostics: EditorDiagnostic[];
  gitBranch?: string;
  gitDirty?: boolean;
  isDirty: boolean;
  tabCount: number;
  lastEditSource?: EditSource;
  lastEditAt?: IsoDateTime;
  extensionVersion: string;
  capabilities: string[];
}

export interface BrowserConsoleMessage {
  level: string;
  message: string;
  timestamp: IsoDateTime;
  url: string;
  line?: number;
}

export interface BrowserNetworkFailure {
  url: string;
  status: number;
  method: string;
  timestamp: IsoDateTime;
}

export interface BrowserViewport {
  width: number;
  height: number;
}

export interface BrowserState {
  timestamp: IsoDateTime;
  connected: boolean;
  profileId: string;
  browserEngine: string;
  currentUrl?: string;
  currentDomain?: string;
  currentTitle?: string;
  pageStatus: BrowserPageStatus;
  isLocalhost: boolean;
  isAllowlistedDomain: boolean;
  privacyIndicator: BrowserPrivacyIndicator;
  consoleMessageCount: number;
  lastConsoleErrors: BrowserConsoleMessage[];
  lastConsoleWarnings?: BrowserConsoleMessage[];
  lastNetworkFailures: BrowserNetworkFailure[];
  pendingRequests?: number;
  activeFlowId?: string;
  flowStepIndex?: number;
  flowStepName?: string;
  screenshotRef?: string;
  viewport?: BrowserViewport;
  automationEngine: string;
  automationEngineVersion: string;
}

export interface TerminalCommand {
  id: string;
  schemaVersion: number;
  sessionId: string;
  projectId: string;
  commandLine: string;
  normalizedCommandLine: string;
  workingDirectory: string;
  source: TerminalCommandSource;
  classification: TerminalCommandClassification;
  classificationReason?: string;
  allowlistMatchId?: string;
  riskClassificationId?: string;
  status: TerminalCommandStatus;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  stdoutLineCount?: number;
  startedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  durationMs?: number;
  toolRequestId?: string;
  processId?: number;
}

export interface AppTestFlowStep {
  id: string;
  name?: string;
  type: AppTestStepType;
  selector?: string;
  value?: string;
  url?: string;
  timeoutMs?: number;
  optional: boolean;
  screenshotOnFailure?: boolean;
  description?: string;
}

export interface AppTestFlow {
  id: string;
  schemaVersion: number;
  projectId: string;
  name: string;
  description?: string;
  triggerPhrases: string[];
  voiceCommandId?: string;
  requiresDevServer: boolean;
  devServerReadyUrlOverride?: string;
  startUrl: string;
  steps: AppTestFlowStep[];
  fakeDataProfileId?: string;
  timeoutMs: number;
  stepDefaultTimeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
  onFailure: AppTestOnFailure;
  successCriteria?: string;
  tags?: string[];
  enabled: boolean;
  lastRunAt?: IsoDateTime;
  lastRunStatus?: AppTestRunStatus;
  lastRunDurationMs?: number;
  lastFailureStepIndex?: number;
  lastFailureMessage?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface OverlayRecentEvent {
  timestamp: IsoDateTime;
  message: string;
}

export interface OverlayConnectionStatus {
  vscode: ConnectionHealth;
  browser: ConnectionHealth;
  obs: ConnectionHealth;
  openai: ConnectionHealth;
  admin: ConnectionHealth;
}

export interface StreamOverlayState {
  timestamp: IsoDateTime;
  sessionId: string;
  layoutMode: StreamOverlayLayoutMode;
  activeModeId: ModeId | string;
  activeModeDisplayName: string;
  modeColor: string;
  modeIcon?: string;
  lastCommandSummary?: string;
  lastIntentSummary?: string;
  confidenceBand?: ConfidenceBand;
  aiStatus: AiStatus;
  aiTaskSummary?: string;
  confirmationPrompt?: string;
  confirmationVisible: boolean;
  privacyActive: boolean;
  privacyBannerText?: string;
  appTestStatus?: AppTestStatus;
  appTestFlowName?: string;
  devServerStatus?: DevServerStatus;
  focusTarget: FocusTarget | string;
  activeFileBasename?: string;
  browserDomain?: string;
  transcriptVisible: boolean;
  lastTranscriptLine?: string;
  recentEvents?: OverlayRecentEvent[];
  connectionStatus: OverlayConnectionStatus;
  sessionCostUsd?: number;
  emergencyStopActive: boolean;
  version: string;
}
