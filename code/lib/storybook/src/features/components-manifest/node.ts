import '../../storybook/server/hooks.ts';

import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';
import {
  registerManifests,
  writeManifests,
} from '@storybook/core/internal/deep/story-index/manifests/manifests';

type ManifestApp = Parameters<typeof registerManifests>[0]['app'];

/** Serve the component manifests in dev and write them into static builds while the flag is on. */
export default defineAddon(() => ({
  meta: { name: 'storybook/components-manifest' },
  setup(storybook): void {
    // Flags resolve at call time, after every plugin and preset could set them.
    const isEnabled = async (): Promise<boolean> =>
      (await storybook.callHook('core:features:extend', undefined)).componentsManifest === true;
    storybook.hook('server:app:extend', async (app) => {
      if (await isEnabled()) {
        // The dev server hands its Polka app through the generic `ServerApp` type.
        registerManifests({ app: app as ManifestApp, storybook });
      }
      return app;
    });
    storybook.hook('server:static-output:collect', async () =>
      (await isEnabled()) ? [({ outputDir }) => writeManifests(outputDir, storybook)] : []
    );
  },
}));
