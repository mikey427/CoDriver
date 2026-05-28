/** ISO 8601 UTC timestamp string. */
export type IsoDateTime = string;

/** BCP 47 language tag, e.g. `en-US`. */
export type Bcp47Language = string;

/** Stable mode identifier slug. */
export enum ModeId {
  ManualDictation = 'manual-dictation',
  Command = 'command',
  AiAssist = 'ai-assist',
  VibeCoding = 'vibe-coding',
  Research = 'research',
  Browser = 'browser',
  AppTesting = 'app-testing',
  Review = 'review',
  Terminal = 'terminal',
  StreamControl = 'stream-control',
  EmergencySafe = 'emergency-safe',
}

export const ALL_MODE_IDS: readonly ModeId[] = [
  ModeId.ManualDictation,
  ModeId.Command,
  ModeId.AiAssist,
  ModeId.VibeCoding,
  ModeId.Research,
  ModeId.Browser,
  ModeId.AppTesting,
  ModeId.Review,
  ModeId.Terminal,
  ModeId.StreamControl,
  ModeId.EmergencySafe,
] as const;

export enum RiskTier {
  Safe = 'safe',
  Medium = 'medium',
  Dangerous = 'dangerous',
  Blocked = 'blocked',
}

export enum IntentType {
  Dictation = 'dictation',
  SymbolInsert = 'symbol_insert',
  EditorNavigate = 'editor_navigate',
  EditorTransform = 'editor_transform',
  EditorSelect = 'editor_select',
  ModeSwitch = 'mode_switch',
  TerminalRun = 'terminal_run',
  BrowserAction = 'browser_action',
  ObsAction = 'obs_action',
  AppTestRun = 'app_test_run',
  ResearchRequest = 'research_request',
  ConfirmationResponse = 'confirmation_response',
  AiRequest = 'ai_request',
  Macro = 'macro',
  Cancel = 'cancel',
  EmergencyStop = 'emergency_stop',
  FocusChange = 'focus_change',
  AudioControl = 'audio_control',
  Noop = 'noop',
  Unknown = 'unknown',
}

export enum AdapterType {
  Vscode = 'vscode',
  Terminal = 'terminal',
  Browser = 'browser',
  Obs = 'obs',
  Orchestrator = 'orchestrator',
  Ai = 'ai',
}

export enum UtteranceSource {
  Http = 'http',
  AdminManual = 'admin-manual',
  AdminMic = 'admin-mic',
  Test = 'test',
  Unknown = 'unknown',
  /** @deprecated legacy spec value */
  VoicePtt = 'voice_ptt',
  /** @deprecated legacy spec value */
  VoiceWake = 'voice_wake',
  /** @deprecated legacy spec value */
  ButtonMacro = 'button_macro',
  /** @deprecated legacy spec value */
  AdminReplay = 'admin_replay',
}

export enum ParsePath {
  Deterministic = 'deterministic',
  AiAssisted = 'ai_assisted',
}

export enum ConfidenceBand {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Reject = 'reject',
}

export enum VoiceCommandCategory {
  Dictation = 'dictation',
  Editor = 'editor',
  Navigation = 'navigation',
  Terminal = 'terminal',
  Browser = 'browser',
  Obs = 'obs',
  Mode = 'mode',
  Ai = 'ai',
  Safety = 'safety',
  Macro = 'macro',
  Audio = 'audio',
}

export enum AliasMatchMode {
  Exact = 'exact',
  Prefix = 'prefix',
  Contains = 'contains',
  Fuzzy = 'fuzzy',
}

export enum AliasTargetType {
  VoiceCommand = 'voice_command',
  Macro = 'macro',
  TextSnippet = 'text_snippet',
  ModeEnter = 'mode_enter',
}

export enum MacroStepType {
  Command = 'command',
  Delay = 'delay',
  ModeEnter = 'mode_enter',
}

export enum AiAutonomyLevel {
  None = 'none',
  SuggestOnly = 'suggest_only',
  ScopedAutoApply = 'scoped_auto_apply',
  BoundedVibe = 'bounded_vibe',
}

export enum ResponseLength {
  Silent = 'silent',
  BeepOnly = 'beep_only',
  StatusOnly = 'status_only',
  Brief = 'brief',
  Normal = 'normal',
  Deep = 'deep',
}

export enum ConfirmationPolicy {
  ProfileDefault = 'profile_default',
  Strict = 'strict',
  Relaxed = 'relaxed',
}

export enum FailureBehavior {
  RevertPreviousMode = 'revert_previous_mode',
  EnterCommandMode = 'enter_command_mode',
  EnterEmergencySafe = 'enter_emergency_safe',
}

export enum StreamOverlayVisibility {
  FullDebug = 'full_debug',
  Minimal = 'minimal',
  Hidden = 'hidden',
}

export enum AudioOutputRoute {
  Private = 'private',
  Stream = 'stream',
  Both = 'both',
  BeepOnly = 'beep_only',
  Silent = 'silent',
}

