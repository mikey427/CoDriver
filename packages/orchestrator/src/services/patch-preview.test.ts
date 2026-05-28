import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPatchPreview } from './patch-preview.js';
import type { HarnessConfig } from '@driftcode/shared';

const config = {
  protectedFileGlobs: ['.env', '**/.env', '**/secrets/**'],
} as HarnessConfig;

describe('patch preview', () => {
  it('no patch', () => {
    const preview = buildPatchPreview(undefined, config);
    assert.equal(preview.hasPatch, false);
    assert.equal(preview.overlayText, 'No patch pending');
  });

  it('pending replace patch', () => {
    const preview = buildPatchPreview(
      { id: '1', createdAt: '', summary: 'Fix typo', path: 'src/example.ts', oldText: 'a', newText: 'b' },
      config,
    );
    assert.equal(preview.hasPatch, true);
    assert.equal(preview.patchType, 'replace');
    assert.equal(preview.valid, true);
    assert.match(preview.summary, /src\/example\.ts/);
    assert.doesNotMatch(preview.summary, /SECRET/);
  });

  it('protected path warning without leaking content', () => {
    const preview = buildPatchPreview(
      { id: '2', createdAt: '', summary: 'Env fix', path: '.env', content: 'SECRET=leak' },
      config,
    );
    assert.equal(preview.protected, true);
    assert.equal(preview.valid, false);
    assert.match(preview.summary, /PROTECTED/);
    assert.doesNotMatch(preview.summary, /SECRET/);
    assert.doesNotMatch(preview.overlayText, /SECRET/);
  });
});
