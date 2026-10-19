import { describe, expect, it } from 'vitest';

import { loadReactRendererModule, rendererModuleError } from './react-renderer-module.ts';

/**
 * The message below is the reason this module exists rather than a hardcoded path: without the
 * redirect, a missing `code/core` build surfaces as a resolution failure naming a file no harness
 * ever mentions, and the reader has no way to get from it to `yarn nx compile core`.
 */
const missingCoreBuild = new Error(
  "Cannot find module '/repo/node_modules/storybook/dist/common/index.js' imported from " +
    '/repo/code/renderers/react/src/componentManifest/utils.ts'
);

describe('rendererModuleError', () => {
  it('turns a missing core build into the command that fixes it', () => {
    const error = rendererModuleError('utils.ts', missingCoreBuild);
    expect(error.message).toContain('yarn nx compile core');
    expect(error.message).toContain('utils.ts');
  });

  it('keeps the original resolution failure as the cause', () => {
    // The rewritten message replaces the one Node produced, so the path it named has to survive or
    // a genuinely different resolution problem becomes undebuggable.
    expect(rendererModuleError('utils.ts', missingCoreBuild).message).toContain(
      'storybook/dist/common/index.js'
    );
  });

  it('passes through failures that are not about the core build', () => {
    const unrelated = new Error('Unexpected token');
    expect(rendererModuleError('utils.ts', unrelated)).toBe(unrelated);
  });

  it('handles a thrown non-Error without losing it', () => {
    expect(rendererModuleError('utils.ts', 'boom').message).toBe('boom');
  });
});

describe('loadReactRendererModule', () => {
  it('resolves the renderer source through the declared dependency', async () => {
    // Reaching a real module is what proves the package resolution works; a wrong anchor would fail
    // here rather than in whichever harness ran first.
    const mod = await loadReactRendererModule<{ invalidateCache: () => void }>('utils.ts');
    expect(typeof mod.invalidateCache).toBe('function');
  });
});
