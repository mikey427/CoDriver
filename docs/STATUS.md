# DriftCode Harness — Implementation Status

Last updated: Phase 2 manual coding grammar pass.

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

## What works today (testable)

- Utterance injection → normalize → parse → route → adapter dispatch
- Mode switching, manual dictation grammar, registry commands
- Emergency stop + resume
- Fake or OpenAI AI assist → pending patch → apply workflow
- Admin dashboard + overlay SSE
- VS Code extension WebSocket (when connected)
- Terminal allowlist/blocklist (basic)
- Browser/Playwright app-test flows (optional peer)
- HTTP speech inbox / PTT text injection

## What is scaffold or partial

| Area | Reality |
|------|---------|
| **Microphone / STT** | Whisper path exists but not driving-safe continuous listen |
| **MOZA R5 / hardware PTT** | Not implemented |
| **Vibe coding autonomy** | Mode exists; bounded multi-step chain not built |
| **AI free-form typing** | Use **Vibe Coding** + `ask ai …` or registry `type {text}` in dictation; no always-on “AI types whatever I say” |
| **previewPatch** | Referenced in modes; extension handler missing |
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

- Phase 2: Production STT/PTT, MOZA bindings, driving-safe mic UX
- Phase 3: Vibe coding step limits, previewPatch, terminal interrupt
- Phase 4: Stream routing, OBS scenes, privacy redaction depth
- Phase 5: Profiles, replay debugger, config import/export

Full spec: [docs/DRIFTCODE-HARNESS-SPEC.md](docs/DRIFTCODE-HARNESS-SPEC.md)
