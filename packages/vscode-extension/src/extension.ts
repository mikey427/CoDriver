import * as vscode from 'vscode';
import { OrchestratorClient } from './orchestrator-client';
import { StateReporter } from './state-reporter';

let client: OrchestratorClient | undefined;
let stateReporter: StateReporter | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const extensionVersion =
    context.extension.packageJSON.version ?? '0.0.0';

  client = new OrchestratorClient(extensionVersion);
  stateReporter = new StateReporter(
    client,
    extensionVersion,
    () => vscode.workspace.getConfiguration('driftcode').get<number>('stateDebounceMs', 200),
  );

  client.setStatusListener((status) => {
    stateReporter?.setConnectionStatus(status);
  });

  client.setStateProvider(() => stateReporter?.getCurrentState() ?? {
    snapshotId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    extensionVersion,
    vscodeVersion: vscode.version,
    connectionStatus: 'reconnecting',
    sequenceNumber: 0,
    hasActiveEditor: false,
    activeEditor: null,
    cursor: null,
    selections: [],
    selectedText: null,
    diagnosticCounts: { errors: 0, warnings: 0, infos: 0, hints: 0 },
    readyForCommands: false,
  });

  stateReporter.start();
  client.connect();

  context.subscriptions.push(
    vscode.commands.registerCommand('driftcode.reconnect', () => {
      client?.reconnect();
    }),
    vscode.commands.registerCommand('driftcode.pushState', () => {
      stateReporter?.pushNow();
    }),
    client,
    stateReporter,
  );
}

export function deactivate(): void {
  stateReporter?.dispose();
  client?.dispose();
  stateReporter = undefined;
  client = undefined;
}
