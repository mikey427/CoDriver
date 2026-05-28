import WebSocket from 'ws';
import * as vscode from 'vscode';
import { applyPatch, getSelectionContext } from './commands/apply-patch';
import {
  insertText,
  phraseUndo,
  repeatLastPhrase,
  replaceLastPhrase,
  replaceLastWord,
  deleteLastWord,
} from './commands/insert-text';
import { navigate } from './commands/navigation';
import { wrapInIf } from './commands/wrap-in-if';
import { deleteLine, saveFile, selectFunction, selectLine, selectWord, undo, moveLineUp, moveLineDown, duplicateLine, commentLine, formatDocument } from './commands/structural';
import type {
  ConnectionStatus,
  EditorExecuteParams,
  EditorResult,
  EditorState,
  ExtensionHelloParams,
  InsertTextParams,
  JsonRpcMessage,
  JsonRpcRequest,
  JsonRpcResponse,
  NavigateParams,
} from './types';

export type { ConnectionStatus, EditorState };

const DEFAULT_URL = 'ws://127.0.0.1:17345/ws/vscode';

export class OrchestratorClient implements vscode.Disposable {
  private socket: WebSocket | undefined;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private disposed = false;
  private busy = false;
  private readonly extensionVersion: string;
  private onStatusChange: ((status: ConnectionStatus) => void) | undefined;
  private getStateSnapshot: (() => EditorState) | undefined;

  constructor(extensionVersion: string) {
    this.extensionVersion = extensionVersion;
  }

  setStatusListener(listener: (status: ConnectionStatus) => void): void {
    this.onStatusChange = listener;
  }

  setStateProvider(provider: () => EditorState): void {
    this.getStateSnapshot = provider;
  }

  connect(): void {
    if (this.disposed) {
      return;
    }

    const url = vscode.workspace
      .getConfiguration('driftcode')
      .get<string>('orchestratorUrl', DEFAULT_URL);

    this.setStatus('reconnecting');

    try {
      this.socket = new WebSocket(url);
    } catch (error) {
      this.scheduleReconnect();
      return;
    }

    this.socket.on('open', () => {
      this.setStatus('connected');
      this.sendHello();
    });

    this.socket.on('message', (data) => {
      this.handleMessage(data.toString());
    });

    this.socket.on('close', () => {
      this.socket = undefined;
      this.setStatus('reconnecting');
      this.scheduleReconnect();
    });

    this.socket.on('error', () => {
      this.setStatus('degraded');
    });
  }

  reconnect(): void {
    this.disconnect(false);
    this.connect();
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  notify(method: string, params?: unknown): void {
    if (!this.isConnected()) {
      return;
    }
    this.send({ jsonrpc: '2.0', method, params });
  }

  dispose(): void {
    this.disposed = true;
    this.disconnect(true);
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private disconnect(graceful: boolean): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.socket) {
      if (graceful && this.socket.readyState === WebSocket.OPEN) {
        this.notify('extension.disconnect', { reason: 'extension_deactivate' });
      }
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = undefined;
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer) {
      return;
    }

    const delay = vscode.workspace.getConfiguration('driftcode').get<number>('reconnectDelayMs', 2000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, delay);
  }

  private sendHello(): void {
    const workspaceFolders =
      vscode.workspace.workspaceFolders?.map((folder, index) => ({
        name: folder.name,
        uri: folder.uri.toString(),
        index,
      })) ?? [];

    const params: ExtensionHelloParams = {
      extensionVersion: this.extensionVersion,
      vscodeVersion: vscode.version,
      workspaceFolders,
      capabilities: [
        'editor.insertText',
        'editor.save',
        'editor.deleteLine',
        'editor.selectFunction',
        'editor.navigate',
        'editor.undo',
        'editor.phraseUndo',
        'editor.replaceLastPhrase',
        'editor.replaceLastWord',
        'editor.deleteLastWord',
        'editor.repeatLastPhrase',
        'editor.applyPatch',
        'editor.wrapInIf',
        'editor.getSelectionContext',
        'editor.stateChanged',
      ],
    };

    this.notify('extension.hello', params);
  }

  private async handleMessage(raw: string): Promise<void> {
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(raw) as JsonRpcMessage;
    } catch {
      return;
    }

