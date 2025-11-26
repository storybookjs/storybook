import { babelParser, getAutomockCode } from 'storybook/internal/mocking-utils';

import type { LoaderContext } from 'webpack';

/** Defines the options that can be passed to the webpack-automock-loader. */
interface AutomockLoaderOptions {
  /**
   * If true, the module will be spied upon instead of fully mocked. This retains the original
   * implementation while tracking calls.
   */
  spy: string;
}

/**
 * A Webpack loader that transforms a module's source code into an automocked version. It uses
 * `@vitest/mocker`'s `automockModule` function to replace all exports with mock implementations or
 * spies.
 *
 * This loader is intended to be used by `WebpackMockPlugin` when no `__mocks__` file is found for a
 * module specified in `sb.mock()`.
 *
 * @param {string} source The original source code of the module.
 * @this {LoaderContext<AutomockLoaderOptions>} The Webpack loader context.
 */
export default function webpackAutomockLoader(
  this: LoaderContext<AutomockLoaderOptions>,
  source: string
) {
  // Retrieve the options passed in the resource query string (e.g., `?spy=true`).
  const options = this.getOptions();
  const isSpy = options.spy === 'true';

  // Generate the mocked source code using the utility from @vitest/mocker.
  const mocked = getAutomockCode(source, isSpy, babelParser as any);

  // Return the transformed code to Webpack for further processing.
  return mocked.toString();
}
