import {
  AiAutonomyLevel,
  AudioOutputRoute,
  ConfirmationPolicy,
  FailureBehavior,
  ModeId,
  ResponseLength,
  StreamAudioDefault,
  StreamOverlayVisibility,
  VoiceCommandCategory,
} from '../types/enums.js';
import type { ModeConfig } from '../types/models.js';

const SCHEMA_VERSION = 1;

function baseMode(
  id: ModeId,
  displayName: string,
  description: string,
  purpose: string,
  sortOrder: number,
  overrides: Partial<ModeConfig>,
): ModeConfig {
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    displayName,
    description,
    purpose,
    enterPhrases: [],
    exitPhrases: ['back to coding', 'switch to {mode}'],
    openAiEnabledDefault: false,
    allowedToolIds: [],
    aiAutonomyLevel: AiAutonomyLevel.None,
    defaultResponseLength: ResponseLength.Brief,
    confirmationPolicy: ConfirmationPolicy.ProfileDefault,
    availableCommandCategories: [],
    failureBehavior: FailureBehavior.RevertPreviousMode,
    streamOverlayVisibility: StreamOverlayVisibility.Minimal,
    privateAudioDefault: AudioOutputRoute.Private,
    streamAudioDefault: StreamAudioDefault.None,
    sortOrder,
    isSystemMode: true,
    enabled: true,
    ...overrides,
  };
}

/** Default ModeConfig for Manual Dictation mode. */
export const MANUAL_DICTATION_MODE: ModeConfig = baseMode(
  ModeId.ManualDictation,
  'Manual Dictation',
  'Hands-free code insertion without LLM.',
  'First-class hands-free coding: insert keywords, symbols, operators, and local undo/correction without LLM.',
  1,
  {
    enterPhrases: ['manual mode', 'dictation mode', 'go manual'],
    exitPhrases: ['command mode', 'switch to AI assist', 'terminal mode'],
    openAiEnabledDefault: false,
    allowedToolIds: [
      'editor.insertText',
      'editor.phraseUndo',
      'editor.undo',
      'editor.redo',
      'editor.select',
      'editor.transform',
      'editor.save',
      'editor.navigate',
    ],
    aiAutonomyLevel: AiAutonomyLevel.None,
    defaultResponseLength: ResponseLength.Silent,
    availableCommandCategories: [VoiceCommandCategory.Dictation, VoiceCommandCategory.Editor],
    deterministicGrammarSetId: 'grammar.manual',
    failureBehavior: FailureBehavior.RevertPreviousMode,
    streamOverlayVisibility: StreamOverlayVisibility.Minimal,
    privateAudioDefault: AudioOutputRoute.BeepOnly,
    streamAudioDefault: StreamAudioDefault.None,
  },
);

/** Default ModeConfig for Command mode. */
export const COMMAND_MODE: ModeConfig = baseMode(
  ModeId.Command,
  'Command',
  'Harness control plane without code insertion.',
  'Mode switches, focus, macros, overlay density, audio routing, privacy toggles, and status queries.',
  2,
  {
    enterPhrases: ['command mode', 'switch command mode'],
    exitPhrases: ['manual mode', 'switch to {mode}'],
    openAiEnabledDefault: false,
    allowedToolIds: [
      'orchestrator.setMode',
      'orchestrator.runMacro',
      'orchestrator.repeatLast',
      'orchestrator.setPrivacy',
      'orchestrator.setOverlayLayout',
      'orchestrator.setVerbosity',
      'focus.vscode',
      'focus.browser',
      'focus.terminal',
      'audio.setRoute',
    ],
    aiAutonomyLevel: AiAutonomyLevel.None,
    defaultResponseLength: ResponseLength.Brief,
    availableCommandCategories: [
      VoiceCommandCategory.Mode,
      VoiceCommandCategory.Navigation,
      VoiceCommandCategory.Audio,
      VoiceCommandCategory.Macro,
    ],
    deterministicGrammarSetId: 'grammar.command',
    failureBehavior: FailureBehavior.EnterCommandMode,
    privateAudioDefault: AudioOutputRoute.Private,
  },
);

