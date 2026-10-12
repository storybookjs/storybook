import { createLazyDocgenMiddleware } from 'storybook/internal/common';
import type { DocgenMiddleware } from 'storybook/internal/types';

import type { WebComponentsDocgenOptions } from './component-docgen/build-docgen.ts';
import { buildDocgenPayload } from './component-docgen/build-docgen.ts';
import { CemManager } from './component-docgen/manifest/cem-manager.ts';
import { loadGenerator } from './component-docgen/source/generator.ts';
import { SourceManager } from './component-docgen/source/source-manager.ts';
import { type TagResolver, firstMatch } from './component-docgen/tag-resolver.ts';

export const createDocgenProvider = ({
  manifestPaths,
  previewFilePath,
}: WebComponentsDocgenOptions): DocgenMiddleware =>
  createLazyDocgenMiddleware({
    createManager: async (): Promise<TagResolver> => {
      const [typescript, generator] = await Promise.all([
        import('@typescript/typescript6'),
        loadGenerator(),
      ]);
      const sources = new SourceManager(
        typescript.default ?? typescript,
        generator,
        previewFilePath
      );
      return manifestPaths.length > 0
        ? firstMatch([new CemManager(manifestPaths), sources])
        : sources;
    },
    extract: async (resolver, input) => buildDocgenPayload(input, { resolver }),
  });
