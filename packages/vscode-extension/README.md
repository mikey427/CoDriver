# DriftCode VS Code Extension

VS Code adapter for the [DriftCode Harness](https://github.com/driftcode/harness). Connects to the local orchestrator over WebSocket (JSON-RPC 2.0), reports editor state, and executes voice-routed editor commands.

## Requirements

- VS Code 1.85+
- Node.js 18+ (for building)
- DriftCode orchestrator listening on `ws://127.0.0.1:17345` (default)

## Development setup (Linux)

From this directory:

```bash
npm install
npm run compile
```

### Option A: Symlink into VS Code extensions folder

Symlink the extension folder so VS Code loads it directly from the repo (best for active development):

```bash
ln -sf "$(pwd)" ~/.vscode/extensions/driftcode-vscode-dev
```

Then reload VS Code (`Developer: Reload Window`). The extension activates on startup and connects to the orchestrator.

To remove the symlink:

```bash
rm ~/.vscode/extensions/driftcode-vscode-dev
```

### Option B: Package and install `.vsix`

```bash
npm install
npm run compile
npm run package
code --install-extension driftcode-vscode-0.1.0.vsix
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `driftcode.orchestratorUrl` | `ws://127.0.0.1:17345` | Orchestrator WebSocket URL |
| `driftcode.reconnectDelayMs` | `2000` | Delay before reconnect after disconnect |
| `driftcode.stateDebounceMs` | `200` | Debounce for editor state pushes |

## Commands

Palette commands contributed by this extension:

- **DriftCode: Reconnect to Orchestrator** — force reconnect
- **DriftCode: Push Editor State** — send an immediate state snapshot

## Protocol

On connect, the extension sends `extension.hello` with version and workspace info.

Editor state is pushed via `editor.stateChanged` (debounced on edits/selection/focus/diagnostics, plus every 5 seconds).

The orchestrator dispatches mutations with `editor.execute`:

| `commandId` | Behavior |
|-------------|----------|
| `editor.insertText` | Insert text at cursor (`text`, optional `phraseGroupId`) |
| `editor.save` | Save active file or optional `uri` |
| `editor.deleteLine` | Delete current line |
| `editor.selectFunction` | Select enclosing function (heuristic) |
| `editor.navigate` | Open file (fuzzy), go to line, or jump to symbol |
| `editor.undo` | Standard undo |
| `editor.phraseUndo` | Undo last dictation phrase group |

## EditorState (MVP fields)

Each snapshot includes:

- Active file URI, relative path, language, dirty flag
- Cursor position and selections
- Diagnostic counts (errors, warnings, infos, hints)
- Connection status and sequence number

## Watch mode

```bash
npm run watch
```

Run alongside VS Code with the symlink install for automatic recompile on save; reload the window after changes to `extension.ts` activation logic.
