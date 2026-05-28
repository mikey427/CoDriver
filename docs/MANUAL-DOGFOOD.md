# Manual Dogfood Script (Phase 2.5)

**Time:** ~10–15 minutes  
**Requires:** orchestrator + VS Code extension. **No real microphone** — use HTTP utterance injection or the admin test box.

This script validates the deterministic manual-coding foundation before real STT/PTT.

## Before you start

```bash
npm run build
npm start                    # terminal 1 — http://127.0.0.1:17345
npm run build:extension      # once
```

Launch the extension (F5 in `packages/vscode-extension` or install VSIX). Open a workspace folder. Confirm the status bar shows **Connected** to the orchestrator.

Optional fake AI (no OpenAI key):

```bash
curl -X PUT http://127.0.0.1:17345/api/config \
  -H 'Content-Type: application/json' \
  -d '{"aiProviderId":"fake","openAiApiKey":"test"}'
```

Inject utterances via:

```bash
npm run test:utterance -- "your phrase here"
```

Or use **Admin → Dashboard** utterance input.

---

## Flow

### 1. Start orchestrator

- `npm start` — verify `http://127.0.0.1:17345/api/health` returns OK.

### 2. Connect VS Code extension

- Reload VS Code window if needed.
- Dashboard **adapterHealth.vscode** should be `connected`.
- If `NOT_CONNECTED`, see [TESTING.md](../TESTING.md#vs-code-extension) troubleshooting.

### 3. Open a scratch TypeScript file

- Create `scratch.ts` in the workspace.
- Make it the active editor (dashboard should show path + cursor).

### 4. Switch to Manual Dictation mode

```bash
npm run test:utterance -- "switch manual dictation mode"
```

### 5. Dictate a const declaration

```bash
npm run test:utterance -- "const user equals await get user open paren id close paren"
```

**Expect in editor:** `const user = await getUser(id)`

### 6. Dictate a function phrase

```bash
npm run test:utterance -- "function handle submit open paren close paren"
```

**Expect:** `function handleSubmit()`

### 7. Replace last word

```bash
npm run test:utterance -- "switch command mode"
npm run test:utterance -- "replace last word with click"
```

**Expect:** last identifier word replaced safely (range-tracked).

### 8. Scratch that

```bash
npm run test:utterance -- "scratch that"
```

**Expect:** last dictated phrase removed. If `PHRASE_RANGE_STALE`, the extension lost range sync — re-dictate once.

### 9. Repeat last phrase

```bash
npm run test:utterance -- "repeat last phrase"
```

**Expect:** previous phrase inserted again at cursor.

### 10. Create a fake AI patch

```bash
npm run test:utterance -- "switch ai assist mode"
npm run test:utterance -- "ask ai fix this"
```

**Expect:** dashboard shows `pendingPatchSummary`; no file change yet.

### 11. Preview patch

```bash
npm run test:utterance -- "preview patch"
```

**Expect:** short summary (path + type). **No apply.** No secrets/diff bodies in overlay.

Also try: `show patch`, `what is the fix`.

### 12. Apply patch

```bash
npm run test:utterance -- "apply the fix"
```

**Expect:** VS Code applies replace/content patch (when extension connected). Patch cleared from store.

### 13. Emergency stop

```bash
npm run test:utterance -- "emergency stop"
```

**Expect:** blocked state; dictation/commands halted.

### 14. Resume

```bash
npm run test:utterance -- "resume previous mode"
```

**Expect:** emergency cleared; prior mode restored.

### 15. Note friction

Write down anything confusing — error text, wrong casing, surprise typing, stale corrections.

---

## Optional: wrap selection in if

1. Select a block of code in the editor.
2. `switch command mode`
3. `wrap in if`

**Expect:**

```typescript
if (condition) {
  // your selection
}
```

No selection → `NO_SELECTION`.

---

## Things to observe (checklist)

- [ ] Was the emitted code what I expected?
- [ ] Did correction (`scratch that`, replace) feel safe?
- [ ] Did overlay/admin show enough state (mode, VS Code connected, pending patch)?
- [ ] Did any command surprise-type text I didn't intend?
- [ ] Were errors clear (especially `NOT_CONNECTED`, `NO_PATCH`, `NO_SELECTION`)?
- [ ] Did `preview patch` stay read-only?
- [ ] Did import casing use camelCase for services (`userService`, not `UserService`)?

---

## Automated coverage

After dogfooding, run:

```bash
npm run test:grammar
npm run test:corrections
npm run test:phase2
npm run test:core-loop
npm run test:preview-patch
npm run audit:registry
```

See [docs/PHASE2-GRAMMAR.md](PHASE2-GRAMMAR.md) for full phrase reference.
