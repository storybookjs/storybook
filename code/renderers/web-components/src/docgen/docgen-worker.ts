import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { DocgenMiddleware, DocgenProvider } from 'storybook/internal/types';

import type { WebComponentsDocgenOptions } from './component-docgen/build-docgen.ts';
import { buildDocgenPayload } from './component-docgen/build-docgen.ts';
import type { ManifestLoadResult } from './component-docgen/manifest/load-manifest.ts';
import { loadManifests } from './component-docgen/manifest/load-manifest.ts';

const PREFIX = '[storybook-web-components-vite]';

export const createDocgenProvider = (options: WebComponentsDocgenOptions): DocgenMiddleware => {
  let manifestsPromise: Promise<ManifestLoadResult[]> | undefined;

  return (nextDocgen: DocgenProvider): DocgenProvider =>
    async (input) => {
      const storyImportPath = getStoryImportPathFromEntry(input.entry);
      if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
        return nextDocgen(input);
      }

      const manifests = await (manifestsPromise ??= loadManifests(options.manifestPaths).then(
        (loaded) => {
          for (const manifest of loaded) {
            if ('error' in manifest) {
              logger.warn(`${PREFIX} ${manifest.error.message}`);
            } else {
              logger.debug(`${PREFIX} Loaded Custom Elements Manifest ${manifest.path}`);
            }
          }
          return loaded;
        }
      ));
      const ours = buildDocgenPayload(input, { manifests, options });

      if (!ours) {
        return nextDocgen(input);
      }
      if (ours.error) {
        return (await nextDocgen(input)) ?? ours;
      }
      return { ...(await nextDocgen(input)), ...ours };
    };
};
