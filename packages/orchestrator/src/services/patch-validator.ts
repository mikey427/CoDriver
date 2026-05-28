import type { HarnessConfig } from '@driftcode/shared';
import { isProtectedPath } from './protected-paths.js';

export interface PatchInput {
  path: string;
  content?: string;
  oldText?: string;
  newText?: string;
}

export interface PatchValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
}

const MAX_PATCH_BYTES = 100_000;

/** Validate a pending patch before storing or applying. */
export function validatePatch(patch: PatchInput, config: HarnessConfig): PatchValidationResult {
  const path = patch.path?.trim();
  if (!path) {
    return { valid: false, errorCode: 'NO_PATH', errorMessage: 'Patch path is required' };
  }

  if (path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path)) {
    return { valid: false, errorCode: 'ABSOLUTE_PATH', errorMessage: 'Patch path must be relative to project root' };
  }

  if (path.includes('..')) {
    return { valid: false, errorCode: 'TRAVERSAL', errorMessage: 'Path traversal not allowed' };
  }

  if (isProtectedPath(path, config.protectedFileGlobs)) {
    return { valid: false, errorCode: 'PROTECTED_PATH', errorMessage: `Protected path: ${path}` };
  }

  const hasContent = patch.content != null && patch.content.length > 0;
  const hasOld = patch.oldText != null;
  const hasNew = patch.newText != null;

  if (!hasContent && !(hasOld && hasNew)) {
    return { valid: false, errorCode: 'EMPTY_PATCH', errorMessage: 'Patch must include content or oldText/newText pair' };
  }

  if (hasContent && (hasOld || hasNew)) {
    return { valid: false, errorCode: 'AMBIGUOUS_PATCH', errorMessage: 'Use either full content or oldText/newText, not both' };
  }

  if (hasOld !== hasNew) {
    return { valid: false, errorCode: 'INCOMPLETE_REPLACE', errorMessage: 'oldText and newText must both be present' };
  }

  const size =
    (patch.content?.length ?? 0) + (patch.oldText?.length ?? 0) + (patch.newText?.length ?? 0);
  if (size > MAX_PATCH_BYTES) {
    return { valid: false, errorCode: 'PATCH_TOO_LARGE', errorMessage: `Patch exceeds ${MAX_PATCH_BYTES} bytes` };
  }

  return { valid: true };
}
