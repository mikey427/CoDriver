import type { HarnessConfig, TranscribeResult } from '@driftcode/shared';
import type pino from 'pino';

export interface TranscribeOptions {
  mimeType?: string;
  language?: string;
  processAsCommand?: boolean;
}

export class SttManager {
  private client: { audio: { transcriptions: { create: (args: unknown) => Promise<{ text?: string }> } } } | null = null;

  constructor(
    private config: HarnessConfig,
    private log: pino.Logger,
  ) {}

  updateConfig(config: HarnessConfig): void {
    this.config = config;
    this.client = null;
    void this.ensureClient();
  }

  getProviderId(): string {
    return this.config.sttProviderId ?? 'http-inbox';
  }

  async ensureClient(): Promise<boolean> {
    if (this.getProviderId() !== 'openai-whisper') return false;
    if (!this.config.openAiApiKey) return false;
    if (this.client) return true;
    try {
      const mod = await import('openai');
      this.client = new mod.default({ apiKey: this.config.openAiApiKey }) as unknown as NonNullable<typeof this.client>;
      return true;
    } catch {
      this.log.warn('openai peer not installed — Whisper STT unavailable');
      return false;
    }
  }

  async transcribe(audio: Buffer, options: TranscribeOptions = {}): Promise<TranscribeResult> {
    const start = Date.now();
    const providerId = this.getProviderId();

    if (providerId !== 'openai-whisper') {
      throw new Error(`Provider ${providerId} does not support audio transcription`);
    }

    const ready = await this.ensureClient();
    if (!ready || !this.client) {
      throw new Error('OpenAI Whisper unavailable — set openAiApiKey and npm install openai');
    }

    const mime = options.mimeType ?? 'audio/webm';
    const ext = mime.includes('wav') ? 'wav' : mime.includes('mp4') ? 'mp4' : 'webm';
    const vocabulary = this.config.customVocabulary.slice(0, 40).join(', ');
    const prompt = vocabulary
      ? `DriftCode voice coding harness. Vocabulary: ${vocabulary}. Coding commands and symbols.`
      : 'DriftCode voice coding harness. Coding commands, modes, and TypeScript dictation.';

    const file = new File([new Uint8Array(audio)], `utterance.${ext}`, { type: mime });
    const response = await this.client.audio.transcriptions.create({
      file,
      model: this.config.sttModel ?? 'whisper-1',
      language: options.language ?? this.config.sttLanguage ?? 'en',
      prompt,
      response_format: 'json',
    });

    const text = (response.text ?? '').trim();
    return {
      text,
      providerId: 'openai-whisper',
      confidence: text.length > 0 ? 0.88 : 0,
      durationMs: Date.now() - start,
      language: options.language ?? this.config.sttLanguage,
    };
  }
}