    if (!('method' in message) || message.method === undefined) {
      return;
    }

    if (!('id' in message) || message.id === undefined) {
      return;
    }

    const request = message as JsonRpcRequest;

    switch (request.method) {
      case 'editor.execute':
        await this.handleEditorExecute(request);
        break;
      case 'editor.getState':
        this.respond(request.id, this.getStateSnapshot?.() ?? { ready: false });
        break;
      default:
        this.respondError(request.id, -32601, `Method not found: ${request.method}`);
    }
  }

  private async handleEditorExecute(request: JsonRpcRequest): Promise<void> {
    const payload = request.params as EditorExecuteParams | undefined;
    if (!payload?.commandId || !payload.correlationId) {
      this.respondError(request.id, -32602, 'Invalid editor.execute params');
      return;
    }

    if (this.busy) {
      this.respond(request.id, this.withCorrelation(payload, {
        success: false,
        errorCode: 'BUSY',
        errorMessage: 'Prior command in flight',
      }));
      return;
    }

    this.busy = true;
    let result: EditorResult;

    try {
      result = await this.dispatchCommand(payload.commandId, payload.params ?? {});
      result.correlationId = payload.correlationId;
      result.commandId = payload.commandId;
    } catch (error) {
      result = {
        correlationId: payload.correlationId,
        commandId: payload.commandId,
        success: false,
        errorCode: 'EXECUTION_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.busy = false;
    }

    this.respond(request.id, result);
  }

  private async dispatchCommand(
    commandId: string,
    params: Record<string, unknown>,
  ): Promise<EditorResult> {
    switch (commandId) {
      case 'editor.insertText':
        return insertText(params as unknown as InsertTextParams);
      case 'editor.save':
        return saveFile(typeof params.uri === 'string' ? params.uri : undefined);
      case 'editor.deleteLine':
        return deleteLine();
      case 'editor.selectFunction':
        return selectFunction();
      case 'editor.selectLine':
        return selectLine();
      case 'editor.selectWord':
        return selectWord();
      case 'editor.moveLineUp':
        return moveLineUp();
      case 'editor.moveLineDown':
        return moveLineDown();
      case 'editor.duplicateLine':
        return duplicateLine();
      case 'editor.commentLine':
        return commentLine();
      case 'editor.formatDocument':
        return formatDocument();
      case 'editor.wrapInIf':
        return wrapInIf(typeof params.condition === 'string' ? params.condition : undefined);
      case 'editor.navigate':
        return navigate(params as unknown as NavigateParams);
      case 'editor.undo':
        return undo();
      case 'editor.phraseUndo':
        return phraseUndo();
      case 'editor.replaceLastPhrase':
        return replaceLastPhrase(String(params.replacement ?? params.text ?? ''));
      case 'editor.replaceLastWord':
        return replaceLastWord(String(params.replacement ?? params.text ?? ''));
      case 'editor.deleteLastWord':
        return deleteLastWord();
      case 'editor.repeatLastPhrase':
        return repeatLastPhrase();
      case 'editor.applyPatch':
        return applyPatch(params as { path?: string; content?: string; oldText?: string; newText?: string });
      case 'editor.getSelectionContext':
        return getSelectionContext();
      default:
        return {
          correlationId: '',
          commandId,
          success: false,
          errorCode: 'INVALID_PARAMS',
          errorMessage: `Unsupported commandId: ${commandId}`,
        };
    }
  }

  private withCorrelation(payload: EditorExecuteParams, result: Partial<EditorResult>): EditorResult {
    return {
      correlationId: payload.correlationId,
      commandId: payload.commandId,
      success: result.success ?? false,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      description: result.description,
      undoGroupId: result.undoGroupId,
      affectedUris: result.affectedUris,
    };
  }

  private respond(id: string | number, result: unknown): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      result,
    };
    this.send(response);
  }

  private respondError(id: string | number, code: number, message: string): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      error: { code, message },
    };
    this.send(response);
  }

  private send(payload: unknown): void {
    if (!this.isConnected() || !this.socket) {
      return;
    }
    this.socket.send(JSON.stringify(payload));
  }

  private setStatus(status: ConnectionStatus): void {
    this.onStatusChange?.(status);
  }
}
