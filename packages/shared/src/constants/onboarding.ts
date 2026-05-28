/** Built-in onboarding wizard step IDs. */
export const ONBOARDING_STEP_IDS = [
  'welcome',
  'prerequisites',
  'stt-config',
  'vscode-extension',
  'mic-test',
  'tutorial',
  'complete',
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export interface TutorialLesson {
  id: string;
  title: string;
  description: string;
  /** Example phrase the user should say or type. */
  sampleUtterance: string;
  /** Expected intent type after parsing (IntentType enum value). */
  expectIntentType: string;
  /** Optional slot checks. */
  expectSlots?: Record<string, string>;
  /** Setup commands run before this lesson (not executed — hints only). */
  setupHint?: string;
  category: 'modes' | 'dictation' | 'safety' | 'navigation' | 'status';
}

export const TUTORIAL_LESSONS: readonly TutorialLesson[] = [
  {
    id: 'switch-command',
    title: 'Switch to Command Mode',
    description: 'Command mode is for structural editor actions — delete line, save, navigate.',
    sampleUtterance: 'switch command mode',
    expectIntentType: 'mode_switch',
    expectSlots: { modeId: 'command' },
    category: 'modes',
  },
  {
    id: 'switch-dictation',
    title: 'Switch to Manual Dictation',
    description: 'Dictation mode inserts code tokens at the cursor without calling AI.',
    sampleUtterance: 'switch manual dictation mode',
    expectIntentType: 'mode_switch',
    expectSlots: { modeId: 'manual-dictation' },
    category: 'modes',
  },
  {
    id: 'what-mode',
    title: 'Ask Current Mode',
    description: 'Check which mode is active before issuing editor commands.',
    sampleUtterance: 'what mode',
    expectIntentType: 'noop',
    category: 'status',
  },
  {
    id: 'dictation-const',
    title: 'Dictate a Constant',
    description: 'In manual dictation mode, speak code grammar: "const name equals value".',
    sampleUtterance: 'const user equals await get user open paren id close paren',
    expectIntentType: 'dictation',
    setupHint: 'Say "switch manual dictation mode" first.',
    category: 'dictation',
  },
  {
    id: 'delete-line',
    title: 'Delete Current Line',
    description: 'Structural command — works in command or dictation-friendly modes.',
    sampleUtterance: 'delete current line',
    expectIntentType: 'editor_transform',
    setupHint: 'Say "switch command mode" first.',
    category: 'navigation',
  },
  {
    id: 'go-to-line',
    title: 'Go to Line',
    description: 'Navigate the editor by line number (requires VS Code extension connected).',
    sampleUtterance: 'go to line 1',
    expectIntentType: 'editor_transform',
    setupHint: 'Say "switch ai assist mode" for navigation commands.',
    category: 'navigation',
  },
  {
    id: 'emergency-stop',
    title: 'Emergency Stop',
    description: 'Immediately halts actions and enters safe mode. Practice this before going live.',
    sampleUtterance: 'emergency stop',
    expectIntentType: 'emergency_stop',
    category: 'safety',
  },
  {
    id: 'resume',
    title: 'Resume After Emergency',
    description: 'Clears emergency stop and restores the previous mode.',
    sampleUtterance: 'resume previous mode',
    expectIntentType: 'cancel',
    setupHint: 'Say "emergency stop" first, then resume.',
    category: 'safety',
  },
  {
    id: 'privacy',
    title: 'Toggle Privacy Mode',
    description: 'Redacts sensitive text on the stream overlay.',
    sampleUtterance: 'privacy on',
    expectIntentType: 'cancel',
    category: 'safety',
  },
];

export const ONBOARDING_CHECKLIST = [
  { id: 'orchestrator', label: 'Orchestrator running', check: 'health' as const },
  { id: 'openai', label: 'OpenAI API key (for Whisper + AI assist)', check: 'openai' as const },
  { id: 'stt', label: 'STT provider configured', check: 'stt' as const },
  { id: 'vscode', label: 'VS Code extension connected', check: 'vscode' as const },
  { id: 'mic', label: 'Microphone test passed', check: 'mic' as const },
  { id: 'tutorial', label: 'Tutorial lessons completed', check: 'tutorial' as const },
] as const;
