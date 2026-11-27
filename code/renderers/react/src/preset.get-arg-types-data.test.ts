import { join } from 'node:path';

import { expect, test, vi } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { getSharedComponentMetaManager } from './componentManifest/componentMetaManagerSingleton.ts';
import { internal_getArgTypesData } from './preset.ts';

// Ghost stories infer the required args of components with this preset. On the docgen server it
// must not need the optional builder docgen packages.
// A factory that throws is the only way to fail on import; `spy: true` mocks still load the module.
vi.mock('react-docgen', () => {
  throw new Error('react-docgen must not load on the docgen server');
});
vi.mock('./componentManifest/componentMetaManagerSingleton.ts', { spy: true });
vi.mock('react-docgen-typescript', () => {
  throw new Error('react-docgen-typescript must not load on the docgen server');
});

const presets = {
  apply: async (name: string) => (name === 'features' ? { docgenServer: true } : {}),
} as unknown as Options['presets'];

test('infers required args with the docgen server engine', async () => {
  const argTypes = await internal_getArgTypesData(null, {
    componentFilePath: join(import.meta.dirname, '../template/cli/ts/Button.tsx'),
    componentExportName: 'Button',
    presets,
  });

  expect(argTypes?.label).toMatchObject({ name: 'label', type: { required: true } });
}, 60_000);

test('infers required args of a default export', async () => {
  const argTypes = await internal_getArgTypesData(null, {
    componentFilePath: join(
      import.meta.dirname,
      'componentManifest/__testfixtures__/DefaultExport.ts'
    ),
    componentExportName: 'default',
    presets,
  });

  expect(argTypes?.name).toMatchObject({ type: { required: true } });
  expect(argTypes?.size).toMatchObject({ type: { required: false } });
}, 60_000);

test('loads the TypeScript that typescript.docgenSpecifier names', async () => {
  const configDir = join(import.meta.dirname, '../.storybook');
  await internal_getArgTypesData(null, {
    componentFilePath: join(import.meta.dirname, '../template/cli/ts/Button.tsx'),
    componentExportName: 'Button',
    configDir,
    presets: {
      apply: async (name: string) =>
        name === 'features'
          ? { docgenServer: true }
          : name === 'typescript'
            ? { docgenSpecifier: '@typescript/native' }
            : {},
    } as unknown as Options['presets'],
  });

  expect(getSharedComponentMetaManager).toHaveBeenLastCalledWith({
    specifier: '@typescript/native',
    configDir,
  });
}, 60_000);
