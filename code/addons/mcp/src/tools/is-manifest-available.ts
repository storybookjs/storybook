import type { Options } from 'storybook/internal/types';

export type ManifestFeatures = {
  componentsManifest?: boolean;
  experimentalComponentsManifest?: boolean;
  experimentalDocgenServer?: boolean;
};

export const hasComponentManifestFeature = (features: ManifestFeatures | undefined): boolean =>
  !!(features?.componentsManifest ?? features?.experimentalComponentsManifest);

export const isDocgenServerMode = (features: ManifestFeatures | undefined): boolean =>
  !!(features?.experimentalDocgenServer && features?.componentsManifest);

export type ManifestStatus = {
  available: boolean;
  hasManifests: boolean;
  hasFeatureFlag: boolean;
  /**
   * `experimentalDocgenServer` mode: the split/ref manifest format served from the
   * open services. In dev, `/manifests/*.json` is 404'd by core, so the addon reads
   * manifest data in-process instead of fetching it.
   */
  docgenServer: boolean;
};

export const getManifestStatus = async (options: Options): Promise<ManifestStatus> => {
  const [
    features,
    manifests,
    // Added for backwards compatibility with Storybook versions prior to v10.2.0-alpha.10
    // Should be removed once support for Storybook version < 10.2.0 is dropped
    legacyComponentManifestGenerator,
  ] = await Promise.all([
    options.presets.apply('features') as any,
    options.presets.apply('experimental_manifests', undefined, {
      manifestEntries: [],
    }),
    options.presets.apply('experimental_componentManifestGenerator'),
  ]);

  const hasFeatureFlag = hasComponentManifestFeature(features);

  // In docgen-server mode the dev `experimental_manifests` shell may be empty
  // (component rows are built from the docgen service, not the preset), so detect
  // it explicitly and treat manifests as available.
  const docgenServer = isDocgenServerMode(features);

  const hasManifests =
    docgenServer || (manifests && 'components' in manifests) || !!legacyComponentManifestGenerator;

  return {
    available: hasFeatureFlag && hasManifests,
    hasManifests,
    hasFeatureFlag,
    docgenServer,
  };
};
