import type { Storybook } from '@storybook/core';

import { registerMdxService } from '../mdx-service/server.ts';

/** Serve MDX docs as a service when docgen-server manifests are enabled. */
export async function registerDocsServices(
  storybook: Pick<Storybook, 'callHook' | 'getStoryIndexGenerator'>
): Promise<void> {
  const features = await storybook.callHook('core:features:extend', undefined);

  if (features?.docgenServer && features?.componentsManifest) {
    registerMdxService({
      getIndex: () => storybook.getStoryIndexGenerator().then((generator) => generator.getIndex()),
    });
  }
}
