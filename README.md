# DriftCode Harness

Voice-first AI computer-control and coding harness for hands-free development while sim drifting live on stream.

## Quick start

```bash
npm run setup    # install, optional peers, build, sample config
npm start
```

See [TESTING.md](TESTING.md) for the full test guide.

```bash
npm run test:mvp        # smoke tests (orchestrator must be running)
npm run test:benchmark  # 30+ registry command benchmark
```

| URL | Purpose |
|-----|---------|
| http://127.0.0.1:17345/admin/ | Control panel |
| http://127.0.0.1:17345/overlay | OBS browser overlay |
| http://127.0.0.1:17345/api/health | Health check |

## VS Code extension

```bash
npm run build:extension
ln -sf "$(pwd)/packages/vscode-extension" ~/.vscode/extensions/driftcode-vscode-dev
```

Reload VS Code. Default WebSocket: `ws://127.0.0.1:17345/ws/vscode`

## Test commands (no mic)

```bash
npm run test:utterance -- "switch ai assist"
npm run test:utterance -- "type const user equals await get user open paren id close paren"
npm run test:utterance -- "start dev server"
npm run test:utterance -- "open app"
npm run test:utterance -- "apply the fix"
npm run test:utterance -- "privacy on"
npm run test:utterance -- "emergency stop"
```

## Optional capabilities

Install peers for full Phase 2–4 features:

```bash
npm install openai playwright obs-websocket-js -w @driftcode/orchestrator
npx playwright install chromium
```

Set `openAiApiKey` in `~/.driftcode/config.json` or via admin Settings.

Enable OBS: set `"obsEnabled": true` in config (OBS WebSocket on port 4455).

## Architecture

- **Deterministic path** — dictation, modes, editor/terminal/browser commands (no LLM)
- **AI path** — OpenAI with editor context → pending patch → `"apply the fix"`
- **Command router** — all actions through risk classifier + audit log

## Project structure

```
packages/shared/           Types, modes, command registry
packages/orchestrator/     Runtime, adapters, AI, safety
packages/admin/            React control panel
packages/vscode-extension/ Editor adapter
overlay/                   Stream debug overlay
docs/DRIFTCODE-HARNESS-SPEC.md
```

## Implementation status

| Phase | Status |
|-------|--------|
| 0–1 PoC + coding loop | **Testable** — registry matcher, modes, emergency stop, admin, overlay |
| 2 AI assist | Testable — context-aware patches, apply workflow (needs `openAiApiKey`) |
| 3 App testing | Testable — dev server, Playwright, sample `appTestFlows` |
| 4 Streaming | Partial — OBS adapter, audio beep/TTS, privacy mode |
| 5 V1 reliability | Planned — profiles, flow library, onboarding wizard |

Full spec: [docs/DRIFTCODE-HARNESS-SPEC.md](docs/DRIFTCODE-HARNESS-SPEC.md)
