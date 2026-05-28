# DriftCode Harness — Implementation Status

Last updated: Phase 3 experimental speech input.

This document is intentionally honest about what works today vs what is still scaffold.

## Product invariants (enforced in code)

| Invariant | Status |
|-----------|--------|
| LLM is not the OS — deterministic path first | **Yes** — `IntentParser` → registry → grammar before AI |
| Unknown intent fails closed in non-AI modes | **Yes** — `IntentType.Unknown`, no silent AI fallback |
| AI proposes patches; apply is explicit | **Yes** — `PatchStore` + `"apply the fix"` + validation |
| Emergency stop blocks meaningful work | **Yes** — router, adapters, AI layer; see `test:core-loop` |
| Protected paths blocked on apply | **Yes** — `validatePatch` + `protectedFileGlobs` |
| Deterministic commands do not call AI | **Tested** — `test:core-loop` asserts `aiCallsThisSession` unchanged |

## Phase 1 — Core loop (this pass)

| Item | Status |
|------|--------|
| `npm run test:core-loop` | **Done** — mode → dictation → emergency → fake AI patch → apply |
| Fake AI provider (`aiProviderId: fake`) | **Done** — no network; for CI/local acceptance |
| Patch validation | **Done** — `patch-validator.ts` before store/apply |
| Registry audit (`npm run audit:registry`) | **Done** — adapterAction + example coverage |
| Emergency stop behavior | **Hardened** — blocks adapters/AI; stale AI cancelled via generation token |
| Honest docs | **This file** + README/TESTING updates |

## Phase 2 — Manual voice coding grammar (this pass)

| Item | Status |
|------|--------|
| `code-grammar/` emitter layer | **Done** — symbols, keywords, casing, TS/web phrases |
| `npm run test:grammar` | **Done** — 27 unit tests |
| Correction commands | **Done** — undo, scratch that, replace word/phrase, delete word, repeat |
| Phrase range tracking | **Done** — VS Code extension + session metadata |
| Registry ↔ grammar alignment | **Done** — `type {text}` uses emitter; Command mode fails closed |
| `npm run test:phase2` | **Done** — simulated editing session |
| Real mic / STT | **Not Phase 2** — Phase 3 |

See [docs/PHASE2-GRAMMAR.md](PHASE2-GRAMMAR.md) for phrase tables and limitations.

## Phase 2.5 — Hardening (this pass)

| Item | Status |
|------|--------|
| Import/casing conventions | **Done** — camelCase services; PascalCase components/types |
| `wrapInIf` | **Done** — VS Code wraps selection; `NO_SELECTION` when empty |
| `preview patch` commands | **Done** — read-only summary; no diff/secrets in overlay |
| Realistic phrase tests | **Done** — fetch/json, throw, setState, export interface, etc. |
| VS Code session docs | **Done** — TESTING + MANUAL-DOGFOOD + clearer `NOT_CONNECTED` |
| `docs/MANUAL-DOGFOOD.md` | **Done** — 15-step hands-on script (no mic) |

## Phase 3 — Experimental speech input (this pass)

| Item | Status |
|------|--------|
| Input source model (`http`, `admin-manual`, `admin-mic`, `test`) | **Done** |
| PTT state + `/api/ptt/*` endpoints | **Done** |
| Admin manual utterance input | **Done** — dashboard text box |
| Admin mic/PTT panel (Web Speech API) | **Done** — experimental, optional |
| Confidence threshold + `LOW_CONFIDENCE` block | **Done** |
| Dashboard/overlay listening indicator | **Done** |
| Emergency clears PTT | **Done** |
| `npm run test:phase3` | **Done** |

See [docs/PHASE3-SPEECH-INPUT.md](PHASE3-SPEECH-INPUT.md).

**Not Phase 3:** MOZA/wheel, always-listening, global hotkeys, stream audio routing.

## What works today (testable)

- Utterance injection → normalize → parse → route → adapter dispatch
- Mode switching, manual dictation grammar, registry commands
- Emergency stop + resume
- Fake or OpenAI AI assist → pending patch → **preview** → apply workflow
- Admin dashboard + overlay SSE
- VS Code extension WebSocket (when connected)
- Terminal allowlist/blocklist (basic)
- Browser/Playwright app-test flows (optional peer)
- HTTP speech inbox / PTT text injection
- **Experimental admin mic/PTT** (browser Web Speech API — optional)
- PTT API (`/api/ptt/start|stop|cancel|state`) + confidence gating

## What is scaffold or partial

| Area | Reality |
|------|---------|
| **Microphone / STT** | Admin browser mic (experimental); inbox/HTTP still primary; no MOZA/wheel |
| **MOZA R5 / hardware PTT** | Not implemented |
| **Vibe coding autonomy** | Mode exists; bounded multi-step chain not built |
| **AI free-form typing** | Use **Vibe Coding** + `ask ai …` or registry `type {text}` in dictation; no always-on “AI types whatever I say” |
| **Terminal interrupt** | Stub only |
| **OBS end-to-end** | Adapter exists; stream scene workflows untested |
| **Profiles / import-export** | Planned V1 |
| **Onboarding wizard** | UI exists; not required for core loop |

## Modes quick reference

| Mode | Typing / coding |
|------|-----------------|
| **Manual Dictation** | Deterministic token grammar — first-class hands-free coding |
| **Command** | Structural editor commands + dictation |
| **AI Assist** | Deterministic + `ask ai` / registry AI commands → patch proposal |
| **Vibe Coding** | Broader AI implementation passes (bounded autonomy **not** fully wired) |

**Custom typing escape hatch:** If dictation grammar fails, switch to **AI Assist** or **Vibe Coding** and say e.g. `ask ai type const foo equals bar` — fake/OpenAI provider can emit `insertText`. This is intentional AI use (cost + latency), not deterministic dictation.

## Test commands

```bash
npm run test:grammar      # Phase 2 unit tests
npm run test:corrections  # correction registry tests
npm run test:phase2       # simulated dictation session
npm run test:preview-patch # Phase 2.5 patch preview
npm run test:ptt           # Phase 3 PTT endpoints
npm run test:speech-input  # Phase 3 source + confidence
npm run test:phase3        # Phase 3 acceptance
npm run test:core-loop    # Phase 1 acceptance
npm run test:mvp          # smoke
npm run test:benchmark    # registry parse rate
npm run audit:registry    # registry ↔ intent mapper audit
```

Enable fake AI without OpenAI:

```bash
curl -X PUT http://127.0.0.1:17345/api/config \
  -H 'Content-Type: application/json' \
  -d '{"aiProviderId":"fake","openAiApiKey":"test"}'
```

Or: `DRIFTCODE_AI_PROVIDER=fake npm start`

## Future phases (not started in Phase 1)

- Phase 4: MOZA/wheel PTT, driving-safe continuous STT, stream audio routing
- Phase 4: Stream routing, OBS scenes, privacy redaction depth
- Phase 5: Profiles, replay debugger, config import/export

Full spec: [docs/DRIFTCODE-HARNESS-SPEC.md](docs/DRIFTCODE-HARNESS-SPEC.md)
