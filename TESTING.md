# Testing DriftCode Harness

This guide covers how to run and verify the MVP locally.

## Prerequisites

- Node.js 20+
- Linux or Windows (primary target)

## One-time setup

```bash
npm run setup
```

This installs dependencies, optional peers (`playwright`, `openai`, `obs-websocket-js`), Chromium for Playwright, builds all packages, and copies `.driftcode/config.example.json` to `.driftcode/config.json` if missing.

## Start the orchestrator

```bash
npm start
```

The orchestrator listens on `http://127.0.0.1:17345`.

| URL | Purpose |
|-----|---------|
| `/admin/` | Operator dashboard |
| `/overlay/` | OBS browser overlay (SSE) |
| `/api/utterance` | Inject voice text (HTTP test path) |
| `/api/dashboard/state` | Dashboard state JSON |
| `/api/health` | Liveness check |

## VS Code extension (optional for editor commands)

1. Build: `npm run build:extension`
2. Press F5 in `packages/vscode-extension` or install the VSIX
3. Extension connects to `ws://127.0.0.1:17345/ws/vscode`

Without the extension, orchestrator commands still work; editor/ dictation actions return `NOT_CONNECTED`.

## Speech input

MVP testing uses **HTTP utterance injection** (no mic/STT required):

```bash
npm run test:utterance -- "switch command mode"
npm run test:utterance -- "const user equals await get user open paren id close paren"
```

Set `DRIFTCODE_URL` to target a remote orchestrator.

## Automated tests

With the orchestrator running:

```bash
npm run test:mvp        # 8 smoke checks (health, modes, dictation, emergency, admin, overlay)
npm run test:benchmark  # 30 deterministic registry commands (~80% intent match required)
```

## Configuration

Edit `.driftcode/config.json` (or `~/.driftcode/config.json`):

- `openAiApiKey` — enables AI assist / vibe modes
- `devServerCommand` / `devServerUrl` — dev server + browser testing
- `appTestFlows` — named browser test flows (`run login flow`)
- `protectedFileGlobs` — blocks patch apply on sensitive paths

## Manual acceptance checklist

- [ ] Mode switch: `switch command mode`
- [ ] Dictation: `const x equals 1` in manual dictation mode
- [ ] Emergency: `emergency stop` then `resume previous mode`
- [ ] Navigation: `go to line 10` (requires VS Code extension)
- [ ] Confirmation: trigger blocked terminal command, then `confirm execute`
- [ ] Browser: `open app` (requires Playwright + optional dev server)
- [ ] App test: `run login flow` in app-testing mode
- [ ] Admin shows editor file when extension connected
- [ ] Overlay loads at `/overlay/`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `EADDRINUSE` on 17345 | `fuser -k 17345/tcp` or change `serverPort` in config |
| Playwright errors | `npm run setup` or `npx playwright install chromium` |
| AI disabled | Set `openAiApiKey` in config |
| Empty editor panel | Ensure VS Code extension is connected; state sync uses `{ state: ... }` |