export enum StreamAudioDefault {
  None = 'none',
  Brief = 'brief',
  Narration = 'narration',
}

export enum AiResponsesDefault {
  BriefPrivate = 'brief_private',
  StreamNarration = 'stream_narration',
  Silent = 'silent',
  BeepOnly = 'beep_only',
}

export enum ErrorFeedback {
  Beep = 'beep',
  BriefVoice = 'brief_voice',
  Silent = 'silent',
}

export enum PackageManager {
  Npm = 'npm',
  Pnpm = 'pnpm',
  Yarn = 'yarn',
  Bun = 'bun',
}

export enum LogRedactionLevel {
  None = 'none',
  Partial = 'partial',
  FullSecrets = 'full_secrets',
}

export enum ObsPermissionLevel {
  Confirm = 'confirm',
  Block = 'block',
  Allow = 'allow',
}

export enum ExternalUrlPolicy {
  AllowlistOnly = 'allowlist_only',
  Confirm = 'confirm',
  Block = 'block',
}

export enum ConfirmationType {
  Execute = 'execute',
  Destructive = 'destructive',
  Publish = 'publish',
  StreamChange = 'stream_change',
  SafetyChange = 'safety_change',
}

export enum PendingConfirmationStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Denied = 'denied',
  Expired = 'expired',
  Cancelled = 'cancelled',
}

export enum ConfirmationResolvedBy {
  Voice = 'voice',
  Button = 'button',
  Admin = 'admin',
  Timeout = 'timeout',
  EmergencyStop = 'emergency_stop',
}

export enum RuntimeEventSeverity {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
  Audit = 'audit',
}

export enum RuntimeSubsystem {
  Orchestrator = 'orchestrator',
  Speech = 'speech',
  Normalizer = 'normalizer',
  Parser = 'parser',
  Ai = 'ai',
  Router = 'router',
  Safety = 'safety',
  Vscode = 'vscode',
  Terminal = 'terminal',
  Browser = 'browser',
  Obs = 'obs',
  Overlay = 'overlay',
  Audio = 'audio',
  Admin = 'admin',
}

export enum AiTaskType {
  CodeAssist = 'code_assist',
  Explain = 'explain',
  Refactor = 'refactor',
  Research = 'research',
  AppTestDiagnosis = 'app_test_diagnosis',
  VibeCoding = 'vibe_coding',
  Clarify = 'clarify',
  Review = 'review',
}

