import { join } from 'node:path';

import { expect, test, vi } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { internal_getArgTypesData } from './preset.ts';

// Ghost stories infer the required args of components with this preset. On the docgen server it
// must not need the optional builder docgen packages.
vi.mock('react-docgen', () => {
  throw new Error('react-docgen must not load on the docgen server');
});
vi.mock('react-docgen-typescript', () => {
  throw new Error('react-docgen-typescript must not load on the docgen server');
});

test('infers required args with the docgen server engine', async () => {
  const presets = {
    apply: async (name: string) => (name === 'features' ? { docgenServer: true } : {}),
  } as unknown as Options['presets'];

  const argTypes = await internal_getArgTypesData(null, {
    componentFilePath: join(import.meta.dirname, '../template/cli/ts/Button.tsx'),
    componentExportName: 'Button',
    presets,
  });

  expect(argTypes?.label).toMatchObject({ name: 'label', type: { required: true } });
}, 60_000);
