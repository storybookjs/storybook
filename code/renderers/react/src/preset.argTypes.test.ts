import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { MISSING_REACT_DOCGEN } from './docgen/engine.ts';
import { internal_getArgTypesData } from './preset.ts';

const resolvable = vi.hoisted(() => new Set(['react-docgen', 'typescript']));

vi.mock('../../../core/src/shared/utils/module.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  importMetaResolve: (id: string) => {
    if (!resolvable.has(id)) {
      throw new Error(`Cannot find module '${id}'`);
    }
    return `/mocked/${id}`;
  },
}));

const extractArgTypesFromDocgen = vi.hoisted(() => vi.fn(async () => ({ fromReactDocgen: {} })));
const extractArgTypesFromDocgenTypescript = vi.hoisted(() =>
  vi.fn(async () => ({ fromReactDocgenTypescript: {} }))
);
vi.mock('./componentManifest/reactDocgen/extractReactDocgenInfo.ts', () => ({
  extractArgTypesFromDocgen,
}));
vi.mock('./componentManifest/reactDocgen/extractReactTypescriptDocgenInfo.ts', () => ({
  extractArgTypesFromDocgenTypescript,
}));

// A TypeScript project with docgen server on: one plan per `presetsList`.
const getArgTypes = (componentFilePath: string) =>
  internal_getArgTypesData(null, {
    componentFilePath,
    componentExportName: 'Button',
    presets: {
      apply: async (name: string) => (name === 'features' ? { docgenServer: true } : {}),
    } as unknown as Options['presets'],
    presetsList: [],
  });

beforeEach(() => {
  vi.spyOn(once, 'warn').mockImplementation(() => undefined);
  resolvable.add('react-docgen');
});

afterEach(() => {
  vi.clearAllMocks();
});

it('reads TypeScript components with react-docgen-typescript', async () => {
  await expect(getArgTypes('/app/Button.tsx')).resolves.toEqual({
    fromReactDocgenTypescript: {},
  });
  expect(extractArgTypesFromDocgen).not.toHaveBeenCalled();
});

it('reads JavaScript components with react-docgen', async () => {
  await expect(getArgTypes('/app/Button.jsx')).resolves.toEqual({ fromReactDocgen: {} });
  expect(extractArgTypesFromDocgenTypescript).not.toHaveBeenCalled();
  expect(once.warn).not.toHaveBeenCalled();
});

it('warns once when a JavaScript component needs the missing react-docgen', async () => {
  resolvable.delete('react-docgen');

  await expect(getArgTypes('/app/Button.jsx')).resolves.toBeNull();
  await expect(getArgTypes('/app/Button.tsx')).resolves.toEqual({
    fromReactDocgenTypescript: {},
  });
  expect(vi.mocked(once.warn).mock.calls).toEqual([[MISSING_REACT_DOCGEN]]);
});
