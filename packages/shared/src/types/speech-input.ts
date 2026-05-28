import type { UtteranceSource } from './enums.js';

/** PTT activation origin — not the same as utterance source. */
export type PttSource = 'admin' | 'http' | 'keyboard' | 'unknown';

export interface SpeechInputUtterance {
  id: string;
  text: string;
  source: UtteranceSource;
  confidence?: number;
  isFinal: boolean;
  startedAt?: string;
  completedAt: string;
}

export interface PushToTalkState {
  active: boolean;
  source: PttSource;
  startedAt?: string;
  lastReleasedAt?: string;
  cancelledAt?: string;
}

export interface ProcessUtteranceOptions {
  source?: UtteranceSource;
  confidence?: number;
  isFinal?: boolean;
}

export interface BlockedLowConfidenceRecord {
  text: string;
  confidence: number;
  source: UtteranceSource;
  at: string;
}
