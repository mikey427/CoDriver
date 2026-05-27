import type { HarnessConfig } from '@driftcode/shared';
import type { InternalUtterance } from '../helpers/factories.js';
import { createUtterance } from '../helpers/factories.js';

export class UtteranceNormalizer {
  constructor(private config: HarnessConfig) {}

  normalize(rawText: string): InternalUtterance {
    const isEmergencyPhrase = this.detectEmergency(rawText.trim().toLowerCase());
    return createUtterance(rawText, this.config, isEmergencyPhrase);
  }

  detectEmergency(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    return this.config.emergencyPhrases.some(
      (phrase) => normalized === phrase || normalized.includes(phrase),
    );
  }
}
