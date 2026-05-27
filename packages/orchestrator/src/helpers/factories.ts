import { v4 as uuidv4 } from 'uuid';
import {
  AdapterType,
  ConfidenceBand,
  ConnectionHealth,
  DevServerStatus,
  FocusTarget,
  IntentType,
  ModeId,
  ParsePath,
  RuntimeSubsystem,
  ToolRequestPriority,
  ToolRequestSource,
  ToolRequestStatus,
  ToolResultType,
} from '@driftcode/shared';
import type {
  DashboardParsedIntent,
  EditorState,
  HarnessConfig,
  ToolRequest,
  ToolResult,
} from '@driftcode/shared';
import { DEFAULT_MODE_CONFIGS } from '@driftcode/shared';

export const SCHEMA_VERSION = 1;

export interface InternalParsedIntent {
  id: string;
  utteranceId: string;
  intentType: IntentType;
  commandId?: string;
  confidence: number;
  confidenceBand: ConfidenceBand;
  slots: Record<string, unknown>;
  literalPayload?: string;
  targetAdapter?: AdapterType;
  requiresAiFallback: boolean;
  routingPath: 'deterministic' | 'ai' | 'blocked';
  summary: string;
}

export interface InternalUtterance {
  id: string;
  rawText: string;
  normalizedText: string;
  timestamp: string;
  isEmergencyPhrase: boolean;
  tokens: string[];
  wordCount: number;
  isEmpty: boolean;
}

export function modeDisplayName(modeId: ModeId | string): string {
  const config = DEFAULT_MODE_CONFIGS[modeId as ModeId];
  return config?.displayName ?? String(modeId);
}

export function createUtterance(
  rawText: string,
  config: HarnessConfig,
  isEmergencyPhrase: boolean,
): InternalUtterance {
  let text = rawText.trim().toLowerCase().replace(/\s+/g, ' ');
  for (const correction of config.speechCorrections) {
    const pattern = correction.misrecognition.toLowerCase();
    if (text.includes(pattern)) {
      text = text.replaceAll(pattern, correction.correction.toLowerCase());
    }
  }
  const tokens = text.split(/\s+/).filter(Boolean);
  return {
    id: uuidv4(),
    rawText,
    normalizedText: text,
    timestamp: new Date().toISOString(),
    isEmergencyPhrase,
    tokens,
    wordCount: tokens.length,
    isEmpty: text.length === 0,
  };
}

export function toDashboardIntent(intent: InternalParsedIntent): DashboardParsedIntent {
  return {
    id: intent.id,
    summary: intent.summary,
    routingPath: intent.routingPath,
    intentType: intent.intentType,
    confidence: intent.confidence,
    confidenceBand: intent.confidenceBand,
  };
}

export function createToolRequest(input: {
  sessionId: string;
  correlationId: string;
  adapter: AdapterType;
  action: string;
  parameters: Record<string, unknown>;
  description: string;
  sourceId: string;
  source?: ToolRequestSource;
}): ToolRequest {
  return {
    id: uuidv4(),
    schemaVersion: SCHEMA_VERSION,
    sessionId: input.sessionId,
    correlationId: input.correlationId,
    source: input.source ?? ToolRequestSource.DeterministicIntent,
    sourceId: input.sourceId,
    adapter: input.adapter,
    action: input.action,
    parameters: input.parameters,
    description: input.description,
    priority: ToolRequestPriority.Normal,
    requiresRiskCheck: true,
    status: ToolRequestStatus.Pending,
    createdAt: new Date().toISOString(),
  };
}

export function createToolResult(input: {
  toolRequest: ToolRequest;
  success: boolean;
  message?: string;
  structuredData?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  durationMs?: number;
}): ToolResult {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    schemaVersion: SCHEMA_VERSION,
    toolRequestId: input.toolRequest.id,
    sessionId: input.toolRequest.sessionId,
    correlationId: input.toolRequest.correlationId,
    adapter: input.toolRequest.adapter,
    action: input.toolRequest.action,
    success: input.success,
    resultType: input.success ? ToolResultType.Structured : ToolResultType.Text,
    output: input.message,
    structuredData: input.structuredData,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    durationMs: input.durationMs ?? 0,
    startedAt: now,
    completedAt: now,
    auditRedacted: false,
    retryCount: 0,
  };
}

export function emptyEditorState(): EditorState {
  return {
    timestamp: new Date().toISOString(),
    connected: false,
    workspaceFolders: [],
    openEditors: [],
    diagnostics: [],
    isDirty: false,
    tabCount: 0,
    extensionVersion: '0.0.0',
    capabilities: [],
  };
}

export function defaultAdapterHealth() {
  return {
    vscode: ConnectionHealth.Disconnected,
    terminal: ConnectionHealth.Connected,
    browser: ConnectionHealth.Disconnected,
    openai: ConnectionHealth.Disconnected,
    stt: ConnectionHealth.Disconnected,
    obs: ConnectionHealth.Disconnected,
    admin: ConnectionHealth.Connected,
  };
}

export function defaultDevServerStatus(): DevServerStatus {
  return DevServerStatus.Stopped;
}

export function defaultFocusTarget(): FocusTarget {
  return FocusTarget.Vscode;
}

export function subsystemForAdapter(adapter: AdapterType): RuntimeSubsystem {
  switch (adapter) {
    case AdapterType.Vscode:
      return RuntimeSubsystem.Vscode;
    case AdapterType.Terminal:
      return RuntimeSubsystem.Terminal;
    case AdapterType.Browser:
      return RuntimeSubsystem.Browser;
    case AdapterType.Ai:
      return RuntimeSubsystem.Ai;
    default:
      return RuntimeSubsystem.Orchestrator;
  }
}
