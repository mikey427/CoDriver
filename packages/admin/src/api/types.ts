export type {
  DashboardState,
  DashboardParsedIntent,
  DashboardUtterance,
  HarnessConfig,
  ModeId,
  OnboardingProgress,
  OnboardingStepId,
  PracticeResult,
  RuntimeEvent,
  SttProviderInfo,
  TutorialLesson,
  UtteranceResponse,
  UtteranceSource,
  PushToTalkState,
} from '@driftcode/shared';

import type {
  HarnessConfig,
  OnboardingProgress,
  RuntimeEvent,
  ModeId,
  SttProviderInfo,
  TutorialLesson,
} from '@driftcode/shared';

export type { HarnessAppTestFlow, HarnessAppTestStep } from '@driftcode/shared';

export interface CommandAliasRow {
  id: string;
  aliasPhrases: string[];
  targetCommandId: string;
  targetCommandName?: string;
  modeAllowlist: string[];
  priority: number;
  enabled: boolean;
  requiresExactMatch: boolean;
  notes?: string;
}

export interface ConfigResponse {
  config: HarnessConfig & { openAiApiKey?: string };
  path: string;
}

export interface EventsQuery {
  severity?: RuntimeEvent['severity'];
  subsystem?: RuntimeEvent['subsystem'];
  search?: string;
  limit?: number;
}

export interface EventsResponse {
  events: RuntimeEvent[];
  total: number;
}

export interface SafetyView {
  locked: boolean;
  confirmationStrictness: string;
  emergencyPhrases: string[];
  terminalAllowlist: string[];
  terminalBlocklist: string[];
  sessionCostBudgetUsd?: number;
}

export interface SttSettingsView {
  providerId: string;
  sttModel: string;
  sttLanguage: string;
  micDeviceId?: string;
  wakePhraseEnabled: boolean;
  customVocabulary: string[];
  speechCorrections: HarnessConfig['speechCorrections'];
  whisperAvailable: boolean;
}

export interface OnboardingResponse {
  progress: OnboardingProgress;
  isComplete: boolean;
  prerequisites: Record<string, boolean>;
  tutorialLessons: TutorialLesson[];
}

export interface SttProvidersResponse {
  providers: SttProviderInfo[];
  activeId: string;
}

export interface TranscribeResponse {
  ok: boolean;
  transcript: string;
  processed?: boolean;
}

export interface OpenAiSettingsView {
  apiKeyMasked: string;
  hasApiKey: boolean;
  defaultModel: string;
  sessionBudgetUsd?: number;
}

export interface ModesResponse {
  modes: Array<ModeId | string>;
  activeModeId?: ModeId | string;
}
