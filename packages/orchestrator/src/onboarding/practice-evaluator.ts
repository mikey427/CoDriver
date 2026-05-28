import { TUTORIAL_LESSONS } from '@driftcode/shared';
import type { PracticeResult, TutorialLesson } from '@driftcode/shared';
import { IntentType } from '@driftcode/shared';
import type { IntentParser } from '../pipeline/intent-parser.js';
import type { UtteranceNormalizer } from '../pipeline/utterance-normalizer.js';

export class PracticeEvaluator {
  constructor(
    private normalizer: UtteranceNormalizer,
    private parser: IntentParser,
  ) {}

  getLesson(lessonId: string): TutorialLesson | undefined {
    return TUTORIAL_LESSONS.find((l) => l.id === lessonId);
  }

  getLessons(): readonly TutorialLesson[] {
    return TUTORIAL_LESSONS;
  }

  evaluate(lessonId: string, rawText: string): PracticeResult {
    const lesson = this.getLesson(lessonId);
    if (!lesson) {
      return {
        passed: false,
        lessonId,
        utterance: rawText,
        expectedIntentType: 'unknown',
        actualIntentType: 'unknown',
        actualSummary: '',
        feedback: 'Unknown lesson',
        confidence: 0,
      };
    }

    const utterance = this.normalizer.normalize(rawText);
    const intent = this.parser.parse(utterance);

    let passed = intent.intentType === lesson.expectIntentType;

    if (passed && lesson.expectSlots?.modeId) {
      const actualMode = String(intent.slots.modeId ?? '');
      const expected = lesson.expectSlots.modeId;
      passed = actualMode === expected || actualMode.includes(expected.replace('-mode', ''));
    }

    if (passed && lesson.expectIntentType === IntentType.Cancel && lesson.id === 'privacy') {
      passed = Boolean(intent.slots.privacyOn);
    }

    if (passed && lesson.expectIntentType === IntentType.Cancel && lesson.id === 'resume') {
      passed = intent.slots.action === 'clearEmergency' || utterance.normalizedText.includes('resume');
    }

    const feedback = passed
      ? `Correct — parsed as ${intent.intentType}: ${intent.summary}`
      : `Expected ${lesson.expectIntentType}, got ${intent.intentType}. Try: "${lesson.sampleUtterance}"`;

    return {
      passed,
      lessonId,
      utterance: utterance.normalizedText,
      expectedIntentType: lesson.expectIntentType,
      actualIntentType: String(intent.intentType),
      actualSummary: intent.summary,
      feedback,
      confidence: intent.confidence,
    };
  }
}
