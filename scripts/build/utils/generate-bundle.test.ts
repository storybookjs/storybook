import type { OnResolveArgs, OnResolveResult, Plugin, PluginBuild } from 'esbuild';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { preserveEntrySideEffectsPlugin } from './generate-bundle.ts';

const captureEntryResolve = (plugin: Plugin) => {
  let resolve!: (args: OnResolveArgs) => OnResolveResult | null | undefined;
  plugin.setup({
    onResolve: (_options, callback) => {
      resolve = callback;
    },
  } as PluginBuild);
  return resolve;
};

describe('preserveEntrySideEffectsPlugin', () => {
  const dirCwd = '/repo/code/core';
  const entryPoints = ['./src/index.ts', './src/manager/runtime.tsx'];

  it('marks its entry points as side-effectful, resolved against the package dir', () => {
    const resolve = captureEntryResolve(preserveEntrySideEffectsPlugin(dirCwd, entryPoints));

    expect(resolve({ kind: 'entry-point', path: './src/index.ts' })).toEqual({
      path: join(dirCwd, './src/index.ts'),
      sideEffects: true,
    });
    expect(resolve({ kind: 'entry-point', path: './src/manager/runtime.tsx' })).toEqual({
      path: join(dirCwd, './src/manager/runtime.tsx'),
      sideEffects: true,
    });
  });

  it('leaves unknown paths and non-entry imports to default resolution', () => {
    const resolve = captureEntryResolve(preserveEntrySideEffectsPlugin(dirCwd, entryPoints));

    expect(resolve({ kind: 'entry-point', path: './src/other/entry.ts' })).toBeUndefined();
    // The same module imported as a dependency keeps its declared side-effect behavior.
    expect(resolve({ kind: 'import-statement', path: './src/index.ts' })).toBeUndefined();
    expect(resolve({ kind: 'import-statement', path: 'react' })).toBeUndefined();
  });
});
