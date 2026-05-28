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
| `/api/onboarding` | Setup wizard state |
| `/api/tutorial/lessons` | Voice command tutorial |
| `/api/speech/transcribe` | Mic audio → Whisper (base64 WebM) |
| `/api/stt/providers` | Available STT providers |

## Onboarding wizard & tutorial

Open **http://127.0.0.1:17345/admin/onboarding** after `npm start`.

The wizard walks through:

1. Prerequisites (orchestrator, OpenAI key, STT, VS Code)
2. STT provider selection (HTTP inbox, OpenAI Whisper, or manual/typed)
3. Microphone test (Whisper — hold-to-record in the browser)
4. Interactive tutorial (9 lessons with dry-run parsing)

Practice anytime at **http://127.0.0.1:17345/admin/tutorial**.

For Whisper mic transcription:

1. Set `openAiApiKey` in `.driftcode/config.json` (or via Settings / wizard)
2. Set `sttProviderId` to `openai-whisper`
3. Ensure optional peer: `npm install openai` (included by `npm run setup`)

Test tutorial parsing via API:

```bash
curl -X POST http://127.0.0.1:17345/api/tutorial/practice \
  -H 'Content-Type: application/json' \
  -d '{"lessonId":"switch-command","text":"switch command mode","dryRun":true}'
```


1. Build: `npm run build:extension`
2. Press F5 in `packages/vscode-extension` or install the VSIX
3. Extension connects to `ws://127.0.0.1:17345/ws/vscode`

Without the extension, orchestrator commands still work; editor/ dictation actions return `NOT_CONNECTED`.

## Speech input

Three ways to inject voice without a mic:

```bash
# HTTP (same as test:utterance)
npm run test:utterance -- "switch command mode"

# Speech inbox — drop file in .driftcode/inbox/ (watched automatically)
npm run speech:send -- "switch command mode"

# PTT API — for button/automation integrations
curl -X POST http://127.0.0.1:17345/api/speech/ptt/down
curl -X POST http://127.0.0.1:17345/api/speech/ptt/up -H 'Content-Type: application/json' -d '{"text":"save file"}'
```

Set `DRIFTCODE_URL` to target a remote orchestrator.

## Automated tests

With the orchestrator running:

Full phrase reference: [docs/PHASE2-GRAMMAR.md](docs/PHASE2-GRAMMAR.md)

```bash
npm run test:grammar      # Phase 2 unit tests (no orchestrator)
npm run test:corrections  # correction registry mapping
npm run test:phase2       # simulated editing session
npm run test:core-loop    # Phase 1 acceptance (fake AI, emergency, patch flow)
npm run test:mvp        # 8 smoke checks (health, modes, dictation, emergency, admin, overlay)
npm run test:benchmark  # 30 deterministic registry commands (~80% intent match required)
npm run audit:registry  # built-in command registry ↔ intent mapper audit (run after build)
```

### Fake AI for core-loop tests

```bash
DRIFTCODE_AI_PROVIDER=fake npm start
# or PUT aiProviderId=fake via /api/config — see docs/STATUS.md
npm run test:core-loop
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
