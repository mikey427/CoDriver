import * as vscode from 'vscode';
import type { EditorResult, InsertTextParams, Range } from '../types';

export interface PhraseHistoryEntry {
  id: string;
  text: string;
  documentUri: string;
  range: Range;
  timestamp: string;
}

const phraseHistory: PhraseHistoryEntry[] = [];
const MAX_HISTORY = 50;

export function getPhraseHistory(): readonly PhraseHistoryEntry[] {
  return phraseHistory;
}

export function getLastPhraseEntry(): PhraseHistoryEntry | undefined {
  return phraseHistory[phraseHistory.length - 1];
}

export function pushPhraseEntry(entry: PhraseHistoryEntry): void {
  phraseHistory.push(entry);
  if (phraseHistory.length > MAX_HISTORY) phraseHistory.shift();
}

export function popLastPhraseEntry(): PhraseHistoryEntry | undefined {
  return phraseHistory.pop();
}

function getEditorTextAtRange(editor: vscode.TextEditor, range: Range): string {
  const vsRange = new vscode.Range(
    range.start.line,
    range.start.character,
    range.end.line,
    range.end.character,
  );
  return editor.document.getText(vsRange);
}

function rangeFromSelectionAfterInsert(start: vscode.Position, insertedLength: number): Range {
  const doc = vscode.window.activeTextEditor?.document;
  if (!doc) {
    return { start: { line: start.line, character: start.character }, end: { line: start.line, character: start.character + insertedLength } };
  }
  const endPos = doc.positionAt(doc.offsetAt(start) + insertedLength);
  return {
    start: { line: start.line, character: start.character },
    end: { line: endPos.line, character: endPos.character },
  };
}

export async function insertText(params: InsertTextParams): Promise<EditorResult> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return fail('editor.insertText', 'NO_ACTIVE_EDITOR', 'No active text editor');
  }

  const text = params.text ?? '';
  if (text.length === 0) {
    return fail('editor.insertText', 'INVALID_PARAMS', 'text is required');
  }

  const phraseGroupId = params.phraseGroupId ?? crypto.randomUUID();
  const insertPos = editor.selection.active;

  const success = await editor.edit(
    (editBuilder) => {
      for (const selection of editor.selections) {
        editBuilder.insert(selection.active, text);
      }
    },
    { undoStopBefore: true, undoStopAfter: true },
  );

  if (!success) {
    return fail('editor.insertText', 'EDIT_FAILED', 'Failed to apply text insertion');
  }

  const range = rangeFromSelectionAfterInsert(insertPos, text.length);
  const entry: PhraseHistoryEntry = {
    id: phraseGroupId,
    text,
    documentUri: editor.document.uri.toString(),
    range,
    timestamp: new Date().toISOString(),
  };
  pushPhraseEntry(entry);

  return {
    correlationId: '',
    commandId: 'editor.insertText',
    success: true,
    description: `Inserted ${text.length} character(s)`,
    undoGroupId: phraseGroupId,
    affectedUris: [editor.document.uri.toString()],
    insertedRange: range,
    insertedText: text,
    phraseRecordId: phraseGroupId,
  };
}

export async function phraseUndo(): Promise<EditorResult> {
  const entry = getLastPhraseEntry();
  if (!entry) {
    return fail('editor.phraseUndo', 'NOTHING_TO_UNDO', 'No phrase to undo');
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.toString() !== entry.documentUri) {
    return fail('editor.phraseUndo', 'PHRASE_RANGE_STALE', 'Document changed — cannot safely undo phrase');
  }

  const current = getEditorTextAtRange(editor, entry.range);
  if (current !== entry.text) {
    return fail('editor.phraseUndo', 'PHRASE_RANGE_STALE', 'Phrase text changed — cannot safely undo');
  }

  const vsRange = new vscode.Range(
    entry.range.start.line,
    entry.range.start.character,
    entry.range.end.line,
    entry.range.end.character,
  );

  const ok = await editor.edit((b) => b.delete(vsRange));
  if (!ok) {
    return fail('editor.phraseUndo', 'EDIT_FAILED', 'Failed to remove phrase');
  }

  popLastPhraseEntry();
  return {
    correlationId: '',
    commandId: 'editor.phraseUndo',
    success: true,
    description: 'Undid last dictation phrase',
    undoGroupId: entry.id,
  };
}

export async function replaceLastPhrase(replacement: string): Promise<EditorResult> {
  const entry = getLastPhraseEntry();
  if (!entry) {
    return fail('editor.replaceLastPhrase', 'NOTHING_TO_REPLACE', 'No phrase to replace');
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.toString() !== entry.documentUri) {
    return fail('editor.replaceLastPhrase', 'PHRASE_RANGE_STALE', 'Document changed');
  }

  const current = getEditorTextAtRange(editor, entry.range);
  if (current !== entry.text) {
    return fail('editor.replaceLastPhrase', 'PHRASE_RANGE_STALE', 'Phrase text changed');
  }

  const vsRange = new vscode.Range(
    entry.range.start.line,
    entry.range.start.character,
    entry.range.end.line,
    entry.range.end.character,
  );

  const ok = await editor.edit((b) => b.replace(vsRange, replacement));
  if (!ok) {
    return fail('editor.replaceLastPhrase', 'EDIT_FAILED', 'Replace failed');
  }

  entry.text = replacement;
  entry.range = rangeFromSelectionAfterInsert(
    new vscode.Position(entry.range.start.line, entry.range.start.character),
    replacement.length,
  );
  entry.timestamp = new Date().toISOString();

  return {
    correlationId: '',
    commandId: 'editor.replaceLastPhrase',
    success: true,
    description: 'Replaced last phrase',
    insertedText: replacement,
    insertedRange: entry.range,
  };
}

export async function replaceLastWord(replacement: string): Promise<EditorResult> {
  const entry = getLastPhraseEntry();
  if (!entry) {
    return fail('editor.replaceLastWord', 'NOTHING_TO_REPLACE', 'No phrase recorded');
  }

  const wordMatch = entry.text.match(/(\w+)\s*$/);
  if (!wordMatch) {
    return fail('editor.replaceLastWord', 'NO_LAST_WORD', 'No word to replace in last phrase');
  }

  const newText = entry.text.slice(0, wordMatch.index!) + replacement;
  return replaceLastPhrase(newText);
}

export async function deleteLastWord(): Promise<EditorResult> {
  const entry = getLastPhraseEntry();
  if (!entry) {
    return fail('editor.deleteLastWord', 'NOTHING_TO_DELETE', 'No phrase recorded');
  }

  const wordMatch = entry.text.match(/\s*\w+\s*$/);
  if (!wordMatch) {
    return fail('editor.deleteLastWord', 'NO_LAST_WORD', 'No word to delete');
  }

  const newText = entry.text.slice(0, wordMatch.index!).trimEnd();
  return replaceLastPhrase(newText);
}

export async function repeatLastPhrase(): Promise<EditorResult> {
  const entry = getLastPhraseEntry();
  if (!entry) {
    return fail('editor.repeatLastPhrase', 'NOTHING_TO_REPEAT', 'No phrase to repeat');
  }
  return insertText({ text: entry.text, phraseGroupId: crypto.randomUUID() });
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

export function resetPhraseUndoTracking(): void {
  phraseHistory.length = 0;
}
