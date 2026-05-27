import type { EditorErrorCode, ModeId } from './enums.js';
import type { EditorState } from './models.js';

/** JSON-RPC 2.0 version identifier. */
export type JsonRpcVersion = '2.0';

/** Standard JSON-RPC 2.0 error codes. */
export const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcRequest<TMethod extends string = string, TParams = unknown> {
  jsonrpc: JsonRpcVersion;
  id: string | number;
  method: TMethod;
  params?: TParams;
}

export interface JsonRpcNotification<TMethod extends string = string, TParams = unknown> {
  jsonrpc: JsonRpcVersion;
  method: TMethod;
  params?: TParams;
}

export interface JsonRpcSuccessResponse<TResult = unknown> {
  jsonrpc: JsonRpcVersion;
  id: string | number;
  result: TResult;
}

export interface JsonRpcErrorResponse {
  jsonrpc: JsonRpcVersion;
  id: string | number | null;
  error: JsonRpcError;
}

export type JsonRpcResponse<TResult = unknown> =
  | JsonRpcSuccessResponse<TResult>
  | JsonRpcErrorResponse;

/** WebSocket message methods between orchestrator and VS Code extension. */
export const EXTENSION_RPC_METHODS = {
  /** Extension → Orchestrator: initial handshake with workspace info. */
  HELLO: 'extension.hello',
  /** Orchestrator → Extension: session assignment and config snapshot. */
  WELCOME: 'extension.welcome',
  /** Extension → Orchestrator: lightweight keepalive with focus state. */
  HEARTBEAT: 'extension.heartbeat',
  /** Either direction: graceful shutdown. */
  DISCONNECT: 'extension.disconnect',
  /** Extension → Orchestrator: push full or delta editor state. */
  EDITOR_STATE_CHANGED: 'editor.stateChanged',
  /** Orchestrator → Extension: request current editor snapshot. */
  EDITOR_GET_STATE: 'editor.getState',
  /** Orchestrator → Extension: execute an editor command. */
  EDITOR_EXECUTE: 'editor.execute',
  /** Extension → Orchestrator: result of editor.execute (JSON-RPC response). */
  EDITOR_RESULT: 'editor.result',
  /** Orchestrator → Extension: cancel in-flight editor command. */
  EDITOR_CANCEL: 'editor.cancel',
} as const;

export type ExtensionRpcMethod =
  (typeof EXTENSION_RPC_METHODS)[keyof typeof EXTENSION_RPC_METHODS];

export interface ExtensionHelloParams {
  extensionVersion: string;
  vscodeVersion: string;
  workspaceFolders: Array<{ name: string; uri: string; index: number }>;
  capabilities: string[];
  authToken: string;
}

export interface ExtensionWelcomeParams {
  sessionId: string;
  privacyFlags?: {
    streamPrivacyActive?: boolean;
    redactOverlayContent?: boolean;
    redactTranscript?: boolean;
  };
  orchestratorVersion?: string;
}

export interface ExtensionHeartbeatParams {
  vscodeFocused: boolean;
  editorFocused: boolean;
  sequenceNumber?: number;
}

export interface ExtensionDisconnectParams {
  reason?: string;
  graceful?: boolean;
}

/** Partial editor state for delta updates (V1). */
export type EditorStateDelta = Partial<EditorState> & {
  timestamp: string;
  sequenceNumber?: number;
};

export interface EditorStateChangedParams {
  state: EditorState | EditorStateDelta;
  fullSnapshot: boolean;
}

export interface EditorGetStateParams {
  correlationId?: string;
}

export interface EditorGetStateResult {
  state: EditorState;
}

export interface EditorExecuteParams {
  correlationId: string;
  commandId: string;
  params: Record<string, unknown>;
  mode: ModeId | string;
  riskToken?: string;
  timeoutMs?: number;
  dryRun?: boolean;
}

export interface EditorResultPayload {
  correlationId: string;
  success: boolean;
  commandId: string;
  affectedUris?: string[];
  undoGroupId?: string;
  errorCode?: EditorErrorCode | string;
  errorMessage?: string;
  structuredData?: Record<string, unknown>;
}

export interface EditorCancelParams {
  correlationId: string;
  reason?: string;
}

export interface EditorCancelResult {
  cancelled: boolean;
  correlationId: string;
}

/** Extension → Orchestrator notifications (no JSON-RPC id). */
export type ExtensionToOrchestratorNotification =
  | JsonRpcNotification<typeof EXTENSION_RPC_METHODS.HELLO, ExtensionHelloParams>
  | JsonRpcNotification<typeof EXTENSION_RPC_METHODS.HEARTBEAT, ExtensionHeartbeatParams>
  | JsonRpcNotification<typeof EXTENSION_RPC_METHODS.DISCONNECT, ExtensionDisconnectParams>
  | JsonRpcNotification<typeof EXTENSION_RPC_METHODS.EDITOR_STATE_CHANGED, EditorStateChangedParams>;

