import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Storybook } from '@storybook/core';
import { getService } from '@storybook/core/internal/deep/shared/open-service/server';

import {
  getEffectiveToolAvailability,
  getToolAvailability,
  isModuleGraphSupported,
  type ToolAvailability,
} from './availability.ts';
import { getManifestStatus } from './manifest-status.ts';

vi.mock('./manifest-status.ts', () => ({ getManifestStatus: vi.fn() }));
vi.mock('@storybook/core/internal/deep/shared/open-service/server', () => ({
  getService: vi.fn(),
}));

/** An instance whose set-up plugins are `plugins`. */
function createStorybook(plugins: string[] = []): Pick<Storybook, 'callHook' | 'hasPlugin'> {
  return {
    callHook: vi.fn(async (_name: string, value?: unknown) => value),
    hasPlugin: vi.fn((name: string) => plugins.includes(name)),
  } as unknown as Pick<Storybook, 'callHook' | 'hasPlugin'>;
}

beforeEach(() => {
  vi.mocked(getManifestStatus).mockResolvedValue({
    available: false,
    hasManifests: false,
    hasFeatureFlag: false,
    docgenServer: false,
  });
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
    vi.mocked(getService).mockReturnValue({} as any);

    const result = await getToolAvailability(
      createStorybook(['@storybook/addon-vitest', '@storybook/addon-a11y'])
    );

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

  it.each([
    { plugins: [], expected: { testSupported: false, a11yEnabled: false } },
    { plugins: ['@storybook/addon-vitest'], expected: { testSupported: true, a11yEnabled: false } },
    { plugins: ['@storybook/addon-a11y'], expected: { testSupported: false, a11yEnabled: true } },
  ])('reads plugin presence from the instance: $plugins', async ({ plugins, expected }) => {
    const { testSupported, a11yEnabled } = await getToolAvailability(createStorybook(plugins));

    expect({ testSupported, a11yEnabled }).toEqual(expected);
  });

  it('enables the CLI docs gate on manifests alone, without the component-manifest flag', async () => {
    vi.mocked(getManifestStatus).mockResolvedValue({
      available: false,
      hasManifests: true,
      hasFeatureFlag: false,
      docgenServer: false,
    });

    const result = await getToolAvailability(createStorybook());

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

    const result = await getToolAvailability(createStorybook());

    expect(result.docsEnabledForCli).toBe(false);
  });

  it('probes the module-graph service', async () => {
    vi.mocked(getService).mockReturnValue({} as any);

    const result = await getToolAvailability(createStorybook());

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
