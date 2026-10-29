import { describe, it, expect, vi } from 'vitest';
import { getManifestStatus } from './manifest-status.ts';
import type { Storybook } from '@storybook/core';

function createMockOptions({
  featureFlag = false,
  featureFlagName = 'componentsManifest' as 'componentsManifest' | 'experimentalComponentsManifest',
  hasManifests = false,
  hasLegacyComponentManifestGenerator = false,
  hasFeaturesObject = true,
  docgenServer = false,
}: {
  featureFlag?: boolean;
  featureFlagName?: 'componentsManifest' | 'experimentalComponentsManifest';
  hasManifests?: boolean;
  hasLegacyComponentManifestGenerator?: boolean;
  hasFeaturesObject?: boolean;
  docgenServer?: boolean;
} = {}): Pick<Storybook, 'callHook'> {
  return {
    callHook: vi.fn(async (name: string) => {
      if (name === 'core:features:extend') {
        return hasFeaturesObject
          ? {
              [featureFlagName]: featureFlag,
              ...(docgenServer ? { docgenServer: true } : {}),
            }
          : {};
      }
      if (name === 'index:manifests:extend') {
        return hasManifests ? { components: { v: 1, components: {} } } : undefined;
      }
      if (name === 'index:component-manifest-generator:extend') {
        return hasLegacyComponentManifestGenerator ? vi.fn() : undefined;
      }
      return undefined;
    }),
  } as unknown as Pick<Storybook, 'callHook'>;
}

describe('getManifestStatus', () => {
  it.each([
    {
      description: 'both feature flag and manifests are present',
      options: { featureFlag: true, hasManifests: true },
      expected: { available: true, hasManifests: true, hasFeatureFlag: true, docgenServer: false },
    },
    {
      description: 'both feature flag and legacy component manifest generator are present',
      options: { featureFlag: true, hasLegacyComponentManifestGenerator: true },
      expected: { available: true, hasManifests: true, hasFeatureFlag: true, docgenServer: false },
    },
    {
      description: 'missing manifests (unsupported framework)',
      options: { featureFlag: true, hasManifests: false },
      expected: {
        available: false,
        hasManifests: false,
        hasFeatureFlag: true,
        docgenServer: false,
      },
    },
    {
      description: 'missing feature flag',
      options: { featureFlag: false, hasManifests: true },
      expected: {
        available: false,
        hasManifests: true,
        hasFeatureFlag: false,
        docgenServer: false,
      },
    },
    {
      description: 'both are missing',
      options: { featureFlag: false, hasManifests: false },
      expected: {
        available: false,
        hasManifests: false,
        hasFeatureFlag: false,
        docgenServer: false,
      },
    },
    {
      description: 'features object is missing the flag',
      options: { hasManifests: true, hasFeaturesObject: false },
      expected: {
        available: false,
        hasManifests: true,
        hasFeatureFlag: false,
        docgenServer: false,
      },
    },
    {
      description: 'legacy experimentalComponentsManifest flag is true (backwards compat)',
      options: {
        featureFlag: true,
        featureFlagName: 'experimentalComponentsManifest' as const,
        hasManifests: true,
      },
      expected: { available: true, hasManifests: true, hasFeatureFlag: true, docgenServer: false },
    },
    {
      description: 'legacy experimentalComponentsManifest flag is false (backwards compat)',
      options: {
        featureFlag: false,
        featureFlagName: 'experimentalComponentsManifest' as const,
        hasManifests: true,
      },
      expected: {
        available: false,
        hasManifests: true,
        hasFeatureFlag: false,
        docgenServer: false,
      },
    },
    {
      description: 'docgenServer mode reports manifests available via the services',
      options: { featureFlag: true, hasManifests: false, docgenServer: true },
      expected: { available: true, hasManifests: true, hasFeatureFlag: true, docgenServer: true },
    },
  ])('should return correct status when $description', async ({ options, expected }) => {
    const mockOptions = createMockOptions(options);
    const result = await getManifestStatus(mockOptions);
    expect(result).toEqual(expected);
  });

  it('should correctly detect no manifests when components are not present in the manifests hook', async () => {
    // the `manifests` preset can be present but without manifests.components, because `addon-docs` sets manifests.docs
    const result = await getManifestStatus({
      callHook: vi.fn(async (name: string) => {
        if (name === 'core:features:extend') {
          return { componentsManifest: true };
        }
        if (name === 'index:manifests:extend') {
          // addon-docs has set manifests.docs, but there are no actual component manifests
          return { docs: { v: 1, docs: {} } };
        }
        return undefined;
      }),
    } as unknown as Pick<Storybook, 'callHook'>);
    expect(result).toEqual({
      available: false,
      hasManifests: false,
      hasFeatureFlag: true,
      docgenServer: false,
    });
  });
});