/** Orchestrator → Extension notifications (no JSON-RPC id). */
export type OrchestratorToExtensionNotification =
  | JsonRpcNotification<typeof EXTENSION_RPC_METHODS.WELCOME, ExtensionWelcomeParams>
  | JsonRpcNotification<typeof EXTENSION_RPC_METHODS.DISCONNECT, ExtensionDisconnectParams>;

/** Orchestrator → Extension requests expecting a response. */
export type OrchestratorToExtensionRequest =
  | JsonRpcRequest<typeof EXTENSION_RPC_METHODS.EDITOR_EXECUTE, EditorExecuteParams>
  | JsonRpcRequest<typeof EXTENSION_RPC_METHODS.EDITOR_GET_STATE, EditorGetStateParams>
  | JsonRpcRequest<typeof EXTENSION_RPC_METHODS.EDITOR_CANCEL, EditorCancelParams>;

/** Extension → Orchestrator JSON-RPC responses. */
export type ExtensionToOrchestratorResponse =
  | JsonRpcSuccessResponse<EditorResultPayload>
  | JsonRpcSuccessResponse<EditorGetStateResult>
  | JsonRpcSuccessResponse<EditorCancelResult>
  | JsonRpcErrorResponse;

/** All inbound messages the orchestrator accepts from the extension. */
export type OrchestratorInboundMessage =
  | ExtensionToOrchestratorNotification
  | JsonRpcRequest<typeof EXTENSION_RPC_METHODS.EDITOR_RESULT, EditorResultPayload>
  | ExtensionToOrchestratorResponse;

/** All inbound messages the extension accepts from the orchestrator. */
export type ExtensionInboundMessage =
  | OrchestratorToExtensionNotification
  | OrchestratorToExtensionRequest;

/** Union of every WebSocket JSON-RPC payload in the extension protocol. */
export type ExtensionProtocolMessage =
  | OrchestratorInboundMessage
  | ExtensionInboundMessage;

/** Maps each request method to its expected result type. */
export interface ExtensionRpcResultMap {
  [EXTENSION_RPC_METHODS.EDITOR_EXECUTE]: EditorResultPayload;
  [EXTENSION_RPC_METHODS.EDITOR_GET_STATE]: EditorGetStateResult;
  [EXTENSION_RPC_METHODS.EDITOR_CANCEL]: EditorCancelResult;
}

/** Maps each notification/request method to its params type. */
export interface ExtensionRpcParamsMap {
  [EXTENSION_RPC_METHODS.HELLO]: ExtensionHelloParams;
  [EXTENSION_RPC_METHODS.WELCOME]: ExtensionWelcomeParams;
  [EXTENSION_RPC_METHODS.HEARTBEAT]: ExtensionHeartbeatParams;
  [EXTENSION_RPC_METHODS.DISCONNECT]: ExtensionDisconnectParams;
  [EXTENSION_RPC_METHODS.EDITOR_STATE_CHANGED]: EditorStateChangedParams;
  [EXTENSION_RPC_METHODS.EDITOR_GET_STATE]: EditorGetStateParams;
  [EXTENSION_RPC_METHODS.EDITOR_EXECUTE]: EditorExecuteParams;
  [EXTENSION_RPC_METHODS.EDITOR_RESULT]: EditorResultPayload;
  [EXTENSION_RPC_METHODS.EDITOR_CANCEL]: EditorCancelParams;
}

/** Editor command IDs dispatched via editor.execute. */
export const EDITOR_COMMAND_IDS = {
  INSERT_TEXT: 'editor.insertText',
  APPLY_PATCH: 'editor.applyPatch',
  PREVIEW_PATCH: 'editor.previewPatch',
  NAVIGATE: 'editor.navigate',
  SELECT: 'editor.select',
  TRANSFORM: 'editor.transform',
  RENAME: 'editor.rename',
  EXTRACT: 'editor.extract',
  RUN_VSCODE_COMMAND: 'editor.runVsCodeCommand',
  GET_SELECTION_CONTEXT: 'editor.getSelectionContext',
  GET_DIAGNOSTICS: 'editor.getDiagnostics',
  SAVE: 'editor.save',
  UNDO: 'editor.undo',
  REDO: 'editor.redo',
  PHRASE_UNDO: 'editor.phraseUndo',
} as const;

export type EditorCommandId = (typeof EDITOR_COMMAND_IDS)[keyof typeof EDITOR_COMMAND_IDS];

/** Required confirmation phrases (exact registry). */
export const CONFIRMATION_PHRASE_REGISTRY = {
  execute: 'Confirm execute.',
  destructive: 'Confirm destructive.',
  publish: 'Confirm publish.',
  stream_change: 'Confirm stream change.',
  safety_change: 'Confirm safety change.',
} as const;

/** Global cancel phrases recognized during pending confirmation. */
export const CONFIRMATION_CANCEL_PHRASES = ['cancel', 'abort', 'never mind'] as const;

/** Emergency stop phrases evaluated before grammar parsing. */
export const EMERGENCY_STOP_PHRASES = [
  'stop',
  'stop drift',
  'cancel',
  'abort phrase',
  'emergency stop',
  'stop harness',
  'stop all',
] as const;
