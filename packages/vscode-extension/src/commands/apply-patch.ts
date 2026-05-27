import * as vscode from 'vscode';
import type { EditorResult } from '../types';

export interface ApplyPatchParams {
  path?: string;
  content?: string;
  oldText?: string;
  newText?: string;
}

export async function applyPatch(params: ApplyPatchParams): Promise<EditorResult> {
  const uri = params.path
    ? vscode.Uri.file(params.path.startsWith('/') ? params.path : `${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''}/${params.path}`)
    : vscode.window.activeTextEditor?.document.uri;

  if (!uri) {
    return { correlationId: '', commandId: 'editor.applyPatch', success: false, errorCode: 'NO_FILE', errorMessage: 'No target file' };
  }

  const doc = await vscode.workspace.openTextDocument(uri);
  const edit = new vscode.WorkspaceEdit();

  if (params.content != null) {
    const fullRange = new vscode.Range(0, 0, doc.lineCount, 0);
    edit.replace(uri, fullRange, params.content);
  } else if (params.oldText != null && params.newText != null) {
    const text = doc.getText();
    const idx = text.indexOf(params.oldText);
    if (idx < 0) {
      return { correlationId: '', commandId: 'editor.applyPatch', success: false, errorCode: 'PATCH_CONFLICT', errorMessage: 'oldText not found in file' };
    }
    const start = doc.positionAt(idx);
    const end = doc.positionAt(idx + params.oldText.length);
    edit.replace(uri, new vscode.Range(start, end), params.newText);
  } else {
    return { correlationId: '', commandId: 'editor.applyPatch', success: false, errorCode: 'INVALID_PARAMS', errorMessage: 'Need content or oldText/newText' };
  }

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    return { correlationId: '', commandId: 'editor.applyPatch', success: false, errorCode: 'APPLY_FAILED', errorMessage: 'WorkspaceEdit rejected' };
  }

  const editor = await vscode.window.showTextDocument(doc, { preview: false });
  await editor.document.save();

  return {
    correlationId: '',
    commandId: 'editor.applyPatch',
    success: true,
    description: `Patched ${uri.fsPath.split(/[/\\]/).pop()}`,
    affectedUris: [uri.toString()],
  };
}

export async function getSelectionContext(maxLines = 120): Promise<EditorResult & { context?: string }> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return { correlationId: '', commandId: 'editor.getSelectionContext', success: false, errorCode: 'NO_EDITOR', errorMessage: 'No active editor' };
  }

  const doc = editor.document;
  let text: string;
  if (!editor.selection.isEmpty) {
    text = doc.getText(editor.selection);
  } else {
    const startLine = Math.max(0, editor.selection.active.line - Math.floor(maxLines / 2));
    const endLine = Math.min(doc.lineCount - 1, startLine + maxLines);
    text = doc.getText(new vscode.Range(startLine, 0, endLine, doc.lineAt(endLine).text.length));
  }

  const diagnostics = vscode.languages.getDiagnostics(doc.uri)
    .filter((d) => d.severity === vscode.DiagnosticSeverity.Error)
    .slice(0, 5)
    .map((d) => `${doc.lineAt(d.range.start.line).text.trim()} — ${d.message}`);

  const context = [
    `File: ${doc.uri.fsPath}`,
    `Language: ${doc.languageId}`,
    diagnostics.length ? `Errors:\n${diagnostics.join('\n')}` : '',
    '---',
    text.slice(0, 8000),
  ].filter(Boolean).join('\n');

  return { correlationId: '', commandId: 'editor.getSelectionContext', success: true, context, description: doc.uri.fsPath };
}
