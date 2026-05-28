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

## VS Code extension

1. Build: `npm run build:extension`
2. Press F5 in `packages/vscode-extension` or install the VSIX
3. Extension connects to `ws://127.0.0.1:17345/ws/vscode`
4. Confirm dashboard **adapterHealth.vscode** = `connected` and **editorState** shows your open file

Without the extension, orchestrator commands still work; editor/dictation actions return `NOT_CONNECTED` with instructions to install the extension, reload VS Code, and verify the WebSocket URL.

**Hands-on script (no mic):** [docs/MANUAL-DOGFOOD.md](docs/MANUAL-DOGFOOD.md)

### Diagnosing VS Code connection

| Symptom | What to check |
|---------|----------------|
| `NOT_CONNECTED` on dictation/save/nav | Orchestrator running? Extension installed + reloaded? Status bar shows Connected? |
| Dashboard `adapterHealth.vscode` disconnected | Wrong `driftcode.orchestratorUrl` in VS Code settings? Firewall blocking localhost? |
| `PHRASE_RANGE_STALE` on correction | File edited manually after dictation — re-dictate or undo in VS Code |
| Editor panel empty but connected | Open a file in VS Code; wait for `editor.stateChanged` sync |

Send a test utterance:

```bash
npm run test:utterance -- "switch manual dictation mode"
npm run test:utterance -- "const x equals 1"
```

Features that **require** the VS Code extension: insert text, corrections, navigation, structural edits, `wrap in if`, apply patch.

Features that work **without** VS Code: mode switch, emergency stop, patch **preview**, fake AI patch creation.

## Speech input (Phase 3 — experimental)

Real speech is **optional**. All automated tests pass without a microphone.

| Path | Notes |
|------|-------|
| Admin manual box | Dashboard → type utterance → source `admin-manual` |
| Admin mic PTT | Dashboard → hold **Hold to talk** (Chrome/Edge Web Speech API) |
| HTTP utterance | `npm run test:utterance -- "..."` — still the reliable CI path |
| PTT API | `POST /api/ptt/start`, `/api/ptt/stop`, `/api/ptt/cancel`, `GET /api/ptt/state` |

Confidence gating: set `speechConfidenceThreshold` in config (default `0.65`). Low-confidence non-emergency utterances return `LOW_CONFIDENCE` without mutating files.

Full guide: [docs/PHASE3-SPEECH-INPUT.md](docs/PHASE3-SPEECH-INPUT.md)

## Speech input (inbox / legacy)

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
npm run test:preview-patch  # Phase 2.5 patch preview (no apply)
npm run test:ptt            # Phase 3 PTT endpoints
npm run test:speech-input   # Phase 3 source + confidence
npm run test:phase3         # Phase 3 acceptance
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
| `NOT_CONNECTED` | Start orchestrator, install/reload driftcode-vscode, check status bar + dashboard adapterHealth |
| `NO_PATCH` on preview | Run `ask ai fix this` in AI Assist mode first (use fake AI for tests) |
| `PHRASE_RANGE_STALE` | File changed since dictation — re-dictate the phrase |
