import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { OnboardingProgress, OnboardingStepId } from '@driftcode/shared';
import { ONBOARDING_STEP_IDS } from '@driftcode/shared';

function defaultProgress(): OnboardingProgress {
  return {
    schemaVersion: 1,
    startedAt: new Date().toISOString(),
    currentStep: 'welcome',
    steps: {},
    tutorialCompletedIds: [],
    micTestPassed: false,
    dismissed: false,
  };
}

export class OnboardingStore {
  private progress: OnboardingProgress;
  private readonly path: string;

  constructor(configDir?: string) {
    const dir = configDir ?? join(homedir(), '.driftcode');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.path = join(dir, 'onboarding.json');
    this.progress = this.load();
  }

  private load(): OnboardingProgress {
    if (!existsSync(this.path)) return defaultProgress();
    try {
      const parsed = JSON.parse(readFileSync(this.path, 'utf-8')) as OnboardingProgress;
      return { ...defaultProgress(), ...parsed };
    } catch {
      return defaultProgress();
    }
  }

  private save(): void {
    writeFileSync(this.path, JSON.stringify(this.progress, null, 2), 'utf-8');
  }

  get(): OnboardingProgress {
    return { ...this.progress };
  }

  getPath(): string {
    return this.path;
  }

  isComplete(): boolean {
    if (this.progress.completedAt) return true;
    const required: OnboardingStepId[] = ['welcome', 'prerequisites', 'stt-config', 'tutorial', 'complete'];
    return required.every((id) => this.progress.steps[id]?.completed);
  }

  setStep(stepId: OnboardingStepId, completed = true): OnboardingProgress {
    this.progress.steps[stepId] = { completed, completedAt: new Date().toISOString() };
    this.progress.currentStep = stepId;
    if (stepId === 'complete' && completed) {
      this.progress.completedAt = new Date().toISOString();
    }
    this.save();
    return this.get();
  }

  advanceTo(stepId: OnboardingStepId): OnboardingProgress {
    this.progress.currentStep = stepId;
    this.save();
    return this.get();
  }

  markTutorialLesson(lessonId: string): OnboardingProgress {
    if (!this.progress.tutorialCompletedIds.includes(lessonId)) {
      this.progress.tutorialCompletedIds.push(lessonId);
    }
    this.save();
    return this.get();
  }

  setMicTestPassed(passed: boolean): OnboardingProgress {
    this.progress.micTestPassed = passed;
    if (passed) {
      this.setStep('mic-test', true);
    }
    this.save();
    return this.get();
  }

  dismiss(): OnboardingProgress {
    this.progress.dismissed = true;
    this.save();
    return this.get();
  }

  reset(): OnboardingProgress {
    this.progress = defaultProgress();
    this.save();
    return this.get();
  }

  nextStep(): OnboardingStepId {
    const idx = ONBOARDING_STEP_IDS.indexOf(this.progress.currentStep);
    return ONBOARDING_STEP_IDS[Math.min(idx + 1, ONBOARDING_STEP_IDS.length - 1)] ?? 'complete';
  }
}