/** Default ModeConfig for AI-Assist mode. */
export const AI_ASSIST_MODE: ModeConfig = baseMode(
  ModeId.AiAssist,
  'AI Assist',
  'Scoped AI pair programming with user-authorized apply.',
  'Explain errors, generate functions, refactor selections, and propose patches — user explicitly authorizes apply.',
  3,
  {
    enterPhrases: ['AI assist mode', 'help me code', 'switch to AI assist'],
    exitPhrases: ['manual mode', 'command mode', 'review mode'],
    openAiEnabledDefault: true,
    allowedToolIds: [
      'editor.insertText',
      'editor.applyPatch',
      'editor.previewPatch',
      'editor.navigate',
      'editor.select',
      'editor.getSelectionContext',
      'editor.getDiagnostics',
      'terminal.runScript',
      'ai.triggerAssist',
    ],
    aiAutonomyLevel: AiAutonomyLevel.ScopedAutoApply,
    defaultResponseLength: ResponseLength.Brief,
    availableCommandCategories: [
      VoiceCommandCategory.Ai,
      VoiceCommandCategory.Editor,
      VoiceCommandCategory.Terminal,
    ],
    deterministicGrammarSetId: 'grammar.ai-assist',
    failureBehavior: FailureBehavior.RevertPreviousMode,
    streamOverlayVisibility: StreamOverlayVisibility.Minimal,
    privateAudioDefault: AudioOutputRoute.Private,
  },
);

/** Default ModeConfig for Vibe-Coding mode. */
export const VIBE_CODING_MODE: ModeConfig = baseMode(
  ModeId.VibeCoding,
  'Vibe Coding',
  'Bounded multi-step implementation passes.',
  'Opt-in broader implementation passes with clearly labeled overlay and step-limited autonomy.',
  4,
  {
    enterPhrases: ['vibe mode', 'vibe coding mode', 'enter vibe coding'],
    exitPhrases: ['stop implementation', 'AI assist mode', 'manual mode'],
    openAiEnabledDefault: true,
    allowedToolIds: [
      'editor.applyPatch',
      'editor.previewPatch',
      'editor.navigate',
      'terminal.runScript',
      'browser.openLocalhost',
      'browser.runFlowStep',
      'ai.triggerAssist',
    ],
    aiAutonomyLevel: AiAutonomyLevel.BoundedVibe,
    defaultResponseLength: ResponseLength.StatusOnly,
    confirmationPolicy: ConfirmationPolicy.Strict,
    availableCommandCategories: [
      VoiceCommandCategory.Ai,
      VoiceCommandCategory.Editor,
      VoiceCommandCategory.Terminal,
      VoiceCommandCategory.Browser,
    ],
    deterministicGrammarSetId: 'grammar.vibe-coding',
    failureBehavior: FailureBehavior.RevertPreviousMode,
    privateAudioDefault: AudioOutputRoute.Private,
  },
);

/** Default ModeConfig for Research mode. */
export const RESEARCH_MODE: ModeConfig = baseMode(
  ModeId.Research,
  'Research',
  'Stream-safe web/docs research with brief summaries.',
  'Web search and documentation lookup with practical summaries tied to current code context.',
  5,
  {
    enterPhrases: ['research mode', 'switch to research'],
    exitPhrases: ['back to coding', 'AI assist mode'],
    openAiEnabledDefault: true,
    allowedToolIds: [
      'browser.navigate',
      'browser.search',
      'browser.readPage',
      'focus.browser',
      'focus.vscode',
      'ai.triggerAssist',
    ],
    aiAutonomyLevel: AiAutonomyLevel.SuggestOnly,
    defaultResponseLength: ResponseLength.Brief,
    availableCommandCategories: [
      VoiceCommandCategory.Browser,
      VoiceCommandCategory.Ai,
      VoiceCommandCategory.Navigation,
    ],
    deterministicGrammarSetId: 'grammar.research',
    failureBehavior: FailureBehavior.RevertPreviousMode,
    privateAudioDefault: AudioOutputRoute.Private,
    streamAudioDefault: StreamAudioDefault.Brief,
  },
);

