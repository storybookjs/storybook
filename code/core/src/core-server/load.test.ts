import { Channel } from 'storybook/internal/channels';
import {
  getProjectRoot,
  loadAllPresets,
  loadMainConfig,
  resolveAddonName,
  validateFrameworkName,
} from 'storybook/internal/common';
import { oneWayHash } from 'storybook/internal/telemetry';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolvePackageDir, safeResolveModule } from '../shared/utils/module.ts';
import { loadStorybook } from './load.ts';
import { applyServicesPresetOnce } from './utils/apply-services-preset-once.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });
vi.mock('../shared/utils/module.ts', { spy: true });
vi.mock('./utils/apply-services-preset-once.ts', { spy: true });

const secondPassPresets = () => vi.mocked(loadAllPresets).mock.calls[1][0].corePresets;

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(getProjectRoot).mockReturnValue('/project');
  vi.mocked(oneWayHash).mockReturnValue('cache-key');
  vi.mocked(loadMainConfig).mockResolvedValue({ framework: '/framework', stories: [] });
  vi.mocked(validateFrameworkName).mockImplementation(() => {});
  vi.mocked(resolveAddonName).mockReturnValue(undefined);
  vi.mocked(resolvePackageDir).mockImplementation((packageName) =>
    packageName === 'storybook' ? '/storybook' : '/builder'
  );
  vi.mocked(applyServicesPresetOnce).mockResolvedValue();

  vi.mocked(loadAllPresets)
    .mockResolvedValueOnce({
      apply: vi.fn().mockResolvedValue({ builder: 'file:///builder/dist/index.js' }),
    })
    .mockResolvedValueOnce({ apply: vi.fn().mockResolvedValue({}) });
});

describe('loadStorybook', () => {
  it('loads the builder preset when the builder ships one', async () => {
    vi.mocked(safeResolveModule).mockReturnValue('/builder/dist/preset.js');

    await loadStorybook({ configDir: '/config', channel: new Channel({}) });

    expect(vi.mocked(safeResolveModule)).toHaveBeenCalledWith({
      specifier: '/builder/dist/preset.js',
    });
    expect(secondPassPresets()).toEqual([
      '/storybook/dist/core-server/presets/common-preset.js',
      '/framework/preset',
      '/builder/dist/preset.js',
    ]);
  });

  it('skips the builder preset when the builder ships none', async () => {
    vi.mocked(safeResolveModule).mockReturnValue(undefined);

    await loadStorybook({ configDir: '/config', channel: new Channel({}) });

    expect(secondPassPresets()).toEqual([
      '/storybook/dist/core-server/presets/common-preset.js',
      '/framework/preset',
    ]);
  });
});
