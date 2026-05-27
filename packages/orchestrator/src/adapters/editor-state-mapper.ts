import type { EditorDiagnostic, EditorState } from '@driftcode/shared';
import { DiagnosticSeverity } from '@driftcode/shared';

/** Extension-side editor state snapshot (flat params on editor.stateChanged). */
export interface ExtensionEditorSnapshot {
  snapshotId?: string;
  timestamp?: string;
  extensionVersion?: string;
  vscodeVersion?: string;
  connectionStatus?: string;
  sequenceNumber?: number;
  hasActiveEditor?: boolean;
  activeEditor?: {
    documentUri?: string;
    relativePath?: string;
    languageId?: string;
    isDirty?: boolean;
    isUntitled?: boolean;
    lineCount?: number;
  } | null;
  cursor?: { line?: number; character?: number } | null;
  selections?: Array<{ anchor?: { line?: number; character?: number }; active?: { line?: number; character?: number }; isEmpty?: boolean }>;
  selectedText?: string | null;
  diagnosticCounts?: { errors?: number; warnings?: number; infos?: number; hints?: number };
  readyForCommands?: boolean;
  workspaceFolders?: string[];
}

function severityFromCount(count: number, severity: DiagnosticSeverity): EditorDiagnostic[] {
  return Array.from({ length: count }, (_, index) => ({
    file: '',
    line: index,
    character: 0,
    severity,
    message: 'Diagnostic',
    source: 'vscode',
  }));
}

/** Normalize extension or shared editor state into session EditorState. */
export function mapToSessionEditorState(
  incoming: unknown,
  previous: EditorState,
): EditorState | undefined {
  if (!incoming || typeof incoming !== 'object') return undefined;

  const raw = incoming as Record<string, unknown>;
  const payload = (raw.state ?? raw) as ExtensionEditorSnapshot | EditorState;

  if ('activeFilePath' in payload || ('diagnostics' in payload && Array.isArray((payload as EditorState).diagnostics))) {
    return {
      ...previous,
      ...(payload as Partial<EditorState>),
      connected: true,
      timestamp: new Date().toISOString(),
    };
  }

  const ext = payload as ExtensionEditorSnapshot;
  const diagnostics: EditorDiagnostic[] = [
    ...severityFromCount(ext.diagnosticCounts?.errors ?? 0, DiagnosticSeverity.Error),
    ...severityFromCount(ext.diagnosticCounts?.warnings ?? 0, DiagnosticSeverity.Warning),
  ];

  const active = ext.activeEditor;
  const cursor = ext.cursor;

  return {
    ...previous,
    timestamp: ext.timestamp ?? new Date().toISOString(),
    connected: ext.connectionStatus === 'connected' || ext.readyForCommands === true,
    workspaceFolders: ext.workspaceFolders ?? previous.workspaceFolders,
    activeFilePath: active?.relativePath ?? active?.documentUri,
    activeFileAbsolutePath: active?.documentUri,
    activeLanguageId: active?.languageId,
    cursorLine: cursor?.line != null ? cursor.line + 1 : undefined,
    cursorCharacter: cursor?.character,
    selection: ext.selectedText
      ? {
          startLine: cursor?.line ?? 0,
          startCharacter: cursor?.character ?? 0,
          endLine: cursor?.line ?? 0,
          endCharacter: (cursor?.character ?? 0) + ext.selectedText.length,
          text: ext.selectedText,
          isEmpty: false,
        }
      : previous.selection,
    openEditors: active?.relativePath ? [active.relativePath] : previous.openEditors,
    diagnostics,
    isDirty: active?.isDirty ?? false,
    tabCount: previous.tabCount,
    extensionVersion: ext.extensionVersion ?? previous.extensionVersion,
    capabilities: previous.capabilities,
  };
}
