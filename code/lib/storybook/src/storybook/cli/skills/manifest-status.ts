import type { Storybook } from '@storybook/core';

export type ManifestFeatures = {
  componentsManifest?: boolean;
  experimentalComponentsManifest?: boolean;
  docgenServer?: boolean;
};

export const hasComponentManifestFeature = (features: ManifestFeatures | undefined): boolean =>
  !!(features?.componentsManifest ?? features?.experimentalComponentsManifest);

export const isDocgenServerMode = (features: ManifestFeatures | undefined): boolean =>
  !!(features?.docgenServer && features?.componentsManifest);

export type ManifestStatus = {
  available: boolean;
  hasManifests: boolean;
  hasFeatureFlag: boolean;
  /**
   * `docgenServer` mode: the split/ref manifest format served from the
   * open services. In dev, `/manifests/*.json` is 404'd by core, so the addon reads
   * manifest data in-process instead of fetching it.
   */
  docgenServer: boolean;
};

export const getManifestStatus = async (
  storybook: Pick<Storybook, 'callHook'>
): Promise<ManifestStatus> => {
  const [
    features,
    manifests,
    // Added for backwards compatibility with Storybook versions prior to v10.2.0-alpha.10
    // Should be removed once support for Storybook version < 10.2.0 is dropped
    legacyComponentManifestGenerator,
  ] = await Promise.all([
    storybook.callHook('core:features:extend', undefined),
    storybook.callHook('index:manifests:extend', undefined, { manifestEntries: [] }),
    storybook.callHook('index:component-manifest-generator:extend', undefined),
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
