import { describe, expect, it } from 'vitest';

import { loadCsf } from 'storybook/internal/csf-tools';

// Proves the package wiring is real: the peer dep on `storybook` resolves
// monorepo-internally and csf-tools is reachable from this package. An empty
// suite would pass silently; this cannot.
describe('devtools-spike package wiring', () => {
  it('resolves storybook/internal/csf-tools through the workspace peer dep', () => {
    expect(loadCsf).toBeTypeOf('function');
  });
});
