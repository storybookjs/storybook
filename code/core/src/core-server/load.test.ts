import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getProjectRoot,
  loadAllPresets,
  loadMainConfig,
  validateFrameworkName,
} from 'storybook/internal/common';
import { oneWayHash } from 'storybook/internal/telemetry';

import { loadStorybook } from './load.ts';
import { applyServicesPresetOnce } from './utils/apply-services-preset-once.ts';
import { resolvePackageDir } from '../shared/utils/module.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });
vi.mock('./utils/apply-services-preset-once.ts', { spy: true });
vi.mock('../shared/utils/module.ts', { spy: true });

const apply = vi.fn(async (key: string) => {
  if (key === 'core') {
    return {};
  }
  if (key === 'features') {
    return {};
  }
  return undefined;
});

beforeEach(() => {
  apply.mockClear();
  vi.mocked(getProjectRoot).mockReturnValue('/repo');
  vi.mocked(oneWayHash).mockReturnValue('hash');
  vi.mocked(loadMainConfig).mockResolvedValue({ framework: undefined } as never);
  vi.mocked(loadAllPresets).mockResolvedValue({ apply } as never);
  vi.mocked(applyServicesPresetOnce).mockResolvedValue(undefined);
  vi.mocked(resolvePackageDir).mockReturnValue('/storybook');
  vi.mocked(validateFrameworkName).mockImplementation(() => {});
  globalThis.STORYBOOK_SERVICES_PRESET_PROMISE = undefined;
});

afterEach(() => {
  globalThis.STORYBOOK_SERVICES_PRESET_PROMISE = undefined;
  vi.unstubAllGlobals();
});

describe('loadStorybook skipServices', () => {
  it('does not apply services during a metadata-only load', async () => {
    await loadStorybook({
      configDir: '/repo/.storybook',
      skipServices: true,
      ignorePreview: true,
    });

    expect(applyServicesPresetOnce).not.toHaveBeenCalled();
  });

  it('applies services on a later load so an attached host can still register them', async () => {
    await loadStorybook({
      configDir: '/repo/.storybook',
      skipServices: true,
      ignorePreview: true,
    });
    await loadStorybook({
      configDir: '/repo/.storybook',
      ignorePreview: true,
    });

    expect(applyServicesPresetOnce).toHaveBeenCalledOnce();
  });
});
