import * as vscode from 'vscode';
import type { OrchestratorClient } from './orchestrator-client';
import type { ConnectionStatus, EditorState } from './types';

const PERIODIC_PUSH_MS = 5000;

export class StateReporter implements vscode.Disposable {
  private sequenceNumber = 0;
  private debounceTimer: NodeJS.Timeout | undefined;
  private periodicTimer: NodeJS.Timeout | undefined;
  private disposables: vscode.Disposable[] = [];
  private connectionStatus: ConnectionStatus = 'reconnecting';

  constructor(
    private readonly client: OrchestratorClient,
    private readonly extensionVersion: string,
    private readonly getDebounceMs: () => number,
  ) {}

  start(): void {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.schedulePush()),
      vscode.window.onDidChangeTextEditorSelection(() => this.schedulePush()),
      vscode.workspace.onDidChangeTextDocument(() => this.schedulePush()),
      vscode.workspace.onDidSaveTextDocument(() => this.schedulePush()),
      vscode.window.onDidChangeWindowState(() => this.schedulePush()),
      vscode.languages.onDidChangeDiagnostics(() => this.schedulePush()),
    );

    this.periodicTimer = setInterval(() => this.pushNow(), PERIODIC_PUSH_MS);
    this.schedulePush();
  }

  setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.schedulePush();
  }

  pushNow(): void {
    if (!this.client.isConnected()) {
      return;
    }
    this.sequenceNumber++;
    this.client.notify('editor.stateChanged', { state: this.buildState() });
  }

  getCurrentState(): EditorState {
    return this.buildState();
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
    }
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private schedulePush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => this.pushNow(), this.getDebounceMs());
  }

  private buildState(): EditorState {
    const editor = vscode.window.activeTextEditor;
    const diagnosticCounts = editor
      ? countDiagnostics(vscode.languages.getDiagnostics(editor.document.uri))
      : emptyDiagnosticCounts();

    const workspaceFolders =
      vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];

    return {
      snapshotId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      extensionVersion: this.extensionVersion,
      vscodeVersion: vscode.version,
      connectionStatus: this.connectionStatus,
      sequenceNumber: this.sequenceNumber,
      hasActiveEditor: editor !== undefined,
      activeEditor: editor ? captureActiveEditor(editor) : null,
      cursor: editor ? toPosition(editor.selection.active) : null,
      selections: editor
        ? editor.selections.map((selection) => ({
            anchor: toPosition(selection.anchor),
            active: toPosition(selection.active),
            isEmpty: selection.isEmpty,
          }))
        : [],
      selectedText: editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection) : null,
      diagnosticCounts,
      readyForCommands: this.connectionStatus === 'connected',
      workspaceFolders,
    } as EditorState & { workspaceFolders: string[] };
  }
}

function captureActiveEditor(editor: vscode.TextEditor) {
  const document = editor.document;
  return {
    documentUri: document.uri.toString(),
    relativePath: vscode.workspace.asRelativePath(document.uri, false),
    languageId: document.languageId,
    isDirty: document.isDirty,
    isUntitled: document.isUntitled,
    lineCount: document.lineCount,
  };
}

function toPosition(position: vscode.Position) {
  return { line: position.line, character: position.character };
}

function emptyDiagnosticCounts() {
  return { errors: 0, warnings: 0, infos: 0, hints: 0 };
}

function countDiagnostics(diagnostics: readonly vscode.Diagnostic[]) {
  const counts = emptyDiagnosticCounts();
  for (const diagnostic of diagnostics) {
    switch (diagnostic.severity) {
      case vscode.DiagnosticSeverity.Error:
        counts.errors++;
        break;
      case vscode.DiagnosticSeverity.Warning:
        counts.warnings++;
        break;
      case vscode.DiagnosticSeverity.Information:
        counts.infos++;
        break;
      case vscode.DiagnosticSeverity.Hint:
        counts.hints++;
        break;
    }
  }
  return counts;
}
