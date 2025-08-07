import { logger } from 'storybook/internal/node-logger';

import type { LoaderDefinition } from 'webpack';

import { rewriteSbMockImportCalls } from '../../../mocking-utils/extract';

/**
 * A Webpack loader that normalize sb.mock(import(...)) calls to sb.mock(...)
 *
 * @param source The original source code of the preview config file.
 * @this The Webpack loader context.
 */
const storybookMockTransformLoader: LoaderDefinition = function mockTransformLoaderFn(
  source,
  sourceMap,
  meta
) {
  const callback = this.async();

  try {
    const result = rewriteSbMockImportCalls(source);
    callback(null, result.code, result.map || undefined, meta);
  } catch (error) {
    const filePath = this.resourcePath;
    logger.debug(`Could not transform sb.mock(import(...)) calls in ${filePath}: ${error}`);
    callback(null, source, sourceMap, meta);
  }
};

export default storybookMockTransformLoader;
