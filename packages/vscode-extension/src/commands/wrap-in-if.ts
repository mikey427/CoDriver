import * as vscode from 'vscode';
import type { EditorResult } from '../types';

export async function wrapInIf(condition = 'condition'): Promise<EditorResult> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return fail('editor.wrapInIf', 'NO_ACTIVE_EDITOR', 'No active text editor');
  }

  if (editor.selection.isEmpty) {
    return fail('editor.wrapInIf', 'NO_SELECTION', 'Select text to wrap in an if block');
  }

  const selected = editor.document.getText(editor.selection);
  const wrapped = `if (${condition}) {\n${selected}\n}`;

  const ok = await editor.edit((builder) => {
    builder.replace(editor.selection, wrapped);
  });

  if (!ok) {
    return fail('editor.wrapInIf', 'EDIT_FAILED', 'Failed to wrap selection');
  }

  return {
    correlationId: '',
    commandId: 'editor.wrapInIf',
    success: true,
    description: 'Wrapped selection in if block',
    affectedUris: [editor.document.uri.toString()],
  };
}

function fail(commandId: string, errorCode: string, errorMessage: string): EditorResult {
  return {
    correlationId: '',
    commandId,
    success: false,
    errorCode,
    errorMessage,
  };
}
