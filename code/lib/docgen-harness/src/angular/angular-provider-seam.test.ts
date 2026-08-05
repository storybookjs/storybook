import type { Options } from 'storybook/internal/types';

import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import { expect, test } from 'vitest';

import * as angularVitePreset from '../../../../frameworks/angular-vite/src/preset.ts';
import { experimental_docgenProvider } from '../../../../frameworks/angular-vite/src/preset.ts';

// Requiring a real on-disk worker module is what keeps this honest: a stub export (empty array or a
// dangling descriptor) must not satisfy it.
test('angular-vite registers a docgen provider pointing at a worker module that exists', async () => {
  const options = {
    presets: {
      apply: async (key: string, fallback?: unknown) =>
        key === 'features' ? { experimentalDocgenServer: true } : fallback,
    },
  } as unknown as Options;

  const descriptors = await experimental_docgenProvider([], options);

  expect(
    descriptors.filter(
      (descriptor) =>
        isAbsolute(descriptor.moduleSpecifier) && existsSync(descriptor.moduleSpecifier)
    )
  ).toHaveLength(1);
});

// Story-docs providers are in-process middleware, so there is no module on disk to require: the
// preset key being an exported function is the whole registration. Read through the namespace and
// assert it is non-empty first, so a module that resolves but loses its exports cannot pass.
test('angular-vite registers a story-docs provider', () => {
  expect(Object.keys(angularVitePreset).length).toBeGreaterThan(0);
  expect(typeof angularVitePreset.experimental_storyDocsProvider).toBe('function');
});
