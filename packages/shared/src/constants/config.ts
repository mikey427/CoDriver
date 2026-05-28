import { ModeId } from '../types/enums.js';
import type { HarnessConfig } from '../types/orchestrator.js';

export const CONFIG_SCHEMA_VERSION = 1;

export function createDefaultHarnessConfig(): HarnessConfig {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    serverPort: 17345,
    defaultProfileId: 'default',
    defaultModeId: ModeId.ManualDictation,
    openAiModel: 'gpt-4o-mini',
    sessionCostBudgetUsd: 5,
    emergencyPhrases: ['emergency stop', 'stop harness', 'halt harness'],
    terminalAllowlist: ['npm run *', 'npm test', 'npm install', 'git status', 'git diff'],
    terminalBlocklist: ['rm -rf *', 'del /f', 'format *', 'shutdown *'],
    customVocabulary: ['driftcode', 'typescript', 'vite'],
    speechCorrections: [
      { misrecognition: 'fat aero', correction: 'fat arrow' },
      { misrecognition: 'open braces', correction: 'open brace' },
    ],
    projectRoot: '.',
    devServerCommand: 'npm run dev',
    devServerUrl: 'http://localhost:5173',
    devServerPort: 5173,
    devServerReadyTimeoutMs: 60_000,
    browserProfilePath: '.driftcode/browser-profile',
    browserHeadless: true,
    browserDomainAllowlist: ['localhost', '127.0.0.1'],
    obsEnabled: false,
    obsWebSocketUrl: 'ws://127.0.0.1:4455',
    protectedFileGlobs: ['**/.env*', '**/secrets/**'],
    sttProviderId: 'http-inbox',
    sttModel: 'whisper-1',
    sttLanguage: 'en',
    speechInboxPath: '.driftcode/inbox',
    speechInboxEnabled: true,
    onboardingCompleted: false,
    aiProviderId: 'openai',
    appTestFlows: [
      {
        id: 'login',
        name: 'Login Flow',
        description: 'Sample login smoke test against the local dev server',
        steps: [
          { type: 'navigate', url: '/' },
          { type: 'wait', timeoutMs: 500 },
          { type: 'assertText', text: 'html' },
        ],
      },
    ],
  };
}
