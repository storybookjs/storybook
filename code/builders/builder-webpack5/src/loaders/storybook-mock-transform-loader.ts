import { rewriteSbMockImportCalls } from 'storybook/internal/mocking-utils';
import { logger } from 'storybook/internal/node-logger';

import type { LoaderDefinition } from 'webpack';

/**
 * A Webpack loader that normalize sb.mock(import(...)) calls to sb.mock(...)
 *
 * @this The Webpack loader context.
 * @param source The original source code of the preview config file.
 */
const storybookMockTransformLoader: LoaderDefinition = function mockTransformLoaderFn(
  source,
  sourceMap,
  meta
) {
  const callback = this.async();

  try {
    const result = rewriteSbMockImportCalls(source, this.resourcePath, {
      inputSourceMap: sourceMap,
    });
    // webpack types `sourcesContent` as `string[]`, but accepts the `null` entry of a source whose
    // content the incoming map did not carry.
    const map = result.map as Exclude<typeof sourceMap, string | undefined> | null;
    callback(null, result.code, map ?? sourceMap, meta);
  } catch (error) {
    const filePath = this.resourcePath;
    logger.debug(`Could not transform sb.mock(import(...)) calls in ${filePath}: ${error}`);
    callback(null, source, sourceMap, meta);
  }
};

export default storybookMockTransformLoader;
