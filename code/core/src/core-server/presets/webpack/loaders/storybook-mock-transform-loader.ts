import type { LoaderContext } from 'webpack';

import { rewriteSbMockImportCalls } from '../../../mocking-utils/extract';

/**
 * A Webpack loader that normalize sb.mock(import(...)) calls to sb.mock(...)
 *
 * @param {string} source The original source code of the preview config file.
 * @this {LoaderContext<{}>} The Webpack loader context.
 */
export default function storybookMockTransformLoader(this: LoaderContext<{}>, source: string) {
  const result = rewriteSbMockImportCalls(source);
  const callback = this.async();
  callback(null, result.code, result.map || undefined);
}
