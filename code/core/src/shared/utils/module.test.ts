import { describe, expect, it } from 'vitest';

import { supportsInThreadHooks } from './module.ts';

describe('supportsInThreadHooks', () => {
  it.each([
    ['22.21.1', false],
    ['22.22.2', false],
    ['22.22.3', true],
    ['22.23.0', true],
    ['23.11.1', false],
    ['24.9.0', false],
    ['24.12.0', true],
    ['25.3.0', true],
    ['26.5.0', true],
  ])('%s → %s', (version, expected) => {
    expect(supportsInThreadHooks(version)).toBe(expected);
  });
});
