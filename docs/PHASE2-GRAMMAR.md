# Phase 2 — Manual Voice Coding Grammar

Phase 2 makes **deterministic** manual dictation feel like coding, not toy text insertion. No OpenAI, no microphone required for tests.

## Architecture

```
Utterance → Registry (commands) OR Code Grammar (Manual Dictation mode)
                ↓                           ↓
         command-to-intent            code-emitter.ts
                ↓                           ↓
           CommandRouter              insertText / corrections
                ↓                           ↓
           VS Code extension (range-tracked phrase history)
```

**Single grammar source:** `packages/orchestrator/src/pipeline/code-grammar/`

| File | Role |
|------|------|
| `symbol-map.ts` | Spoken symbols/operators (single source of truth) |
| `keyword-map.ts` | Keywords + literal phrases |
| `casing.ts` | camel / Pascal / snake / kebab / CONSTANT |
| `code-emitter.ts` | Phrase patterns + token emission |
| `grammar-types.ts` | `CodeEmissionResult`, `DictationPhraseRecord` |

Registry `type {text}` / `insert {text}` slots run through `emitDictationSlot()` so registry and free-form dictation share grammar.

## Supported phrase families

### Variable declarations

| Say | Emits |
|-----|-------|
| `const user equals await get user open paren id close paren` | `const user = await getUser(id)` |
| `let count equals zero` | `let count = 0` |
| `const is loading equals false` | `const isLoading = false` |
| `const items equals empty array` | `const items = []` |

### Functions

| Say | Emits |
|-----|-------|
| `function get user open paren id close paren` | `function getUser(id)` |
| `async function fetch user open paren id close paren` | `async function fetchUser(id)` |
| `arrow function` | `() => ` |
| `return await response dot json open paren close paren` | `return await response.json()` |

### Imports / exports

| Say | Emits |
|-----|-------|
| `import react from react` | `import React from 'react'` |
| `import use state from react` | `import { useState } from 'react'` |
| `import user service from services slash user service` | `import UserService from 'services/userService'` |
| `export default app` | `export default App` |

### Control flow

| Say | Emits |
|-----|-------|
| `if user` | `if (user) {` |
| `if not user` | `if (!user) {` |
| `else if loading` | `} else if (loading) {` |
| `try catch` | `try {\n} catch (error) {` |
| `for each item in items` | `items.forEach((item) => {` |

### Casing

| Say | Emits |
|-----|-------|
| `camel case get user profile` | `getUserProfile` |
| `pascal case get user profile` | `GetUserProfile` |
| `snake case get user profile` | `get_user_profile` |
| `constant case api url` | `API_URL` |

### Symbols (partial list)

`open paren` → `(`, `fat arrow` → `=>`, `optional chain` → `?.`, `new line` → newline, etc.  
Full map: `symbol-map.ts`

## Correction commands

| Command | Behavior |
|---------|----------|
| `undo last phrase` / `scratch that` | Remove last inserted phrase if document range still matches |
| `replace last phrase with …` | Replace phrase range (grammar applied to replacement) |
| `replace last word with …` | Replace last word in last phrase |
| `delete last word` | Remove last word from last phrase |
| `repeat last phrase` | Insert previous phrase again |

**Safe failure:** If the file changed since insertion → `PHRASE_RANGE_STALE` (no blind edits).

Phrase metadata is tracked in the VS Code extension (`phrase-corrections.ts`) and mirrored in orchestrator session (`dictationPhrases`).

## Editor / navigation commands

Work when VS Code extension is connected; otherwise `NOT_CONNECTED`:

- `go to line N`, `go to file …`, `go to symbol …`
- `select current line/word/function`, `delete current line`, `duplicate line`, `move line up/down`
- `comment line`, `format document`, `save file`

## Tests

```bash
npm run test:grammar      # 27 unit tests, no orchestrator
npm run test:corrections  # registry → intent mapping for corrections
npm run test:phase2       # simulated editing session (orchestrator running)
npm run test:core-loop    # Phase 1 regression
```

## Known limitations (Phase 2)

- **No real microphone/STT** — utterances injected via HTTP API or admin
- **Command mode** does not free-type code — switch to **Manual Dictation** first
- **Brace balancing** is basic — control-flow emits opening fragments only
- **Complex imports** (named multi-bind) not fully covered
- **`wrapInIf`** registered but extension handler not implemented yet
- **Full E2E** with live VS Code requires extension connected + F5 or install

## Phase 3 (planned)

- Whisper / continuous STT, MOZA bindings, richer block templates, previewPatch, wrapInIf
