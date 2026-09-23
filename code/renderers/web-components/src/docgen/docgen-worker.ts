import { createLazyDocgenMiddleware } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { DocgenMiddleware } from 'storybook/internal/types';

import type { WebComponentsDocgenOptions } from './component-docgen/build-docgen.ts';
import { buildDocgenPayload } from './component-docgen/build-docgen.ts';
import { loadManifests } from './component-docgen/manifest/load-manifest.ts';

export const createDocgenProvider = (options: WebComponentsDocgenOptions): DocgenMiddleware =>
  createLazyDocgenMiddleware({
    createManager: () =>
      loadManifests(options.manifestPaths).then((loaded) => {
        for (const manifest of loaded) {
          if ('error' in manifest) {
            logger.warn(manifest.error.message);
          } else {
            logger.debug(`Loaded Custom Elements Manifest ${manifest.path}`);
          }
        }
        return loaded;
      }),
    extract: async (manifests, input) => buildDocgenPayload(input, { manifests, options }),
  });
