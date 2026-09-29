import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getService } from '../../shared/open-service/server.ts';
import { importModule } from '../../shared/utils/module.ts';
import type { Options } from '../../types/index.ts';

import { isAddonA11yEnabled } from './addon-a11y.ts';
import { isAddonVitestEnabled } from './addon-vitest.ts';
import {
  getEffectiveToolAvailability,
  getToolAvailability,
  isModuleGraphSupported,
  isModuleGraphSupportedByBuilder,
  type ToolAvailability,
} from './availability.ts';
import { getManifestStatus } from './manifest-status.ts';
import { getReviewStatus } from './review-status.ts';

vi.mock('./review-status.ts', () => ({ getReviewStatus: vi.fn() }));
vi.mock('./manifest-status.ts', () => ({ getManifestStatus: vi.fn() }));
vi.mock('./addon-vitest.ts', () => ({ isAddonVitestEnabled: vi.fn() }));
vi.mock('./addon-a11y.ts', () => ({ isAddonA11yEnabled: vi.fn() }));
vi.mock('../../shared/open-service/server.ts', () => ({ getService: vi.fn() }));
vi.mock('../../shared/utils/module.ts', () => ({ importModule: vi.fn() }));

function createOptions({ features }: { features?: Record<string, unknown> } = {}): Options {
  return {
    presets: {
      apply: vi.fn(async (key: string, defaultValue?: unknown) => {
        if (key === 'features') {
          return features ?? {};
        }
        return defaultValue;
      }),
    },
  } as unknown as Options;
}

beforeEach(() => {
  vi.mocked(getReviewStatus).mockResolvedValue({
    available: false,
    availableForCli: false,
    hasFeatureFlag: false,
  });
  vi.mocked(getManifestStatus).mockResolvedValue({
    available: false,
    hasManifests: false,
    hasFeatureFlag: false,
    docgenServer: false,
  });
  vi.mocked(isAddonVitestEnabled).mockResolvedValue(false);
  vi.mocked(isAddonA11yEnabled).mockResolvedValue(false);
  vi.mocked(getService).mockImplementation(() => {
    throw new Error('not registered');
  });
});

describe('getToolAvailability', () => {
  it('composes availability from every probe', async () => {
    vi.mocked(getReviewStatus).mockResolvedValue({
      available: true,
      availableForCli: true,
      hasFeatureFlag: true,
    });
    vi.mocked(getManifestStatus).mockResolvedValue({
      available: true,
      hasManifests: true,
      hasFeatureFlag: true,
      docgenServer: true,
    });
    vi.mocked(isAddonVitestEnabled).mockResolvedValue(true);
    vi.mocked(isAddonA11yEnabled).mockResolvedValue(true);

    const result = await getToolAvailability(
      createOptions({ features: { changeDetection: true } }),
      { moduleGraphSupported: true }
    );

    expect(result).toEqual({
      moduleGraphSupported: true,
      changeDetectionEnabled: true,
      reviewEnabled: true,
      reviewEnabledForCli: true,
      docsEnabled: true,
      docsEnabledForCli: true,
      docsHasManifests: true,
      docsFeatureEnabled: true,
      testSupported: true,
      a11yEnabled: true,
      docgenServer: true,
    });
  });

  it('enables the CLI docs gate on manifests alone, without the component-manifest flag', async () => {
    vi.mocked(getManifestStatus).mockResolvedValue({
      available: false,
      hasManifests: true,
      hasFeatureFlag: false,
      docgenServer: false,
    });

    const result = await getToolAvailability(createOptions());

    expect(result.docsEnabled).toBe(false);
    expect(result.docsEnabledForCli).toBe(true);
  });

  it('disables the CLI docs gate when no manifests can be produced', async () => {
    vi.mocked(getManifestStatus).mockResolvedValue({
      available: false,
      hasManifests: false,
      hasFeatureFlag: false,
      docgenServer: false,
    });

    const result = await getToolAvailability(createOptions());

    expect(result.docsEnabledForCli).toBe(false);
  });

  it('probes the module-graph service directly when no override is given', async () => {
    vi.mocked(getService).mockReturnValue({} as any);

    const result = await getToolAvailability(createOptions());

    expect(result.moduleGraphSupported).toBe(true);
    expect(getService).toHaveBeenCalledWith('core/module-graph', { internal: true });
  });

  it('reuses pre-resolved features instead of re-applying the preset for review status', async () => {
    const options = createOptions({ features: { changeDetection: false } });

    await getToolAvailability(options, { features: { changeDetection: true } });

    expect(getReviewStatus).toHaveBeenCalledWith(options, { features: { changeDetection: true } });
  });
});

describe('getEffectiveToolAvailability', () => {
  const base: ToolAvailability = {
    moduleGraphSupported: false,
    changeDetectionEnabled: false,
    reviewEnabled: false,
    reviewEnabledForCli: false,
    docsEnabled: false,
    docsEnabledForCli: false,
    docsHasManifests: false,
    docsFeatureEnabled: false,
    testSupported: false,
    a11yEnabled: false,
    docgenServer: false,
  };

  it('returns availability unchanged when not multi-source', () => {
    expect(getEffectiveToolAvailability(base)).toBe(base);
  });

  it('forces docs availability on for multi-source composition', () => {
    expect(getEffectiveToolAvailability(base, { multiSource: true })).toMatchObject({
      docsEnabled: true,
      docsEnabledForCli: true,
      docsHasManifests: true,
      docsFeatureEnabled: true,
    });
  });
});

describe('isModuleGraphSupported', () => {
  it('returns true when the service is registered', async () => {
    vi.mocked(getService).mockReturnValue({} as any);
    expect(await isModuleGraphSupported()).toBe(true);
  });

  it('returns false when the service is not registered', async () => {
    vi.mocked(getService).mockImplementation(() => {
      throw new Error('missing');
    });
    expect(await isModuleGraphSupported()).toBe(false);
  });
});

describe('isModuleGraphSupportedByBuilder', () => {
  it('returns false when no builder is configured', async () => {
    const options = { presets: { apply: vi.fn().mockResolvedValue(undefined) } };
    expect(await isModuleGraphSupportedByBuilder(options as any)).toBe(false);
  });

  it('returns true when the builder exports a changeDetectionAdapter', async () => {
    vi.mocked(importModule).mockResolvedValue({ changeDetectionAdapter: () => {} });
    const options = {
      presets: { apply: vi.fn().mockResolvedValue({ builder: '@storybook/builder-vite' }) },
    };
    expect(await isModuleGraphSupportedByBuilder(options as any)).toBe(true);
  });

  it('returns false when the builder cannot be imported', async () => {
    vi.mocked(importModule).mockRejectedValue(new Error('cannot resolve'));
    const options = {
      presets: { apply: vi.fn().mockResolvedValue({ builder: '@storybook/builder-webpack5' }) },
    };
    expect(await isModuleGraphSupportedByBuilder(options as any)).toBe(false);
  });

  it('resolves a builder configured as an object with a name property', async () => {
    vi.mocked(importModule).mockResolvedValue({ changeDetectionAdapter: () => {} });
    const options = {
      presets: {
        apply: vi.fn().mockResolvedValue({ builder: { name: '@storybook/builder-vite' } }),
      },
    };
    expect(await isModuleGraphSupportedByBuilder(options as any)).toBe(true);
  });
});