/** Default ModeConfig for Browser mode. */
export const BROWSER_MODE: ModeConfig = baseMode(
  ModeId.Browser,
  'Browser',
  'Deterministic stream-safe browser automation.',
  'Navigation and interaction without LLM per step.',
  6,
  {
    enterPhrases: ['browser mode', 'open app'],
    exitPhrases: ['focus vscode', 'research mode', 'app test mode'],
    openAiEnabledDefault: false,
    allowedToolIds: [
      'browser.openLocalhost',
      'browser.navigate',
      'browser.goBack',
      'browser.goForward',
      'browser.click',
      'browser.fill',
      'browser.scroll',
      'browser.refresh',
      'browser.readConsole',
      'browser.readNetwork',
    ],
    aiAutonomyLevel: AiAutonomyLevel.None,
    defaultResponseLength: ResponseLength.Brief,
    availableCommandCategories: [VoiceCommandCategory.Browser, VoiceCommandCategory.Navigation],
    deterministicGrammarSetId: 'grammar.browser',
    failureBehavior: FailureBehavior.RevertPreviousMode,
    privateAudioDefault: AudioOutputRoute.Private,
  },
);

/** Default ModeConfig for App-Testing mode. */
export const APP_TESTING_MODE: ModeConfig = baseMode(
  ModeId.AppTesting,
  'App Testing',
  'Run dev server and browser test flows.',
  'Test the real running app with Playwright-style flows, fake data, and console/network inspection.',
  7,
  {
    enterPhrases: ['app test mode', 'run flow {name}'],
    exitPhrases: ['stop tests', 'focus vscode'],
    openAiEnabledDefault: true,
    allowedToolIds: [
      'terminal.runScript',
      'terminal.cancel',
      'browser.runFlow',
      'browser.readConsole',
      'browser.readNetwork',
      'browser.openLocalhost',
      'ai.triggerAssist',
    ],
    aiAutonomyLevel: AiAutonomyLevel.SuggestOnly,
    defaultResponseLength: ResponseLength.Brief,
    availableCommandCategories: [
      VoiceCommandCategory.Browser,
      VoiceCommandCategory.Terminal,
      VoiceCommandCategory.Ai,
    ],
    deterministicGrammarSetId: 'grammar.app-testing',
    failureBehavior: FailureBehavior.RevertPreviousMode,
    privateAudioDefault: AudioOutputRoute.Private,
    streamAudioDefault: StreamAudioDefault.Brief,
  },
);

/** Default ModeConfig for Review mode. */
export const REVIEW_MODE: ModeConfig = baseMode(
  ModeId.Review,
  'Review',
  'Read-only review of proposed changes before apply.',
  'Review diffs, selections, and diagnostics — accept or reject patches explicitly.',
  8,
  {
    enterPhrases: ['review mode', 'review that'],
    exitPhrases: ['reject patch', 'AI assist mode', 'manual mode'],
    openAiEnabledDefault: true,
    allowedToolIds: [
      'editor.getSelectionContext',
      'editor.previewPatch',
      'editor.applyPatch',
      'editor.navigate',
      'terminal.runScript',
      'ai.triggerAssist',
    ],
    aiAutonomyLevel: AiAutonomyLevel.None,
    defaultResponseLength: ResponseLength.Brief,
    availableCommandCategories: [
      VoiceCommandCategory.Editor,
      VoiceCommandCategory.Ai,
    ],
    deterministicGrammarSetId: 'grammar.review',
    failureBehavior: FailureBehavior.RevertPreviousMode,
    streamOverlayVisibility: StreamOverlayVisibility.Minimal,
    privateAudioDefault: AudioOutputRoute.Silent,
  },
);

