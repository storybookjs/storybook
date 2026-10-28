import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getInstanceContext } from '@storybook/core/internal/deep/shared/instance-context';
import { getService } from '@storybook/core/internal/deep/shared/open-service/server';
import type { Options } from '@storybook/core/internal/types';

import { isAddonA11yEnabled } from './addon-a11y.ts';
import { isAddonVitestEnabled } from './addon-vitest.ts';
import {
  getEffectiveToolAvailability,
  getToolAvailability,
  isModuleGraphSupported,
  type ToolAvailability,
} from './availability.ts';
import { getManifestStatus } from './manifest-status.ts';

vi.mock('@storybook/core/internal/deep/shared/instance-context', () => ({
  getInstanceContext: vi.fn(),
}));
vi.mock('./manifest-status.ts', () => ({ getManifestStatus: vi.fn() }));
vi.mock('./addon-vitest.ts', () => ({ isAddonVitestEnabled: vi.fn() }));
vi.mock('./addon-a11y.ts', () => ({ isAddonA11yEnabled: vi.fn() }));
vi.mock('@storybook/core/internal/deep/shared/open-service/server', () => ({
  getService: vi.fn(),
}));

function createOptions(): Options {
  return {
    presets: {
      apply: vi.fn(async (_key: string, defaultValue?: unknown) => defaultValue),
    },
  } as unknown as Options;
}

beforeEach(() => {
  vi.mocked(getInstanceContext).mockReturnValue(undefined);
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
    vi.mocked(getManifestStatus).mockResolvedValue({
      available: true,
      hasManifests: true,
      hasFeatureFlag: true,
      docgenServer: true,
    });
    vi.mocked(isAddonVitestEnabled).mockResolvedValue(true);
    vi.mocked(isAddonA11yEnabled).mockResolvedValue(true);
    vi.mocked(getService).mockReturnValue({} as any);

    const result = await getToolAvailability(createOptions());

    expect(result).toEqual({
      moduleGraphSupported: true,
      docsEnabled: true,
      docsEnabledForCli: true,
      docsHasManifests: true,
      docsFeatureEnabled: true,
      testSupported: true,
      a11yEnabled: true,
      docgenServer: true,
    });
  });

  it.each([true, false])(
    'uses instance plugin presence (%s) instead of legacy markers',
    async (enabled) => {
      const hasPlugin = vi.fn((_name: string) => enabled);
      vi.mocked(getInstanceContext).mockReturnValue({
        storybook: { hasPlugin },
      } as unknown as NonNullable<ReturnType<typeof getInstanceContext>>);
      vi.mocked(isAddonVitestEnabled).mockResolvedValue(!enabled);
      vi.mocked(isAddonA11yEnabled).mockResolvedValue(!enabled);

      const availability = await getToolAvailability(createOptions());

      expect(availability.testSupported).toBe(enabled);
      expect(availability.a11yEnabled).toBe(enabled);
      expect(hasPlugin.mock.calls).toEqual([
        ['@storybook/addon-vitest'],
        ['@storybook/addon-a11y'],
      ]);
    }
  );

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

  it('probes the module-graph service', async () => {
    vi.mocked(getService).mockReturnValue({} as any);

    const result = await getToolAvailability(createOptions());

    expect(result.moduleGraphSupported).toBe(true);
    expect(getService).toHaveBeenCalledWith('core/module-graph', { internal: true });
  });
});

describe('getEffectiveToolAvailability', () => {
  const base: ToolAvailability = {
    moduleGraphSupported: false,
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
