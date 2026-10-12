import { createLazyDocgenMiddleware } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { DocgenMiddleware } from 'storybook/internal/types';

import type { WebComponentsDocgenOptions } from './component-docgen/build-docgen.ts';
import { buildDocgenPayload } from './component-docgen/build-docgen.ts';
import { CemManager } from './component-docgen/manifest/cem-manager.ts';
import { loadGenerator } from './component-docgen/source/generator.ts';
import { SourceManager } from './component-docgen/source/source-manager.ts';
import { type TagResolver, firstMatch } from './component-docgen/tag-resolver.ts';

export const createDocgenProvider = ({
  manifestPaths,
  autoGenerateManifest,
  previewFilePath,
}: WebComponentsDocgenOptions): DocgenMiddleware =>
  createLazyDocgenMiddleware({
    createManager: async () => {
      const resolvers: TagResolver[] = [];
      if (manifestPaths.length > 0) {
        resolvers.push(new CemManager(manifestPaths));
      }
      if (autoGenerateManifest) {
        const [typescript, generator] = await Promise.all([
          import('@typescript/typescript6'),
          loadGenerator(),
        ]);
        resolvers.push(
          new SourceManager(typescript.default ?? typescript, generator, previewFilePath)
        );
      }
      const [first, ...rest] = resolvers;
      if (!first) {
        logger.warn(
          'No Custom Elements Manifest was configured; web-components server docgen is skipped. ' +
            'Set the `customElementsManifest` framework option, set `customElements` in package.json, ' +
            'or set `autoGenerateManifest: true` to generate declarations from sources.'
        );
        return undefined;
      }
      return firstMatch([first, ...rest]);
    },
    extract: async (resolver, input) => buildDocgenPayload(input, { resolver }),
  });