/** Default ModeConfig for Terminal mode. */
export const TERMINAL_MODE: ModeConfig = baseMode(
  ModeId.Terminal,
  'Terminal',
  'Allowlisted project shell commands only.',
  'Execute allowlisted project commands with captured output — not a general shell.',
  9,
  {
    enterPhrases: ['terminal mode'],
    exitPhrases: ['focus vscode', 'command mode'],
    openAiEnabledDefault: false,
    allowedToolIds: [
      'terminal.runScript',
      'terminal.cancel',
      'terminal.gitStatus',
      'terminal.gitDiff',
    ],
    aiAutonomyLevel: AiAutonomyLevel.None,
    defaultResponseLength: ResponseLength.Brief,
    availableCommandCategories: [VoiceCommandCategory.Terminal],
    deterministicGrammarSetId: 'grammar.terminal',
    failureBehavior: FailureBehavior.RevertPreviousMode,
    privateAudioDefault: AudioOutputRoute.Private,
  },
);

/** Default ModeConfig for Stream-Control mode. */
export const STREAM_CONTROL_MODE: ModeConfig = baseMode(
  ModeId.StreamControl,
  'Stream Control',
  'OBS scenes, overlay layout, and stream privacy.',
  'Control OBS scenes, sources, transcript visibility, and overlay layout for streaming.',
  10,
  {
    enterPhrases: ['stream mode', 'OBS mode', 'switch stream control'],
    exitPhrases: ['back to coding', 'command mode'],
    openAiEnabledDefault: false,
    allowedToolIds: [
      'obs.setScene',
      'obs.toggleSource',
      'obs.setPrivacy',
      'orchestrator.setOverlayLayout',
      'orchestrator.setPrivacy',
      'audio.setRoute',
      'audio.muteStreamNarration',
    ],
    aiAutonomyLevel: AiAutonomyLevel.None,
    defaultResponseLength: ResponseLength.Brief,
    confirmationPolicy: ConfirmationPolicy.Strict,
    availableCommandCategories: [
      VoiceCommandCategory.Obs,
      VoiceCommandCategory.Audio,
      VoiceCommandCategory.Mode,
    ],
    deterministicGrammarSetId: 'grammar.stream-control',
    failureBehavior: FailureBehavior.EnterCommandMode,
    streamOverlayVisibility: StreamOverlayVisibility.FullDebug,
    privateAudioDefault: AudioOutputRoute.Private,
    streamAudioDefault: StreamAudioDefault.Brief,
  },
);

/** Default ModeConfig for Emergency / Safe mode. */
export const EMERGENCY_SAFE_MODE: ModeConfig = baseMode(
  ModeId.EmergencySafe,
  'Emergency Safe',
  'Fail-safe latch halting AI and risky automation.',
  'Halt AI, pending actions, and risky automation; allow only whitelisted recovery commands.',
  11,
  {
    enterPhrases: ['emergency stop', 'safe mode', 'stop harness', 'stop all'],
    exitPhrases: ['resume previous mode', 'resume harness'],
    openAiEnabledDefault: false,
    allowedToolIds: [
      'safe.resume',
      'safe.status',
      'orchestrator.setPrivacy',
      'audio.stopTts',
      'audio.muteAll',
      'orchestrator.cancelPending',
    ],
    aiAutonomyLevel: AiAutonomyLevel.None,
    defaultResponseLength: ResponseLength.StatusOnly,
    confirmationPolicy: ConfirmationPolicy.Strict,
    availableCommandCategories: [VoiceCommandCategory.Safety, VoiceCommandCategory.Audio],
    deterministicGrammarSetId: 'grammar.emergency-safe',
    failureBehavior: FailureBehavior.EnterEmergencySafe,
    streamOverlayVisibility: StreamOverlayVisibility.Minimal,
    privateAudioDefault: AudioOutputRoute.Private,
    streamAudioDefault: StreamAudioDefault.None,
  },
);

