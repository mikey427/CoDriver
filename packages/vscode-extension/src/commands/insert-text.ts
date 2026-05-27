import * as vscode from 'vscode';
import type { EditorResult, InsertTextParams } from '../types';

let lastPhraseUndoGroupId: string | null = null;
let lastPhraseUndoStopCount = 0;

export function getLastPhraseUndoGroupId(): string | null {
  return lastPhraseUndoGroupId;
}

export async function insertText(params: InsertTextParams): Promise<EditorResult> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return {
      correlationId: '',
      commandId: 'editor.insertText',
      success: false,
      errorCode: 'NO_ACTIVE_EDITOR',
      errorMessage: 'No active text editor',
    };
  }

  const text = params.text ?? '';
  if (text.length === 0) {
    return {
      correlationId: '',
      commandId: 'editor.insertText',
      success: false,
      errorCode: 'INVALID_PARAMS',
      errorMessage: 'text is required',
    };
  }

  const phraseGroupId = params.phraseGroupId ?? crypto.randomUUID();
  const success = await editor.edit(
    (editBuilder) => {
      for (const selection of editor.selections) {
        editBuilder.insert(selection.active, text);
      }
    },
    { undoStopBefore: true, undoStopAfter: true },
  );

  if (!success) {
    return {
      correlationId: '',
      commandId: 'editor.insertText',
      success: false,
      errorCode: 'EDIT_FAILED',
      errorMessage: 'Failed to apply text insertion',
    };
  }

  lastPhraseUndoGroupId = phraseGroupId;
  lastPhraseUndoStopCount = 1;

  return {
    correlationId: '',
    commandId: 'editor.insertText',
    success: true,
    description: `Inserted ${text.length} character(s)`,
    undoGroupId: phraseGroupId,
    affectedUris: [editor.document.uri.toString()],
  };
}

export async function phraseUndo(): Promise<EditorResult> {
  if (lastPhraseUndoStopCount <= 0) {
    return {
      correlationId: '',
      commandId: 'editor.phraseUndo',
      success: false,
      errorCode: 'NOTHING_TO_UNDO',
      errorMessage: 'No phrase undo group recorded',
    };
  }

  for (let i = 0; i < lastPhraseUndoStopCount; i++) {
    await vscode.commands.executeCommand('undo');
  }

  const undoGroupId = lastPhraseUndoGroupId;
  lastPhraseUndoGroupId = null;
  lastPhraseUndoStopCount = 0;

  return {
    correlationId: '',
    commandId: 'editor.phraseUndo',
    success: true,
    description: 'Undid last dictation phrase',
    undoGroupId: undoGroupId ?? undefined,
  };
}

export function resetPhraseUndoTracking(): void {
  lastPhraseUndoGroupId = null;
  lastPhraseUndoStopCount = 0;
}
