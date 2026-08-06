import type { Options } from 'storybook/internal/types';

import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import { expect, test } from 'vitest';

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
