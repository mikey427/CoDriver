/** Supported speech-to-text provider identifiers. */
export const STT_PROVIDER_IDS = ['http-inbox', 'openai-whisper', 'manual'] as const;
export type SttProviderId = (typeof STT_PROVIDER_IDS)[number];

export interface SttProviderInfo {
  id: SttProviderId;
  displayName: string;
  description: string;
  requiresApiKey: boolean;
  supportsMic: boolean;
}

export const STT_PROVIDERS: readonly SttProviderInfo[] = [
  {
    id: 'http-inbox',
    displayName: 'HTTP / Inbox',
    description: 'Text utterances via API, speech inbox files, or PTT with manual text.',
    requiresApiKey: false,
    supportsMic: false,
  },
  {
    id: 'openai-whisper',
    displayName: 'OpenAI Whisper',
    description: 'Cloud transcription via OpenAI Audio API (uses your OpenAI API key).',
    requiresApiKey: true,
    supportsMic: true,
  },
  {
    id: 'manual',
    displayName: 'Manual / Typed',
    description: 'Type or paste utterances in the admin tutorial — no microphone.',
    requiresApiKey: false,
    supportsMic: false,
  },
];

export function getSttProviderInfo(id: string): SttProviderInfo | undefined {
  return STT_PROVIDERS.find((p) => p.id === id);
}
