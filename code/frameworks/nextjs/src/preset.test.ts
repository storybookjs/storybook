import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { getProjectRoot } from 'storybook/internal/common';

import type { TransformOptions } from '@babel/core';
import type { Configuration } from 'webpack';
import type { Options } from 'storybook/internal/types';

import nextBabelPreset from './babel/preset.ts';
import { babel, webpackFinal } from './preset.ts';

// The global test setup stubs package resolution; the preset reads the real Next.js version.
vi.mock('../../../core/src/shared/utils/module.ts', async (importOriginal) => importOriginal());

const executorGet = vi.hoisted(() => vi.fn());

vi.mock('@storybook/builder-webpack5', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@storybook/builder-webpack5')>();
  const webpack = (await import('webpack')).default;

  // Distinguishable subclasses: the framework must construct its webpack-core
  // plugins from the builder-selected instance (executor.get), never from its
  // own `webpack` import. A mismatch crashes compilation on consumer trees
  // where the two resolve to different copies.
  const builderWebpack = {
    ...webpack,
    NormalModuleReplacementPlugin: class extends webpack.NormalModuleReplacementPlugin {},
    ProvidePlugin: class extends webpack.ProvidePlugin {},
    DefinePlugin: class extends webpack.DefinePlugin {},
  } as typeof webpack;

  executorGet.mockResolvedValue(builderWebpack);

  return {
    ...actual,
    executor: { get: executorGet },
    WebpackDefinePlugin: builderWebpack.DefinePlugin,
  };
});

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  getProjectRoot: vi.fn(),
}));

// Loader configurators contribute loaders, not webpack-core plugins; they fall
// outside the provenance contract under test and need deep option/env setup.
vi.mock('./swc/loader.ts', () => ({ configureSWCLoader: vi.fn(async () => {}) }));
vi.mock('./babel/loader.ts', () => ({ configureBabelLoader: vi.fn(async () => {}) }));

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'sb-nextjs-preset-'));
  // Let the project config resolve `next/babel` the way a real Next.js project would.
  const nextDir = dirname(fileURLToPath(import.meta.resolve('next/package.json')));
  await mkdir(join(projectRoot, 'node_modules'));
  await symlink(nextDir, join(projectRoot, 'node_modules', 'next'), 'dir');
  vi.mocked(getProjectRoot).mockReturnValue(projectRoot);
  // Babel looks up `babel.config.*` in the current working directory, the project root
  vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);
});

afterEach(async () => {
  vi.mocked(process.cwd).mockRestore();
  await rm(projectRoot, { recursive: true, force: true });
});

it('loads an ESM babel.config.mjs and keeps the user plugins', async () => {
  await writeFile(
    join(projectRoot, 'noop-plugin.cjs'),
    "module.exports = () => ({ name: 'noop-plugin', visitor: {} });"
  );
  await writeFile(
    join(projectRoot, 'babel.config.mjs'),
    "export default { presets: ['next/babel'], plugins: ['./noop-plugin.cjs'] };"
  );

  const config = (await (babel as (config: TransformOptions) => Promise<TransformOptions>)(
    {}
  )) as TransformOptions;

  expect(config.babelrc).toBe(false);
  expect(config.configFile).toBe(false);
  expect(config.plugins).toContainEqual(
    expect.objectContaining({ file: expect.objectContaining({ request: './noop-plugin.cjs' }) })
  );
  // `next/babel` is replaced by Storybook's copy of the Next.js preset
  const presetNames = config.presets?.map((preset) => (Array.isArray(preset) ? preset[0] : preset));
  expect(presetNames).toEqual([nextBabelPreset]);
});

it('constructs webpackFinal plugins from the builder-selected webpack instance', async () => {
  const { executor } = await import('@storybook/builder-webpack5');
  const builderWebpack = await executor.get({} as Options);

  const options = {
    configType: 'PRODUCTION',
    configDir: join(projectRoot, '.storybook'),
    features: {},
    presets: {
      apply: vi.fn(async () => ({})),
    },
  } as unknown as Options;

  // `configureImports` resolves tsconfig paths from the config dir.
  await mkdir(join(projectRoot, '.storybook'), { recursive: true });

  // Real runs receive the builder's assembled config, which always carries a
  // plugins array; setupRuntimeConfig appends to it via optional chaining.
  if (typeof webpackFinal !== 'function') {
    throw new Error('webpackFinal is missing from the framework preset options');
  }
  const config = await webpackFinal({ plugins: [] } as Configuration, options);

  expect(executorGet).toHaveBeenCalledWith(options);

  // Every webpack-core plugin the framework contributes must come from the
  // instance the builder will compile with, or the plugin instances run
  // against a foreign parser and crash in expression hooks.
  const requiredPluginClasses = [
    builderWebpack.NormalModuleReplacementPlugin,
    builderWebpack.ProvidePlugin,
    builderWebpack.DefinePlugin,
  ];
  for (const pluginClass of requiredPluginClasses) {
    const found = config.plugins?.some((plugin) => plugin instanceof pluginClass);
    const presentPlugins = config.plugins?.map((plugin) => plugin?.constructor?.name).join(', ');
    expect(found, `Missing ${pluginClass.name}; config.plugins = [${presentPlugins}]`).toBe(true);
  }
});
