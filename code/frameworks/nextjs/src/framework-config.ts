import { fileURLToPath } from 'node:url';

import { getProjectRoot } from '@storybook/core/internal/common';
import { getFeatures } from '@storybook/core';
import { deprecate, logger } from '@storybook/core/internal/node-logger';
import type { Options, StorybookConfigRaw } from '@storybook/core/internal/types';

import type { ConfigItem, PluginItem, TransformOptions } from '@babel/core';
import { loadPartialConfigAsync } from '@babel/core';
import type webpack from 'webpack';
import type { Configuration as WebpackConfig } from 'webpack';

import { findBabelConfigFile } from './babel/babel-config-file.ts';
import nextBabelPreset from './babel/preset.ts';
import { configureConfig } from './config/webpack.ts';
import TransformFontImports from './font/babel/index.ts';
import { isNextVersionGte } from './utils.ts';

// Soft-deprecated in Storybook 11, removed in Storybook 12. `deprecate` warns once per process,
// so calling it at module scope is safe even when the module gets re-evaluated.
deprecate(
  '@storybook/nextjs is deprecated and will be removed in Storybook 12. Migrate to @storybook/nextjs-vite — the automigration is available via `storybook upgrade` (accept the fix) or `storybook migrate nextjs-to-nextjs-vite`.'
);

/** List the Next.js preview annotations for the installed Next.js version. */
export function getNextPreviewAnnotations(): string[] {
  const annotations = [fileURLToPath(import.meta.resolve('@storybook/nextjs/preview'))];

  // TODO: Remove this once we only support Next.js v16 and above
  if (!isNextVersionGte('16.0.0')) {
    annotations.push(fileURLToPath(import.meta.resolve('@storybook/nextjs/config/preview')));
  }

  return annotations;
}

/** Replace `next/babel` with Storybook's copy and add the Next.js font transform. */
export async function configureNextBabel(baseConfig: TransformOptions): Promise<TransformOptions> {
  const configPartial = await loadPartialConfigAsync({
    ...baseConfig,
    filename: `${getProjectRoot()}/__fake__.js`,
  });

  const options = configPartial?.options;

  const isPresetConfigItem = (preset: any): preset is ConfigItem => {
    return typeof preset === 'object' && preset !== null && 'file' in preset;
  };

  const isNextBabelConfig = (preset: PluginItem) =>
    (Array.isArray(preset) && preset[0] === 'next/babel') ||
    preset === 'next/babel' ||
    (isPresetConfigItem(preset) && preset.file?.request === 'next/babel');

  const hasNextBabelConfig = options?.presets?.find(isNextBabelConfig);

  const presets =
    options?.presets?.filter(
      (preset) =>
        !(
          (isPresetConfigItem(preset) &&
            (preset as ConfigItem).file?.request ===
              fileURLToPath(import.meta.resolve('@babel/preset-react'))) ||
          isNextBabelConfig(preset)
        )
    ) ?? [];

  if (hasNextBabelConfig) {
    if (Array.isArray(hasNextBabelConfig) && hasNextBabelConfig[1]) {
      presets.push([nextBabelPreset, hasNextBabelConfig[1]]);
    } else if (
      isPresetConfigItem(hasNextBabelConfig) &&
      hasNextBabelConfig.file?.request === 'next/babel'
    ) {
      presets.push([nextBabelPreset, hasNextBabelConfig.options]);
    } else {
      presets.push(nextBabelPreset);
    }
  } else {
    presets.push(nextBabelPreset);
  }

  const plugins = [...(options?.plugins ?? []), TransformFontImports];

  const presetConfig: Record<string, unknown> = {
    targets: {
      chrome: 100,
      safari: 15,
      firefox: 91,
    },
  };

  // We need to re-apply the default storybook babel override from:
  // https://github.com/storybookjs/storybook/blob/next/code/lib/storybook/src/storybook/server/presets/common-defaults.ts
  // Because it get lost in the loadPartialConfigAsync call above.
  // See https://github.com/storybookjs/storybook/issues/28467
  const shouldRemoveBugfixes = getFeatures().babelRemoveBugfixes;
  if (!shouldRemoveBugfixes) {
    presetConfig.bugfixes = true;
  }

  return {
    ...options,
    plugins,
    presets,
    babelrc: false,
    configFile: false,
    overrides: [
      ...(options?.overrides ?? []),
      {
        include: /(story|stories)\.[cm]?[jt]sx?$/,
        presets: [['next/dist/compiled/babel/preset-env', presetConfig]],
      },
    ],
  };
}

/** Apply the Next.js config, loaders, aliases, and compiler (SWC or Babel) to the preview config. */
export async function configureNextWebpack(
  baseConfig: WebpackConfig,
  input: {
    nextConfigPath: string | undefined;
    webpackInstance: typeof webpack;
    configType: Options['configType'];
    configDir: string;
    features: StorybookConfigRaw['features'];
    getBabelOptions: () => Promise<TransformOptions>;
    getTypescriptOptions: () => Promise<StorybookConfigRaw['typescript']>;
  }
): Promise<WebpackConfig> {
  const { webpackInstance } = input;
  const nextConfig = await configureConfig({
    baseConfig,
    nextConfigPath: input.nextConfigPath,
    webpackInstance,
  });

  // Use dynamic imports to ensure these modules that use webpack load after
  // Next.js has been configured (above), and has replaced webpack with its precompiled
  // version.
  const { configureNextFont } = await import('./font/webpack/configureNextFont.ts');
  const { configureRuntimeNextjsVersionResolution } = await import('./utils.ts');
  const { configureImports } = await import('./imports/webpack.ts');
  const { configureCss } = await import('./css/webpack.ts');
  const { configureImages } = await import('./images/webpack.ts');
  const { configureStyledJsx } = await import('./styledJsx/webpack.ts');
  const { configureNodePolyfills } = await import('./nodePolyfills/webpack.ts');
  const { configureAliases } = await import('./aliases/webpack.ts');
  const { configureFastRefresh } = await import('./fastRefresh/webpack.ts');
  const { configureRSC } = await import('./rsc/webpack.ts');
  const { configureSWCLoader } = await import('./swc/loader.ts');
  const { configureBabelLoader } = await import('./babel/loader.ts');

  const hasBabelConfig = !!findBabelConfigFile(getProjectRoot());
  const isDevelopment = input.configType !== 'PRODUCTION';

  const useSWC = nextConfig.experimental?.forceSwcTransforms || !hasBabelConfig;

  configureNextFont(baseConfig, useSWC);
  configureRuntimeNextjsVersionResolution(baseConfig);
  configureImports({ baseConfig, configDir: input.configDir });
  configureCss(baseConfig, nextConfig);
  configureImages(baseConfig, nextConfig);
  configureStyledJsx(baseConfig);
  configureNodePolyfills(baseConfig, webpackInstance);
  configureAliases(baseConfig);

  if (isDevelopment) {
    configureFastRefresh(baseConfig);
  }

  if (input.features?.experimentalRSC) {
    configureRSC(baseConfig);
  }

  if (useSWC) {
    logger.info('Using SWC as compiler');
    await configureSWCLoader(baseConfig, { configType: input.configType }, nextConfig);
  } else {
    logger.info('Using Babel as compiler');
    await configureBabelLoader(
      baseConfig,
      {
        babelOptions: await input.getBabelOptions(),
        typescriptOptions: await input.getTypescriptOptions(),
      },
      nextConfig
    );
  }

  return baseConfig;
}
