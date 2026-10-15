import type { OnResolveArgs, OnResolveResult, Plugin, PluginBuild } from 'esbuild';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { preserveEntrySideEffectsPlugin } from './generate-bundle.ts';

// esbuild's onResolve callbacks may resolve asynchronously, so mirror the full return union.
type ResolveCallback = (
  args: OnResolveArgs
) => OnResolveResult | Promise<OnResolveResult | null | undefined> | null | undefined;

const captureEntryResolve = (plugin: Plugin) => {
  let resolve!: ResolveCallback;
  plugin.setup({
    onResolve: (_options, callback) => {
      resolve = callback;
    },
  } as PluginBuild);
  return resolve;
};

const dirCwd = '/repo/code/core';
const entryPoints = ['./src/index.ts', './src/manager/runtime.tsx'];

// esbuild requires the full OnResolveArgs shape on resolve callbacks; only path and kind vary
// between the plugin's behaviors.
const resolveArgs = (path: string, kind: OnResolveArgs['kind'] = 'entry-point'): OnResolveArgs => ({
  path,
  kind,
  importer: '',
  namespace: 'file',
  resolveDir: dirCwd,
  pluginData: undefined,
  with: {},
});

describe('preserveEntrySideEffectsPlugin', () => {
  it('marks its entry points as side-effectful, resolved against the package dir', () => {
    const resolve = captureEntryResolve(preserveEntrySideEffectsPlugin(dirCwd, entryPoints));

    expect(resolve(resolveArgs('./src/index.ts'))).toEqual({
      path: join(dirCwd, './src/index.ts'),
      sideEffects: true,
    });
    expect(resolve(resolveArgs('./src/manager/runtime.tsx'))).toEqual({
      path: join(dirCwd, './src/manager/runtime.tsx'),
      sideEffects: true,
    });
  });

  it('leaves unknown paths and non-entry imports to default resolution', () => {
    const resolve = captureEntryResolve(preserveEntrySideEffectsPlugin(dirCwd, entryPoints));

    expect(resolve(resolveArgs('./src/other/entry.ts'))).toBeUndefined();
    // The same module imported as a dependency keeps its declared side-effect behavior.
    expect(resolve(resolveArgs('./src/index.ts', 'import-statement'))).toBeUndefined();
    expect(resolve(resolveArgs('react', 'import-statement'))).toBeUndefined();
  });

  it('matches entries and imports whose separators disagree (Windows)', () => {
    // Configured entries can hold native Windows separators while the import specifier esbuild
    // resolves uses forward slashes, and the other way around.
    const windowsEntryPoints = ['.\\src\\index.ts', '.\\src\\manager\\runtime.tsx'];
    const resolve = captureEntryResolve(preserveEntrySideEffectsPlugin(dirCwd, windowsEntryPoints));

    expect(resolve(resolveArgs('./src/index.ts'))).toEqual({
      path: join(dirCwd, './src/index.ts'),
      sideEffects: true,
    });

    const posixResolve = captureEntryResolve(preserveEntrySideEffectsPlugin(dirCwd, entryPoints));
    expect(posixResolve(resolveArgs('.\\src\\manager\\runtime.tsx'))).toEqual({
      path: join(dirCwd, './src/manager/runtime.tsx'),
      sideEffects: true,
    });
  });
});
