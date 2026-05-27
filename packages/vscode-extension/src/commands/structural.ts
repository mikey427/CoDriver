import * as vscode from 'vscode';
import type { EditorResult } from '../types';

export async function deleteLine(): Promise<EditorResult> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return fail('editor.deleteLine', 'NO_ACTIVE_EDITOR', 'No active text editor');
  }

  await vscode.commands.executeCommand('editor.action.deleteLines');

  return {
    correlationId: '',
    commandId: 'editor.deleteLine',
    success: true,
    description: 'Deleted current line(s)',
    affectedUris: [editor.document.uri.toString()],
  };
}

export async function saveFile(uri?: string): Promise<EditorResult> {
  if (uri) {
    const document = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.toString() === uri || doc.uri.fsPath === uri,
    );
    if (!document) {
      return fail('editor.save', 'FILE_NOT_FOUND', `Document not open: ${uri}`);
    }
    await document.save();
    return {
      correlationId: '',
      commandId: 'editor.save',
      success: true,
      description: `Saved ${document.uri.fsPath}`,
      affectedUris: [document.uri.toString()],
    };
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return fail('editor.save', 'NO_ACTIVE_EDITOR', 'No active text editor');
  }

  await editor.document.save();

  return {
    correlationId: '',
    commandId: 'editor.save',
    success: true,
    description: `Saved ${editor.document.uri.fsPath}`,
    affectedUris: [editor.document.uri.toString()],
  };
}

export async function selectFunction(): Promise<EditorResult> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return fail('editor.selectFunction', 'NO_ACTIVE_EDITOR', 'No active text editor');
  }

  const document = editor.document;
  const cursorLine = editor.selection.active.line;
  const range = findEnclosingFunctionRange(document, cursorLine);

  if (!range) {
    return fail(
      'editor.selectFunction',
      'LSP_UNAVAILABLE',
      'Could not determine enclosing function via heuristic',
    );
  }

  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

  return {
    correlationId: '',
    commandId: 'editor.selectFunction',
    success: true,
    description: 'Selected enclosing function',
    affectedUris: [document.uri.toString()],
  };
}

export async function selectLine(): Promise<EditorResult> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return fail('editor.selectLine', 'NO_ACTIVE_EDITOR', 'No active text editor');
  }
  await vscode.commands.executeCommand('expandLineSelection');
  return {
    correlationId: '',
    commandId: 'editor.selectLine',
    success: true,
    description: 'Selected current line',
    affectedUris: [editor.document.uri.toString()],
  };
}

export async function selectWord(): Promise<EditorResult> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return fail('editor.selectWord', 'NO_ACTIVE_EDITOR', 'No active text editor');
  }
  await vscode.commands.executeCommand('editor.action.addSelectionToNextFindMatch');
  return {
    correlationId: '',
    commandId: 'editor.selectWord',
    success: true,
    description: 'Selected word',
    affectedUris: [editor.document.uri.toString()],
  };
}

export async function runEditorCommand(command: string): Promise<EditorResult> {
  await vscode.commands.executeCommand(command);
  return {
    correlationId: '',
    commandId: 'editor.runCommand',
    success: true,
    description: `Ran ${command}`,
  };
}

export async function moveLineUp(): Promise<EditorResult> {
  await vscode.commands.executeCommand('editor.action.moveLinesUpAction');
  return { correlationId: '', commandId: 'editor.moveLineUp', success: true, description: 'Moved line up' };
}

export async function moveLineDown(): Promise<EditorResult> {
  await vscode.commands.executeCommand('editor.action.moveLinesDownAction');
  return { correlationId: '', commandId: 'editor.moveLineDown', success: true, description: 'Moved line down' };
}

export async function duplicateLine(): Promise<EditorResult> {
  await vscode.commands.executeCommand('editor.action.copyLinesDownAction');
  return { correlationId: '', commandId: 'editor.duplicateLine', success: true, description: 'Duplicated line' };
}

export async function commentLine(): Promise<EditorResult> {
  await vscode.commands.executeCommand('editor.action.commentLine');
  return { correlationId: '', commandId: 'editor.commentLine', success: true, description: 'Toggled comment' };
}

export async function formatDocument(): Promise<EditorResult> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return fail('editor.formatDocument', 'NO_ACTIVE_EDITOR', 'No active text editor');
  }
  await vscode.commands.executeCommand('editor.action.formatDocument');
  return {
    correlationId: '',
    commandId: 'editor.formatDocument',
    success: true,
    description: 'Formatted document',
    affectedUris: [editor.document.uri.toString()],
  };
}

export async function undo(): Promise<EditorResult> {
  await vscode.commands.executeCommand('undo');
  return {
    correlationId: '',
    commandId: 'editor.undo',
    success: true,
    description: 'Undid last edit',
  };
}

function findEnclosingFunctionRange(
  document: vscode.TextDocument,
  cursorLine: number,
): vscode.Range | undefined {
  const functionPattern =
    /^\s*(export\s+)?(async\s+)?(function\s+\w+|(\w+\s*:\s*)?\([^)]*\)\s*=>|\w+\s*\([^)]*\)\s*\{|\w+\s*\([^)]*\)\s*:\s*[\w<>,\[\]|&\s]+\s*\{)/;

  let startLine = cursorLine;
  while (startLine >= 0) {
    const lineText = document.lineAt(startLine).text;
    if (functionPattern.test(lineText)) {
      break;
    }
    startLine--;
  }

  if (startLine < 0) {
    startLine = findBlockStartByBrackets(document, cursorLine);
    if (startLine < 0) {
      return undefined;
    }
  }

  const endLine = findMatchingBlockEnd(document, startLine);
  if (endLine < 0) {
    return undefined;
  }

  const start = document.lineAt(startLine).range.start;
  const end = document.lineAt(endLine).range.end;
  return new vscode.Range(start, end);
}

function findBlockStartByBrackets(document: vscode.TextDocument, cursorLine: number): number {
  let depth = 0;
  for (let line = cursorLine; line >= 0; line--) {
    const text = document.lineAt(line).text;
    for (let i = text.length - 1; i >= 0; i--) {
      const ch = text[i];
      if (ch === '}') {
        depth++;
      } else if (ch === '{') {
        if (depth === 0) {
          return line;
        }
        depth--;
      }
    }
  }
  return -1;
}

function findMatchingBlockEnd(document: vscode.TextDocument, startLine: number): number {
  let depth = 0;
  let started = false;

  for (let line = startLine; line < document.lineCount; line++) {
    const text = document.lineAt(line).text;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') {
        depth++;
        started = true;
      } else if (ch === '}') {
        depth--;
        if (started && depth === 0) {
          return line;
        }
      }
    }
  }

  return -1;
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
