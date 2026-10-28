import { getMockerRuntime } from '@storybook/core/internal/mocking-utils';

import type { Compiler } from 'webpack';

const PLUGIN_NAME = 'WebpackInjectMockerRuntimePlugin';

/** Emit the module mocker runtime that the preview page loads before any other script. */
export class WebpackInjectMockerRuntimePlugin {
  private cachedRuntime: string | null = null;

  constructor(private readonly assetName: string) {}

  public apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: PLUGIN_NAME, stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
        () => {
          this.cachedRuntime ??= getMockerRuntime();
          compilation.emitAsset(
            this.assetName,
            new compiler.webpack.sources.RawSource(this.cachedRuntime)
          );
        }
      );
    });
  }
}
