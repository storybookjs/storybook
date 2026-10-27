import { createLazyDocgenMiddleware } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { DocgenMiddleware } from 'storybook/internal/types';

import type { WebComponentsDocgenOptions } from './component-docgen/build-docgen.ts';
import { buildDocgenPayload } from './component-docgen/build-docgen.ts';
import { CemManager } from './component-docgen/manifest/cem-manager.ts';
import { loadGenerator } from './component-docgen/source/generator.ts';
import { SourceManager } from './component-docgen/source/source-manager.ts';
import { type TagResolver, firstMatch } from './component-docgen/tag-resolver.ts';
import { errorMessage } from './component-docgen/utils.ts';

export const createDocgenProvider = ({
  manifestPaths,
  previewFilePath,
}: WebComponentsDocgenOptions): DocgenMiddleware =>
  createLazyDocgenMiddleware({
    createManager: async (): Promise<TagResolver | undefined> => {
      const sources = await loadSourceManager(previewFilePath);
      const [first, ...rest] = [
        ...(manifestPaths.length > 0 ? [new CemManager(manifestPaths)] : []),
        ...(sources ? [sources] : []),
      ];
      return first ? firstMatch([first, ...rest]) : undefined;
    },
    extract: async (resolver, input) => buildDocgenPayload(input, { resolver }),
  });

/** A failed load must not take manifest docgen down with it. */
async function loadSourceManager(previewFilePath?: string): Promise<SourceManager | undefined> {
  try {
    const [typescript, generator] = await Promise.all([import('typescript'), loadGenerator()]);
    return new SourceManager(typescript.default ?? typescript, generator, previewFilePath);
  } catch (error) {
    logger.warn(
      `Web components docgen cannot generate declarations from sources: ${errorMessage(error)}`
    );
    return undefined;
  }
}
