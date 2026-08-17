import type { Options } from 'storybook/internal/types';

import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import { expect, test } from 'vitest';

import { experimental_docgenProvider } from '../../../../frameworks/angular-vite/src/preset.ts';

const optionsWithFeatures = (features: Record<string, unknown>) =>
  ({
    presets: {
      apply: async (key: string, fallback?: unknown) => (key === 'features' ? features : fallback),
    },
  }) as unknown as Options;

// Requiring a real on-disk worker module is what keeps this honest: a stub export (empty array or a
// dangling descriptor) must not satisfy it.
test('angular-vite registers a docgen provider pointing at a worker module that exists', async () => {
  const descriptors = await experimental_docgenProvider(
    [],
    optionsWithFeatures({ experimentalDocgenServer: true, angularFilterNonInputControls: true })
  );

  expect(descriptors).toHaveLength(1);
  expect(isAbsolute(descriptors[0].moduleSpecifier)).toBe(true);
  expect(existsSync(descriptors[0].moduleSpecifier)).toBe(true);
  // The worker receives exactly the props-table mode; the in-process analyzer derives everything
  // else from the component files themselves.
  expect(descriptors[0].options).toEqual({ propsTable: 'inputs' });
});

test('contributes no descriptor when the docgen server feature is off', async () => {
  await expect(experimental_docgenProvider([], optionsWithFeatures({}))).resolves.toEqual([]);
});