/** All 11 default mode configurations keyed by ModeId. */
export const DEFAULT_MODE_CONFIGS: Record<ModeId, ModeConfig> = {
  [ModeId.ManualDictation]: MANUAL_DICTATION_MODE,
  [ModeId.Command]: COMMAND_MODE,
  [ModeId.AiAssist]: AI_ASSIST_MODE,
  [ModeId.VibeCoding]: VIBE_CODING_MODE,
  [ModeId.Research]: RESEARCH_MODE,
  [ModeId.Browser]: BROWSER_MODE,
  [ModeId.AppTesting]: APP_TESTING_MODE,
  [ModeId.Review]: REVIEW_MODE,
  [ModeId.Terminal]: TERMINAL_MODE,
  [ModeId.StreamControl]: STREAM_CONTROL_MODE,
  [ModeId.EmergencySafe]: EMERGENCY_SAFE_MODE,
};

/** Ordered list of default mode configs for admin UI rendering. */
export const DEFAULT_MODE_CONFIG_LIST: readonly ModeConfig[] = [
  MANUAL_DICTATION_MODE,
  COMMAND_MODE,
  AI_ASSIST_MODE,
  VIBE_CODING_MODE,
  RESEARCH_MODE,
  BROWSER_MODE,
  APP_TESTING_MODE,
  REVIEW_MODE,
  TERMINAL_MODE,
  STREAM_CONTROL_MODE,
  EMERGENCY_SAFE_MODE,
];

/** Per-mode deterministic parser thresholds (defaults, overridable via modeOverrides). */
export const DEFAULT_MODE_PARSER_THRESHOLDS: Record<
  ModeId,
  { deterministicThreshold: number; aiOfferThreshold: number | null; rejectBelow: number }
> = {
  [ModeId.ManualDictation]: { deterministicThreshold: 0.72, aiOfferThreshold: null, rejectBelow: 0.45 },
  [ModeId.Command]: { deterministicThreshold: 0.8, aiOfferThreshold: 0.55, rejectBelow: 0.55 },
  [ModeId.AiAssist]: { deterministicThreshold: 0.75, aiOfferThreshold: 0.5, rejectBelow: 0.5 },
  [ModeId.VibeCoding]: { deterministicThreshold: 0.75, aiOfferThreshold: 0.5, rejectBelow: 0.5 },
  [ModeId.Research]: { deterministicThreshold: 0.78, aiOfferThreshold: 0.55, rejectBelow: 0.55 },
  [ModeId.Browser]: { deterministicThreshold: 0.85, aiOfferThreshold: 0.6, rejectBelow: 0.6 },
  [ModeId.AppTesting]: { deterministicThreshold: 0.8, aiOfferThreshold: 0.55, rejectBelow: 0.55 },
  [ModeId.Review]: { deterministicThreshold: 0.78, aiOfferThreshold: 0.55, rejectBelow: 0.55 },
  [ModeId.Terminal]: { deterministicThreshold: 0.85, aiOfferThreshold: 0.6, rejectBelow: 0.6 },
  [ModeId.StreamControl]: { deterministicThreshold: 0.88, aiOfferThreshold: 0.65, rejectBelow: 0.65 },
  [ModeId.EmergencySafe]: { deterministicThreshold: 0.9, aiOfferThreshold: null, rejectBelow: 0.9 },
};

/** Overlay color hex values per mode (WCAG AA against dark background). */
export const MODE_OVERLAY_COLORS: Record<ModeId, string> = {
  [ModeId.ManualDictation]: '#3B82F6',
  [ModeId.Command]: '#6B7280',
  [ModeId.AiAssist]: '#8B5CF6',
  [ModeId.VibeCoding]: '#D946EF',
  [ModeId.Research]: '#14B8A6',
  [ModeId.Browser]: '#06B6D4',
  [ModeId.AppTesting]: '#22C55E',
  [ModeId.Review]: '#EAB308',
  [ModeId.Terminal]: '#F97316',
  [ModeId.StreamControl]: '#EF4444',
  [ModeId.EmergencySafe]: '#DC2626',
};
