import { createLazyDocgenMiddleware } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { DocgenMiddleware } from 'storybook/internal/types';

import type { WebComponentsDocgenOptions } from './component-docgen/build-docgen.ts';
import { buildDocgenPayload } from './component-docgen/build-docgen.ts';
import { isFailedManifest, loadManifests } from './component-docgen/manifest/load-manifest.ts';

export const createDocgenProvider = ({
  manifestPaths,
  typeProperty,
}: WebComponentsDocgenOptions): DocgenMiddleware =>
  createLazyDocgenMiddleware({
    createManager: async () => {
      if (manifestPaths.length === 0) {
        logger.warn(
          'No Custom Elements Manifest was configured; web-components server docgen is skipped. ' +
            'Set the `customElementsManifest` framework option or `customElements` in package.json.'
        );
        return undefined;
      }

      const loaded = await loadManifests(manifestPaths);
      for (const manifest of loaded) {
        if (isFailedManifest(manifest)) {
          logger.warn(manifest.error.message);
        } else {
          logger.debug(`Loaded Custom Elements Manifest ${manifest.path}`);
        }
      }
      return loaded;
    },
    extract: async (manifests, input) => buildDocgenPayload(input, { manifests, typeProperty }),
  });
