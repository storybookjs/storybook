import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StorybookFeatures } from '@storybook/core/internal/types';

// Never settles, so the highlight listeners never start against a missing DOM.
const READY = vi.hoisted(() => vi.fn(() => new Promise<void>(() => {})));

vi.mock('@storybook/core/preview-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  addons: { ready: READY },
}));

const PREVIEWS = {
  backgrounds: () => import('./backgrounds/preview.ts'),
  highlight: () => import('./highlight/preview.ts'),
  measure: () => import('./measure/preview.ts'),
  outline: () => import('./outline/preview.ts'),
};

beforeEach(() => {
  vi.resetModules();
  READY.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('preview flags', () => {
  it.each([
    { feature: 'backgrounds', input: undefined, expected: 0 },
    { feature: 'backgrounds', input: { backgrounds: true }, expected: 1 },
    { feature: 'backgrounds', input: { backgrounds: false }, expected: 0 },
    { feature: 'measure', input: undefined, expected: 0 },
    { feature: 'measure', input: { measure: true }, expected: 1 },
    { feature: 'measure', input: { measure: false }, expected: 0 },
    { feature: 'outline', input: undefined, expected: 0 },
    { feature: 'outline', input: { outline: true }, expected: 1 },
    { feature: 'outline', input: { outline: false }, expected: 0 },
  ] as const)(
    '$feature keeps $expected decorator(s) with FEATURES $input',
    async ({ feature, input, expected }) => {
      vi.stubGlobal('FEATURES', input);
      const { default: preview } = await PREVIEWS[feature]();

      expect(preview.decorators).toHaveLength(expected);
    }
  );

  it.each([
    { input: undefined, expected: 0 },
    { input: { highlight: true }, expected: 1 },
    { input: { highlight: false }, expected: 0 },
  ] satisfies { input?: StorybookFeatures; expected: number }[])(
    'highlight starts $expected time(s) with FEATURES $input',
    async ({ input, expected }) => {
      vi.stubGlobal('FEATURES', input);
      const { default: preview } = await PREVIEWS.highlight();

      await (preview.beforeAll as () => void)();

      expect(READY).toHaveBeenCalledTimes(expected);
    }
  );
});
