export type ConnectionStatus = 'connected' | 'reconnecting' | 'degraded';

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface SelectionState {
  anchor: Position;
  active: Position;
  isEmpty: boolean;
}

export interface DiagnosticCounts {
  errors: number;
  warnings: number;
  infos: number;
  hints: number;
}

export interface ActiveEditorState {
  documentUri: string;
  relativePath: string;
  languageId: string;
  isDirty: boolean;
  isUntitled: boolean;
  lineCount: number;
}

export interface EditorState {
  snapshotId: string;
  timestamp: string;
  extensionVersion: string;
  vscodeVersion: string;
  connectionStatus: ConnectionStatus;
  sequenceNumber: number;
  hasActiveEditor: boolean;
  activeEditor: ActiveEditorState | null;
  cursor: Position | null;
  selections: SelectionState[];
  selectedText: string | null;
  diagnosticCounts: DiagnosticCounts;
  readyForCommands: boolean;
}

export interface EditorExecuteParams {
  correlationId: string;
  commandId: string;
  params?: Record<string, unknown>;
  mode?: string;
  riskToken?: string;
  timeoutMs?: number;
  dryRun?: boolean;
}

export interface EditorResult {
  correlationId: string;
  commandId: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  description?: string;
  undoGroupId?: string;
  affectedUris?: string[];
  insertedRange?: Range;
  insertedText?: string;
  phraseRecordId?: string;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

export interface ExtensionHelloParams {
  extensionVersion: string;
  vscodeVersion: string;
  workspaceFolders: Array<{ name: string; uri: string; index: number }>;
  capabilities: string[];
}

export interface InsertTextParams {
  text: string;
  phraseGroupId?: string;
}

export interface NavigateParams {
  file?: string;
  line?: number;
  symbol?: string;
}
