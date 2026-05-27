import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import {
  AdapterType,
  ConnectionHealth,
  RuntimeSubsystem,
} from '@driftcode/shared';
import type {
  EditorState,
  JsonRpcErrorResponse,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcSuccessResponse,
  ToolRequest,
  ToolResult,
} from '@driftcode/shared';
import type { EventBus } from '../event-bus.js';
import type { Session } from '../session.js';
import { createToolResult } from '../helpers/factories.js';
import type pino from 'pino';
import { mapToSessionEditorState } from './editor-state-mapper.js';

const ACTION_TO_COMMAND: Record<string, string> = {
  insertText: 'editor.insertText',
  deleteLine: 'editor.deleteLine',
  selectFunction: 'editor.selectFunction',
  undoPhrase: 'editor.phraseUndo',
  undo: 'editor.undo',
  save: 'editor.save',
  navigate: 'editor.navigate',
  applyPatch: 'editor.applyPatch',
  moveLineUp: 'editor.moveLineUp',
  moveLineDown: 'editor.moveLineDown',
  duplicateLine: 'editor.duplicateLine',
  commentLine: 'editor.commentLine',
  selectLine: 'editor.selectLine',
  selectWord: 'editor.selectWord',
  formatDocument: 'editor.formatDocument',
};

function toCommandId(action: string): string {
  if (action.startsWith('editor.')) return action;
  return ACTION_TO_COMMAND[action] ?? `editor.${action}`;
}

function isErrorResponse(res: JsonRpcResponse): res is JsonRpcErrorResponse {
  return 'error' in res;
}

function isSuccessResponse(res: JsonRpcResponse): res is JsonRpcSuccessResponse {
  return 'result' in res;
}

export class VscodeAdapter {
  private ws?: WebSocket;
  private pending = new Map<string | number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();

  constructor(
    private session: Session,
    private eventBus: EventBus,
    private log: pino.Logger,
  ) {}

  attach(ws: WebSocket): void {
    this.ws = ws;
    this.session.editorState = { ...this.session.editorState, connected: true, timestamp: new Date().toISOString() };
    this.eventBus.emit('adapter.connected', { adapter: 'vscode' }, { subsystem: RuntimeSubsystem.Vscode });

    ws.on('message', (data) => {
      try {
        this.handleMessage(JSON.parse(data.toString()));
      } catch (err) {
        this.log.warn({ err }, 'Invalid JSON-RPC from VS Code extension');
      }
    });
    ws.on('close', () => this.detach());
  }

  detach(): void {
    this.ws = undefined;
    this.session.editorState = { ...this.session.editorState, connected: false, timestamp: new Date().toISOString() };
    this.eventBus.emit('adapter.disconnected', { adapter: 'vscode' }, { subsystem: RuntimeSubsystem.Vscode });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private handleMessage(msg: JsonRpcRequest | JsonRpcNotification | JsonRpcResponse): void {
    if ('method' in msg && msg.method) {
      if ('id' in msg && msg.id !== undefined) {
        if (msg.method === 'extension.hello') {
          const params = (msg as JsonRpcRequest).params as Record<string, unknown> | undefined;
          const folders = params?.workspaceFolders as Array<{ uri?: string }> | undefined;
          const firstUri = folders?.[0]?.uri;
          if (firstUri && firstUri.startsWith('file://')) {
            this.session.workspaceRoot = decodeURIComponent(firstUri.replace(/^file:\/\//, ''));
          }
          this.send({ jsonrpc: '2.0', id: msg.id, result: { ok: true, sessionId: this.session.sessionId } });
        } else {
          this.send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } });
        }
      } else if (msg.method === 'editor.stateChanged') {
        const params = (msg as JsonRpcNotification).params as Record<string, unknown> | undefined;
        const mapped = mapToSessionEditorState(params ?? {}, this.session.editorState);
        if (mapped) {
          this.session.editorState = mapped;
          this.eventBus.emit('session.updated', {}, { subsystem: RuntimeSubsystem.Vscode });
        }
      }
      return;
    }

    if ('id' in msg && msg.id != null && ('result' in msg || 'error' in msg)) {
      const res = msg as JsonRpcResponse;
      const pending = this.pending.get(res.id as string | number);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(res.id as string | number);
      if (isErrorResponse(res)) pending.reject(new Error(res.error.message));
      else if (isSuccessResponse(res)) pending.resolve(res.result);
    }
  }

  async getSelectionContext(): Promise<{ success: boolean; context?: string; errorMessage?: string }> {
    if (!this.isConnected()) return { success: false, errorMessage: 'Not connected' };
    try {
      const result = (await this.call('editor.execute', {
        commandId: 'editor.getSelectionContext',
        correlationId: randomUUID(),
        params: {},
      })) as { success?: boolean; context?: string; errorMessage?: string };
      return { success: Boolean(result.success), context: result.context, errorMessage: result.errorMessage };
    } catch (err) {
      return { success: false, errorMessage: err instanceof Error ? err.message : 'Failed' };
    }
  }

  async execute(request: ToolRequest): Promise<ToolResult> {
    const start = Date.now();
    if (!this.isConnected()) {
      return createToolResult({
        toolRequest: request,
        success: false,
        errorCode: 'NOT_CONNECTED',
        errorMessage: 'VS Code extension not connected',
        durationMs: Date.now() - start,
      });
    }
    if (this.session.emergencyStopActive) {
      return createToolResult({
        toolRequest: request,
        success: false,
        errorCode: 'EMERGENCY_STOP',
        errorMessage: 'Emergency stop active',
        durationMs: Date.now() - start,
      });
    }

    const commandId = toCommandId(request.action);
    const params = { ...request.parameters };
    if (params.literalPayload != null && commandId === 'editor.insertText') {
      params.text = params.literalPayload;
    }

    try {
      const result = (await this.call('editor.execute', {
        commandId,
        correlationId: request.correlationId,
        params,
      })) as { success?: boolean; errorCode?: string; errorMessage?: string; description?: string };

      const literal = request.parameters.literalPayload;
      if (literal && commandId === 'editor.insertText' && result.success !== false) {
        this.session.pushDictationUnit(String(literal));
      }

      return createToolResult({
        toolRequest: request,
        success: result.success !== false,
        message: result.description ?? 'Editor command executed',
        structuredData: result as Record<string, unknown>,
        errorCode: result.success === false ? result.errorCode : undefined,
        errorMessage: result.errorMessage,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      return createToolResult({
        toolRequest: request,
        success: false,
        errorCode: 'EXECUTE_FAILED',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        durationMs: Date.now() - start,
      });
    }
  }

  getConnectionHealth(): ConnectionHealth {
    return this.isConnected() ? ConnectionHealth.Connected : ConnectionHealth.Disconnected;
  }

  private call(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, 30_000);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  private send(msg: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification): void {
    this.ws?.send(JSON.stringify(msg));
  }
}
