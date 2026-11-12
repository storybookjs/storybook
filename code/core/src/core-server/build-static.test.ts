import * as disk from 'node:fs/promises';

import { loadAllPresets, loadMainConfig } from 'storybook/internal/common';
import type { Builder, Presets } from 'storybook/internal/types';

import { fs, vol } from 'memfs';
import { join, resolve } from 'pathe';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { buildStaticStandalone } from './build-static.ts';
import { resolvePackageDir } from '../shared/utils/module.ts';
import { applyServicesPresetOnce } from './utils/apply-services-preset-once.ts';
import { getBuilders } from './utils/get-builders.ts';
import { writeManifests } from './utils/manifests/manifests.ts';
import { outputStats } from './utils/output-stats.ts';
import { createTurbosnapOutputFinalizer } from './utils/turbosnap-output.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger');
vi.mock('./utils/apply-services-preset-once.ts');
vi.mock('./utils/get-builders.ts');
vi.mock('./utils/index-json.ts');
vi.mock('./utils/manifests/manifests.ts');
vi.mock('./utils/output-stats.ts');
vi.mock('./utils/turbosnap-output.ts');

beforeEach(() => {
  vol.reset();
  vi.mocked(disk.rm).mockImplementation(fs.promises.rm as typeof disk.rm);
  vi.mocked(disk.mkdir).mockImplementation(fs.promises.mkdir as typeof disk.mkdir);
  vi.mocked(disk.cp).mockImplementation(fs.promises.cp as typeof disk.cp);
  vi.stubGlobal('FEATURES', {});
  vi.stubEnv('STORYBOOK_INVOKED_BY', '');
  vi.mocked(loadMainConfig).mockResolvedValue({ framework: '', stories: [] });
  vi.mocked(applyServicesPresetOnce).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it.each([
  {},
  { statsJson: false, webpackStatsJson: false },
  { statsJson: true },
  { statsJson: 'custom-stats' },
  { webpackStatsJson: true },
  { webpackStatsJson: 'custom-stats' },
])('finalizes output evidence only for an explicit stats request: %j', async (statsOptions) => {
  const root = resolve('virtual-static-stats');
  const core = resolvePackageDir('storybook');
  vol.fromJSON({ [join(core, 'assets/browser/runtime.js')]: 'export {};' });
  const presets = {
    apply: async (key: string) =>
      ({ features: { componentsManifest: true }, core: { disableProjectJson: true } })[key],
  } as Presets;
  vi.mocked(loadAllPresets).mockResolvedValue(presets);
  const stats = { toJson: () => ({ modules: [] }) };
  const builder = { build: vi.fn(async () => stats) } as unknown as Builder<unknown>;
  vi.mocked(getBuilders).mockResolvedValue([builder, builder]);
  const finalize = vi.fn(async () => stats);
  vi.mocked(createTurbosnapOutputFinalizer).mockResolvedValue(finalize);

  await buildStaticStandalone({
    ...statsOptions,
    configDir: join(root, '.storybook'),
    outputDir: join(root, 'dist'),
    previewOnly: true,
    test: true,
  });

  const statsOption = statsOptions.statsJson || statsOptions.webpackStatsJson;
  const requested = !!statsOption;
  expect(createTurbosnapOutputFinalizer).toHaveBeenCalledTimes(requested ? 1 : 0);
  expect(finalize).toHaveBeenCalledTimes(requested ? 1 : 0);
  expect(outputStats).toHaveBeenCalledTimes(requested ? 1 : 0);
  expect(writeManifests).toHaveBeenCalledWith(join(root, 'dist'), presets, {
    includeTurbosnapOutput: requested,
  });
  if (requested) {
    expect(createTurbosnapOutputFinalizer).toHaveBeenCalledWith(
      join(root, '.storybook'),
      join(root, 'dist'),
      statsOption === true ? join(root, 'dist') : statsOption
    );
  }
});
