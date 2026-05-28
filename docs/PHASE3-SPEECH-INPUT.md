# Phase 3 — Experimental Speech Input

Phase 3 adds a **small, safe, experimental** real-speech path. Speech is just another input source — it feeds the same **normalizer → parser → router → safety** pipeline as HTTP test utterances.

**Not in Phase 3:** MOZA/wheel bindings, always-listening, global hotkeys, native Whisper as default, admin redesign.

## Architecture

```
Admin mic (Web Speech API) ──┐
Admin manual text box ───────┼──► POST /api/utterance  (source + confidence)
HTTP / test scripts ─────────┤         │
Speech inbox / legacy PTT ───┘         ▼
                              UtteranceNormalizer → IntentParser → CommandRouter
```

## Input sources

| Source | How |
|--------|-----|
| `http` | Default for `/api/utterance`, test scripts, speech inbox |
| `admin-manual` | Admin dashboard text box |
| `admin-mic` | Admin hold-to-talk (browser speech API) |
| `test` | Automated tests |
| `unknown` | Fallback |

## Push-to-talk (PTT)

First-class runtime state on session + dashboard.

| Endpoint | Action |
|----------|--------|
| `POST /api/ptt/start` | `{ "source": "admin" \| "http" \| "keyboard" }` |
| `POST /api/ptt/stop` | Optional `{ text, confidence, source }` to process final transcript |
| `POST /api/ptt/cancel` | Discard partial / stop listening |
| `GET /api/ptt/state` | Current PTT state |

Legacy (still supported):

- `POST /api/speech/ptt/down`
- `POST /api/speech/ptt/up` with optional `{ text }`

**Emergency stop** clears active PTT.

## Confidence threshold

Config (default `0.65`):

```json
{
  "speechConfidenceThreshold": 0.65
}
```

| Confidence | Behavior |
|------------|----------|
| omitted | Same as pre–Phase 3 HTTP tests |
| ≥ threshold | Process normally |
| < threshold | Block with `LOW_CONFIDENCE` (no editor/terminal/browser mutation) |
| emergency phrase | Allowed even below threshold |

Blocked utterances appear in dashboard `lastBlockedLowConfidence` and command history.

## Admin UI (experimental)

Open **http://127.0.0.1:17345/admin/** → Dashboard:

1. **Manual test input** — type utterance, source `admin-manual`
2. **Mic push-to-talk** — hold button, browser Web Speech API (Chrome/Edge recommended)

If speech API is unavailable, the panel shows a clear message; manual + HTTP paths still work.

Interim transcripts are **preview only**. Cancel discards without executing.

## Overlay

When PTT is active, overlay header shows `● LISTENING` (minimal, no long transcript).

Privacy mode redacts transcript details on dashboard/overlay.

## Manual mic test flow

1. `npm start`
2. Open admin dashboard
3. Confirm VS Code extension connected (optional, for dictation edits)
4. Manual input: `switch manual dictation mode`
5. Hold **Hold to talk**, speak a short phrase
6. Release — confirm transcript preview, then result
7. Try `scratch that` via manual input
8. Simulate low confidence via API:
   ```bash
   curl -X POST http://127.0.0.1:17345/api/utterance \
     -H 'Content-Type: application/json' \
     -d '{"text":"switch command mode","source":"admin-mic","confidence":0.2}'
   ```
9. `emergency stop` — confirm PTT clears and listening stops
10. `resume previous mode`

## Automated tests (no microphone)

```bash
npm run test:ptt           # PTT start/stop/cancel, emergency clears PTT
npm run test:speech-input  # sources, confidence gating, no AI on dictation
npm run test:phase3        # both
```

Phase 1/2/2.5 tests still pass without STT.

## Reliable test path (still recommended)

```bash
npm run test:utterance -- "switch command mode"
npm run speech:send -- "switch manual dictation mode"
```

HTTP utterance injection remains the CI-friendly path.

## Future (not Phase 3)

- MOZA / wheel PTT
- Global keyboard PTT
- Always-listening mode
- Stream audio routing
- Cloud STT vendor integrations beyond optional Whisper upload
