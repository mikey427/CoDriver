import type { OnboardingStepId } from '../constants/onboarding.js';

export type { TutorialLesson } from '../constants/onboarding.js';
export { TUTORIAL_LESSONS, ONBOARDING_CHECKLIST, ONBOARDING_STEP_IDS } from '../constants/onboarding.js';

export interface OnboardingStepProgress {
  completed: boolean;
  completedAt?: string;
}

export interface OnboardingProgress {
  schemaVersion: 1;
  startedAt: string;
  completedAt?: string;
  currentStep: OnboardingStepId;
  steps: Partial<Record<OnboardingStepId, OnboardingStepProgress>>;
  tutorialCompletedIds: string[];
  micTestPassed?: boolean;
  dismissed?: boolean;
}

export interface PracticeResult {
  passed: boolean;
  lessonId: string;
  utterance: string;
  expectedIntentType: string;
  actualIntentType: string;
  actualSummary: string;
  feedback: string;
  confidence: number;
}

export interface TranscribeResult {
  text: string;
  providerId: string;
  confidence: number;
  durationMs: number;
  language?: string;
}
