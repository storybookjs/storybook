import { createLazyDocgenMiddleware } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { DocgenMiddleware } from 'storybook/internal/types';

import type { WebComponentsDocgenOptions } from './component-docgen/build-docgen.ts';
import { buildDocgenPayload } from './component-docgen/build-docgen.ts';
import { ManifestManager } from './component-docgen/manifest/manifest-manager.ts';

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

      return new ManifestManager(manifestPaths);
    },
    extract: async (manager, input) =>
      buildDocgenPayload(input, {
        manifests: await manager.refresh(),
        typeProperty,
      }),
  });
