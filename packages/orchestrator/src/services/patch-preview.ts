import type { HarnessConfig } from '@driftcode/shared';
import type { PendingPatch } from './patch-store.js';
import { isProtectedPath } from './protected-paths.js';
import { validatePatch } from './patch-validator.js';

export interface PatchPreviewSummary {
  hasPatch: boolean;
  path?: string;
  patchType?: 'replace' | 'content';
  summary: string;
  protected: boolean;
  valid: boolean;
  validationError?: string;
  /** Short line for overlay/TTS — no diff bodies */
  overlayText: string;
}

export function buildPatchPreview(patch: PendingPatch | undefined, config: HarnessConfig): PatchPreviewSummary {
  if (!patch) {
    return {
      hasPatch: false,
      summary: 'No pending patch',
      protected: false,
      valid: false,
      overlayText: 'No patch pending',
    };
  }

  const validation = validatePatch(patch, config);
  const protectedPath = isProtectedPath(patch.path, config.protectedFileGlobs);
  const patchType = patch.content != null ? 'content' : 'replace';
  const typeLabel = patchType === 'content' ? 'full file' : 'replace';

  let summary = `Patch for ${patch.path} (${typeLabel})`;
  if (patch.summary) summary = `${patch.summary} — ${patch.path} (${typeLabel})`;
  if (protectedPath) summary += ' [PROTECTED]';
  if (!validation.valid) summary += ` — invalid: ${validation.errorMessage}`;

  const overlayText = protectedPath
    ? 'Patch ready — protected path'
    : `Patch: ${patch.path}`;

  return {
    hasPatch: true,
    path: patch.path,
    patchType,
    summary,
    protected: protectedPath,
    valid: validation.valid && !protectedPath,
    validationError: validation.valid ? undefined : validation.errorMessage,
    overlayText,
  };
}
