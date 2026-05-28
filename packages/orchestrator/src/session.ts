import { v4 as uuidv4 } from 'uuid';
import {
  DevServerStatus,
  FocusTarget,
  ModeId,
} from '@driftcode/shared';
import type {
  DashboardCommandHistoryEntry,
  DashboardParsedIntent,
  DashboardUtterance,
  HarnessConfig,
  ToolResult,
} from '@driftcode/shared';
import type { EditorState } from '@driftcode/shared';
import type { DictationPhraseRecord } from './pipeline/code-grammar/grammar-types.js';
import {
  defaultDevServerStatus,
  defaultFocusTarget,
  emptyEditorState,
  modeDisplayName,
} from './helpers/factories.js';

export type { DictationPhraseRecord };

export class Session {
  readonly sessionId: string;
  readonly startedAt: string;

  activeModeId: ModeId | string;
  previousModeId?: ModeId | string;
  activeProfileId: string;
  activeProjectId?: string;
  workspaceRoot?: string;
  emergencyStopActive = false;
  streamPrivacyActive = false;
  lastNormalizedUtterance?: DashboardUtterance;
  lastParsedIntent?: DashboardParsedIntent;
  editorState: EditorState = emptyEditorState();
  browserState: { connected: boolean; url?: string; domain?: string } = { connected: false };
  focusTarget: FocusTarget | string = defaultFocusTarget();
  sessionCostUsd = 0;
  aiCallsThisSession = 0;
  deterministicCommandStreak = 0;
  devServerStatus: DevServerStatus | string = defaultDevServerStatus();
  commandHistory: DashboardCommandHistoryEntry[] = [];
  lastToolResults: ToolResult[] = [];
  /** Legacy text-only history — kept for compatibility */
  dictationHistory: string[] = [];
  dictationPhrases: DictationPhraseRecord[] = [];
  lastUtteranceForRepeat?: string;
  activeAiTask?: { summary: string; taskType: string; status: string };
  pendingPatchSummary?: string;

  constructor(config: HarnessConfig) {
    this.sessionId = uuidv4();
    this.startedAt = new Date().toISOString();
    this.activeModeId = config.defaultModeId;
    this.activeProfileId = config.defaultProfileId;
  }

  get activeModeDisplayName(): string {
    return modeDisplayName(this.activeModeId);
  }

  pushToolResult(result: ToolResult): void {
    this.lastToolResults.push(result);
    if (this.lastToolResults.length > 20) this.lastToolResults.shift();
  }

  pushCommandHistory(entry: DashboardCommandHistoryEntry): void {
    this.commandHistory.unshift(entry);
    if (this.commandHistory.length > 50) this.commandHistory.pop();
  }

  pushDictationPhrase(record: DictationPhraseRecord): void {
    this.dictationPhrases.push(record);
    this.dictationHistory.push(record.text);
    if (this.dictationPhrases.length > 50) this.dictationPhrases.shift();
    if (this.dictationHistory.length > 50) this.dictationHistory.shift();
  }

  getLastDictationPhrase(): DictationPhraseRecord | undefined {
    return this.dictationPhrases[this.dictationPhrases.length - 1];
  }

  popLastDictationPhrase(): DictationPhraseRecord | undefined {
    const last = this.dictationPhrases.pop();
    if (last) this.dictationHistory.pop();
    return last;
  }

  pushDictationUnit(text: string): void {
    this.dictationHistory.push(text);
    if (this.dictationHistory.length > 50) this.dictationHistory.shift();
  }

  popLastDictationUnit(): string | undefined {
    return this.dictationHistory.pop();
  }

  activateEmergency(): void {
    this.emergencyStopActive = true;
    this.previousModeId = this.activeModeId;
    this.activeModeId = ModeId.EmergencySafe;
  }

  clearEmergency(): void {
    this.emergencyStopActive = false;
    if (this.previousModeId && this.previousModeId !== ModeId.EmergencySafe) {
      this.activeModeId = this.previousModeId;
    }
  }
}
