import { join } from 'node:path';

import { buildSync } from 'esbuild';
// HtmlWebpackPlugin is a standard part of Storybook's Webpack setup.
// We can assume it's available as a dependency.
import type HtmlWebpackPlugin from 'html-webpack-plugin';
import type { Compiler } from 'webpack';

import { resolvePackageDir } from '../../../../shared/utils/module';

const PLUGIN_NAME = 'WebpackInjectMockerRuntimePlugin';

/**
 * A Webpack plugin that injects the module mocker runtime script into the preview iframe's HTML.
 * This ensures the `sb` object is available globally before any other scripts, includiweng the
 * Storybook preview bundle, are executed.
 */
export class WebpackInjectMockerRuntimePlugin {
  // We need to lazy-require HtmlWebpackPlugin because it's an optional peer dependency.
  private getHtmlWebpackPlugin(compiler: Compiler): typeof HtmlWebpackPlugin | null {
    try {
      // It's better to get the constructor directly from the compiler's plugins
      // to ensure we're using the same instance.
      const constructor = compiler.options.plugins.find(
        (p) => p?.constructor?.name === 'HtmlWebpackPlugin'
      )?.constructor;

      if (!constructor) {
        return require('html-webpack-plugin');
      }
      return constructor as typeof HtmlWebpackPlugin;
    } catch (e) {
      compiler
        .getInfrastructureLogger(PLUGIN_NAME)
        .warn('html-webpack-plugin is not installed. Cannot inject mocker runtime.');
      return null;
    }
  }

  /**
   * The main entry point for the Webpack plugin.
   *
   * @param {Compiler} compiler The Webpack compiler instance.
   */
  public apply(compiler: Compiler): void {
    const HtmlWebpackPlugin = this.getHtmlWebpackPlugin(compiler);
    if (!HtmlWebpackPlugin) {
      return;
    }

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      // Hook into HtmlWebpackPlugin's process to modify the generated HTML asset tags.
      // The hook is static and should be available as soon as the compilation starts.
      HtmlWebpackPlugin.getHooks(compilation).beforeAssetTagGeneration.tapAsync(
        PLUGIN_NAME,
        (data, cb) => {
          try {
            // The runtime template is the same for both dev and build in the final implementation,
            // as all mocking logic is handled at build time or by the dev server's transform.
            const runtimeTemplatePath = join(
              resolvePackageDir('storybook'),
              'assets',
              'server',
              'mocker-runtime.template.js'
            );
            // Use esbuild to bundle the runtime script and its dependencies (`@vitest/mocker`, etc.)
            // into a single, self-contained string of code.
            const bundleResult = buildSync({
              entryPoints: [runtimeTemplatePath],
              bundle: true,
              write: false, // Return the result in memory instead of writing to disk
              format: 'esm',
              target: 'es2020',
              external: ['msw/browser', 'msw/core/http'],
            });

            const runtimeScriptContent = bundleResult.outputFiles[0].text;
            const runtimeAssetName = 'mocker-runtime-injected.js';

            // Use the documented `emitAsset` method to add the pre-bundled runtime script
            // to the compilation's assets. This is the standard Webpack way.
            compilation.emitAsset(
              runtimeAssetName,
              new compiler.webpack.sources.RawSource(runtimeScriptContent)
            );

            // Prepend the name of our new asset to the list of JavaScript files.
            // HtmlWebpackPlugin will automatically create a <script> tag for it
            // and place it at the beginning of the body scripts.
            data.assets.js.unshift(runtimeAssetName);
            cb(null, data);
          } catch (error) {
            // In case of an error (e.g., file not found), pass it to Webpack's compilation.
            cb(error as Error);
          }
        }
      );
    });
  }
}
