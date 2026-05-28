# DriftCode Harness

Voice-first coding/control harness for hands-free development while sim drifting live on stream.

**Status:** Phase 1 core loop is testable; see [docs/STATUS.md](docs/STATUS.md) for an honest breakdown of what works vs scaffold.

## Quick start

```bash
npm run setup    # install, optional peers, build, sample config
npm start
```

See [TESTING.md](TESTING.md) for the full test guide.

```bash
npm run test:core-loop  # Phase 1 acceptance (fake AI, emergency, patch flow)
npm run test:grammar    # Phase 2 grammar unit tests (no orchestrator)
npm run test:corrections
npm run test:phase2     # simulated manual dictation session
npm run test:mvp        # smoke tests (orchestrator must be running)
npm run test:benchmark  # 30+ registry command benchmark
npm run audit:registry  # registry ↔ intent mapper audit
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

## Fake AI (no OpenAI key)

For local acceptance tests without network:

```bash
# Option A: env var
DRIFTCODE_AI_PROVIDER=fake npm start

# Option B: config API
curl -X PUT http://127.0.0.1:17345/api/config \
  -H 'Content-Type: application/json' \
  -d '{"aiProviderId":"fake","openAiApiKey":"test"}'
```

Then: `npm run test:core-loop`

## Optional capabilities

Install peers for extended features:

```bash
npm install openai playwright obs-websocket-js -w @driftcode/orchestrator
npx playwright install chromium
```

Set `openAiApiKey` and `aiProviderId: "openai"` in `~/.driftcode/config.json` for real OpenAI.

## Architecture

- **Deterministic path** — dictation, modes, editor/terminal/browser commands (no LLM)
- **AI path** — OpenAI or fake provider → validated pending patch → `"apply the fix"`
- **Command router** — all actions through risk classifier + audit log; emergency stop blocks adapters and AI

## Project structure

```
packages/shared/           Types, modes, command registry
packages/orchestrator/     Runtime, adapters, AI, safety
packages/admin/            React control panel
packages/vscode-extension/ Editor adapter
overlay/                   Stream debug overlay
docs/STATUS.md             Honest implementation status
docs/DRIFTCODE-HARNESS-SPEC.md
```

## Implementation status

| Phase | Status |
|-------|--------|
| **1 Core loop** | **Testable** — `test:core-loop`, fake AI, patch validation, emergency stop, registry audit |
| **2 Manual coding grammar** | **Testable** — deterministic TS/web phrases, corrections, `test:grammar` |
| 3 App testing | Playwright flows (optional peer) |
| 4 Streaming | Partial — OBS adapter, privacy flag, overlay |
| 5 STT / hardware / V1 | Scaffold or planned — see [docs/STATUS.md](docs/STATUS.md) |

Full spec: [docs/DRIFTCODE-HARNESS-SPEC.md](docs/DRIFTCODE-HARNESS-SPEC.md)