export enum AiTaskStatus {
  Queued = 'queued',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum AiTaskCancelledBy {
  User = 'user',
  EmergencyStop = 'emergency_stop',
  Timeout = 'timeout',
  ModeChange = 'mode_change',
}

export enum AiUsageOperation {
  ChatCompletion = 'chat_completion',
  Embedding = 'embedding',
  Stt = 'stt',
  Tts = 'tts',
}

export enum ToolRequestSource {
  DeterministicIntent = 'deterministic_intent',
  AiTask = 'ai_task',
  AppTestAgent = 'app_test_agent',
  AdminManual = 'admin_manual',
  Macro = 'macro',
}

export enum ToolRequestPriority {
  Immediate = 'immediate',
  Normal = 'normal',
  Background = 'background',
}

export enum ToolRequestStatus {
  Pending = 'pending',
  AwaitingConfirmation = 'awaiting_confirmation',
  Executing = 'executing',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum ToolResultType {
  Void = 'void',
  Text = 'text',
  Patch = 'patch',
  StateSnapshot = 'state_snapshot',
  Structured = 'structured',
  ImageRef = 'image_ref',
}

export enum EditSource {
  Voice = 'voice',
  Ai = 'ai',
  Manual = 'manual',
  Unknown = 'unknown',
}

export enum DiagnosticSeverity {
  Error = 'error',
  Warning = 'warning',
  Information = 'information',
  Hint = 'hint',
}

export enum BrowserPageStatus {
  Idle = 'idle',
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
  Closed = 'closed',
}

export enum BrowserPrivacyIndicator {
  Safe = 'safe',
  External = 'external',
  Blocked = 'blocked',
}

export enum TerminalCommandSource {
  Voice = 'voice',
  Ai = 'ai',
  AppTest = 'app_test',
  Admin = 'admin',
  Startup = 'startup',
}

export enum TerminalCommandClassification {
  Allowlisted = 'allowlisted',
  Medium = 'medium',
  Dangerous = 'dangerous',
  Blocked = 'blocked',
}

export enum TerminalCommandStatus {
  Pending = 'pending',
  AwaitingConfirmation = 'awaiting_confirmation',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum AppTestStepType {
  Navigate = 'navigate',
  Click = 'click',
  Fill = 'fill',
  Select = 'select',
  AssertText = 'assert_text',
  AssertVisible = 'assert_visible',
  AssertUrl = 'assert_url',
  Wait = 'wait',
  WaitForSelector = 'wait_for_selector',
  Screenshot = 'screenshot',
  InspectConsole = 'inspect_console',
  InspectNetwork = 'inspect_network',
  PressKey = 'press_key',
}

export enum AppTestOnFailure {
  Stop = 'stop',
  Continue = 'continue',
  DiagnoseWithAi = 'diagnose_with_ai',
}

export enum AppTestRunStatus {
  Passed = 'passed',
  Failed = 'failed',
  Skipped = 'skipped',
  Cancelled = 'cancelled',
}

export enum StreamOverlayLayoutMode {
  FullDebug = 'full_debug',
  Minimal = 'minimal',
  Privacy = 'privacy',
}

export enum AiStatus {
  Idle = 'idle',
  Thinking = 'thinking',
  Speaking = 'speaking',
  Error = 'error',
}

export enum AppTestStatus {
  Idle = 'idle',
  Running = 'running',
  Passed = 'passed',
  Failed = 'failed',
}

export enum DevServerStatus {
  Stopped = 'stopped',
  Starting = 'starting',
  Ready = 'ready',
  Error = 'error',
}

export enum DeviceType {
  MozaR5 = 'moza_r5',
  Keyboard = 'keyboard',
  Gamepad = 'gamepad',
  Other = 'other',
}

export enum ButtonInputType {
  JoystickButton = 'joystick_button',
  KeyboardKey = 'keyboard_key',
  Combo = 'combo',
}

export enum ButtonActionType {
  Ptt = 'ptt',
  EmergencyStop = 'emergency_stop',
  Confirm = 'confirm',
  Cancel = 'cancel',
  ModeToggle = 'mode_toggle',
  ModeEnter = 'mode_enter',
  RepeatLast = 'repeat_last',
  FocusVscode = 'focus_vscode',
  MuteAi = 'mute_ai',
  CustomCommand = 'custom_command',
}

export enum SpeechCorrectionScope {
  Global = 'global',
  Profile = 'profile',
  Project = 'project',
}

export enum SpeechCorrectionMatchType {
  ExactWord = 'exact_word',
  Phrase = 'phrase',
  Regex = 'regex',
}

export enum VoiceCommandSlotType {
  Literal = 'literal',
  FileName = 'fileName',
  SymbolName = 'symbolName',
  ScriptName = 'scriptName',
  FlowName = 'flowName',
  SceneName = 'sceneName',
  UrlHost = 'urlHost',
  Number = 'number',
  FreeText = 'freeText',
  ModeId = 'modeId',
  Direction = 'direction',
  Text = 'text',
}

export enum FocusTarget {
  Vscode = 'vscode',
  Browser = 'browser',
  Terminal = 'terminal',
  Obs = 'obs',
  Other = 'other',
}

export enum EstimatedImpact {
  ReadOnly = 'read_only',
  SingleFileWrite = 'single_file_write',
  MultiFileWrite = 'multi_file_write',
  SystemLevel = 'system_level',
}

export enum RouterRejectionCode {
  ModeBlocked = 'MODE_BLOCKED',
  AiDisabled = 'AI_DISABLED',
  ConfidenceLow = 'CONFIDENCE_LOW',
  RiskBlocked = 'RISK_BLOCKED',
  AllowlistMiss = 'ALLOWLIST_MISS',
  FocusRequired = 'FOCUS_REQUIRED',
  ConfirmationExpired = 'CONFIRMATION_EXPIRED',
  EmergencyLatch = 'EMERGENCY_LATCH',
  UnknownCommand = 'UNKNOWN_COMMAND',
  AdapterOffline = 'ADAPTER_OFFLINE',
}

export enum EditorErrorCode {
  NotConnected = 'NOT_CONNECTED',
  Busy = 'BUSY',
  InvalidParams = 'INVALID_PARAMS',
  FileNotFound = 'FILE_NOT_FOUND',
  LspUnavailable = 'LSP_UNAVAILABLE',
  ProtectedPath = 'PROTECTED_PATH',
  PatchConflict = 'PATCH_CONFLICT',
  Timeout = 'TIMEOUT',
}

export enum EditorConnectionStatus {
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Degraded = 'degraded',
}

export enum ConnectionHealth {
  Connected = 'connected',
  Degraded = 'degraded',
  Disconnected = 'disconnected',
}

export enum AiInvocationReason {
  LowConfidence = 'LOW_CONFIDENCE',
  ExplicitAi = 'EXPLICIT_AI',
  ModeDefault = 'MODE_DEFAULT',
  FailureDiagnosis = 'FAILURE_DIAGNOSIS',
  AmbiguityResolution = 'AMBIGUITY_RESOLUTION',
  UserConfirmedCost = 'USER_CONFIRMED_COST',
  ModeRequired = 'mode_required',
  LowConfidenceDisambiguation = 'low_confidence_disambiguation',
  ExplicitUserRequest = 'explicit_user_request',
  CodeGeneration = 'code_generation',
  Refactor = 'refactor',
  ErrorExplanation = 'error_explanation',
  ResearchSynthesis = 'research_synthesis',
  AppTestDiagnosis = 'app_test_diagnosis',
  PatchReview = 'patch_review',
  VibeCodingStep = 'vibe_coding_step',
  None = 'none',
}
