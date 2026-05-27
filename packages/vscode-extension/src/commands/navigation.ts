import * as path from 'path';
import * as vscode from 'vscode';
import type { EditorResult, NavigateParams } from '../types';

export async function navigate(params: NavigateParams): Promise<EditorResult> {
  if (params.symbol) {
    return navigateToSymbol(params.symbol, params.file);
  }

  if (params.file) {
    const openResult = await openFileByName(params.file);
    if (!openResult.success) {
      return openResult;
    }
  }

  if (params.line !== undefined) {
    const lineResult = await goToLine(params.line);
    if (!lineResult.success) {
      return lineResult;
    }
  }

  if (!params.file && params.line === undefined && !params.symbol) {
    return {
      correlationId: '',
      commandId: 'editor.navigate',
      success: false,
      errorCode: 'INVALID_PARAMS',
      errorMessage: 'At least one of file, line, or symbol is required',
    };
  }

  return {
    correlationId: '',
    commandId: 'editor.navigate',
    success: true,
    description: describeNavigation(params),
  };
}

export async function goToLine(line: number): Promise<EditorResult> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return fail('editor.navigate', 'NO_ACTIVE_EDITOR', 'No active text editor');
  }

  const zeroBasedLine = Math.max(0, line - 1);
  const clampedLine = Math.min(zeroBasedLine, editor.document.lineCount - 1);
  const position = new vscode.Position(clampedLine, 0);

  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);

  return {
    correlationId: '',
    commandId: 'editor.navigate',
    success: true,
    description: `Moved to line ${line}`,
    affectedUris: [editor.document.uri.toString()],
  };
}

export async function openFileByName(name: string): Promise<EditorResult> {
  const match = await fuzzyFindFile(name);
  if (!match) {
    return fail('editor.navigate', 'FILE_NOT_FOUND', `No file matching "${name}"`);
  }

  const document = await vscode.workspace.openTextDocument(match);
  await vscode.window.showTextDocument(document);

  return {
    correlationId: '',
    commandId: 'editor.navigate',
    success: true,
    description: `Opened ${match.fsPath}`,
    affectedUris: [match.toString()],
  };
}

async function navigateToSymbol(symbol: string, fileHint?: string): Promise<EditorResult> {
  if (fileHint) {
    const openResult = await openFileByName(fileHint);
    if (!openResult.success) {
      return openResult;
    }
  }

  const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
    'vscode.executeWorkspaceSymbolProvider',
    symbol,
  );

  if (!symbols || symbols.length === 0) {
    return fail('editor.navigate', 'FILE_NOT_FOUND', `No symbol matching "${symbol}"`);
  }

  const best =
    symbols.find((s) => s.name === symbol) ??
    symbols.find((s) => s.name.toLowerCase() === symbol.toLowerCase()) ??
    symbols[0];

  const document = await vscode.workspace.openTextDocument(best.location.uri);
  const editor = await vscode.window.showTextDocument(document);
  editor.selection = new vscode.Selection(
    best.location.range.start,
    best.location.range.start,
  );
  editor.revealRange(best.location.range, vscode.TextEditorRevealType.InCenter);

  return {
    correlationId: '',
    commandId: 'editor.navigate',
    success: true,
    description: `Navigated to symbol ${best.name}`,
    affectedUris: [best.location.uri.toString()],
  };
}

async function fuzzyFindFile(query: string): Promise<vscode.Uri | undefined> {
  const normalizedQuery = query.trim().toLowerCase();
  const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 5000);

  let bestUri: vscode.Uri | undefined;
  let bestScore = -1;

  for (const uri of files) {
    const score = scoreFileMatch(uri, normalizedQuery);
    if (score > bestScore) {
      bestScore = score;
      bestUri = uri;
    }
  }

  return bestScore > 0 ? bestUri : undefined;
}

function scoreFileMatch(uri: vscode.Uri, query: string): number {
  const basename = path.basename(uri.fsPath).toLowerCase();
  const relative = vscode.workspace.asRelativePath(uri, false).toLowerCase();

  if (basename === query) {
    return 1000;
  }
  if (relative === query) {
    return 950;
  }
  if (basename.startsWith(query)) {
    return 800 + query.length;
  }
  if (relative.includes(query)) {
    return 500 + query.length;
  }

  const queryParts = query.split(/[/\\]/).filter(Boolean);
  if (queryParts.length > 1 && relative.endsWith(query)) {
    return 700;
  }

  const fuzzy = fuzzySubsequenceScore(relative, query);
  return fuzzy;
}

function fuzzySubsequenceScore(haystack: string, needle: string): number {
  if (needle.length === 0) {
    return 0;
  }

  let needleIndex = 0;
  let score = 0;
  let lastMatchIndex = -1;

  for (let i = 0; i < haystack.length && needleIndex < needle.length; i++) {
    if (haystack[i] === needle[needleIndex]) {
      score += 10;
      if (lastMatchIndex >= 0 && i === lastMatchIndex + 1) {
        score += 5;
      }
      lastMatchIndex = i;
      needleIndex++;
    }
  }

  return needleIndex === needle.length ? score : 0;
}

function describeNavigation(params: NavigateParams): string {
  const parts: string[] = [];
  if (params.file) {
    parts.push(`file=${params.file}`);
  }
  if (params.line !== undefined) {
    parts.push(`line=${params.line}`);
  }
  if (params.symbol) {
    parts.push(`symbol=${params.symbol}`);
  }
  return `Navigated (${parts.join(', ')})`;
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
