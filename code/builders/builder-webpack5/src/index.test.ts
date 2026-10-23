import { cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { Channel } from 'storybook/internal/channels';
import type { Options, Presets, TurbosnapOutputDraft } from 'storybook/internal/types';

import { fs, vol } from 'memfs';
import { dirname, join, resolve } from 'pathe';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import webpack from 'webpack';

import { build, executor } from './index.ts';
import { createWebpackOutputEvidence } from './turbosnap-output.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('./turbosnap-output.ts', () => ({ createWebpackOutputEvidence: vi.fn() }));

const evidence: TurbosnapOutputDraft = {
  status: 'incomplete',
  reason: 'test-output',
  builder: { name: '@storybook/builder-webpack5', version: '1' },
  outputFiles: {},
  globalOutputHash: '',
  storyOutputHashes: {},
};

beforeEach(() => {
  vol.reset();
  vi.mocked(cp).mockImplementation(fs.promises.cp as typeof cp);
  vi.mocked(createWebpackOutputEvidence).mockResolvedValue(evidence);
});

afterEach(() => vi.restoreAllMocks());

it.each([
  {},
  { statsJson: false, webpackStatsJson: false },
  { statsJson: true },
  { statsJson: 'custom-stats' },
  { webpackStatsJson: true },
  { webpackStatsJson: 'custom-stats' },
])('collects Webpack evidence only for an explicit stats request: %j', async (statsOptions) => {
  const root = resolve('virtual-webpack-stats');
  const core = dirname(fileURLToPath(import.meta.resolve('storybook/package.json')));
  vol.fromJSON({
    [join(root, 'package.json')]: '{"name":"stats-gate-test"}',
    [join(root, 'entry.js')]: 'export const value = 1;',
    [join(core, 'dist/preview/runtime.js')]: 'export {};',
  });
  const compiler = webpack({
    context: root,
    mode: 'production',
    entry: './entry.js',
    output: { path: join(root, 'dist') },
    optimization: { minimize: false },
  });
  if (!compiler) throw new Error('Missing test compiler');
  compiler.inputFileSystem = fs as unknown as NonNullable<typeof compiler.inputFileSystem>;
  compiler.outputFileSystem = fs as unknown as NonNullable<typeof compiler.outputFileSystem>;
  vi.spyOn(executor, 'get').mockResolvedValue((() => compiler) as unknown as typeof webpack);

  const options: Options = {
    ...statsOptions,
    configType: 'PRODUCTION',
    configDir: join(root, '.storybook'),
    outputDir: join(root, 'dist'),
    channel: new Channel({}),
    presets: { apply: async (_key: string, config?: unknown) => config } as Presets,
  };
  const result = await build({ startTime: process.hrtime(), options } as Parameters<
    typeof build
  >[0]);
  const requested = !!(options.statsJson || options.webpackStatsJson);
  expect(createWebpackOutputEvidence).toHaveBeenCalledTimes(requested ? 1 : 0);
  expect(compiler.hooks.emit.taps.some((tap) => tap.name === 'StorybookTurbosnapOutput')).toBe(
    requested
  );
  expect(result).toBeDefined();
  expect(Object.hasOwn(result!, 'turbosnapOutput')).toBe(requested);
  if (requested) expect(result).toHaveProperty('turbosnapOutput', evidence);
});
