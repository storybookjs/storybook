// https://storybook.js.org/docs/react/addons/writing-presets
import { fileURLToPath } from 'node:url';

import { deprecate, once } from 'storybook/internal/node-logger';
import type { PresetProperty } from 'storybook/internal/types';

import { babelConfigWarning } from './babel-config-warning.ts';
import { configureConfig } from './config/webpack.ts';
import type { FrameworkOptions, StorybookConfig } from './types.ts';
import { getNextConfigDir, isNextVersionGte, resolveNextConfig } from './utils.ts';

// Soft-deprecated in Storybook 11, removed in Storybook 12. `deprecate` warns once per process,
// so calling it at module scope is safe even when the preset module gets re-evaluated.
deprecate(
  '@storybook/nextjs is deprecated and will be removed in Storybook 12. Migrate to @storybook/nextjs-vite — the automigration is available via `storybook upgrade` (accept the fix) or `storybook migrate nextjs-to-nextjs-vite`.'
);

export const addons: PresetProperty<'addons'> = [
  fileURLToPath(import.meta.resolve('@storybook/preset-react-webpack')),
];

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply<StorybookConfig['framework']>('framework');

  // Load the Next.js configuration before we need it in webpackFinal (below).
  // This gives Next.js an opportunity to override some of webpack's internals
  // (see next/dist/server/config-utils.js) before @storybook/builder-webpack5
  // starts to use it. Without this, webpack's file system cache (fsCache: true)
  // does not work.
  await resolveNextConfig({
    nextConfigPath: typeof framework === 'string' ? undefined : framework.options.nextConfigPath,
  });

  return {
    ...config,
    builder: {
      name: fileURLToPath(import.meta.resolve('@storybook/builder-webpack5')),
      options: {
        ...(typeof framework === 'string' ? {} : framework.options.builder || {}),
      },
    },
    renderer: fileURLToPath(import.meta.resolve('@storybook/react/preset')),
  };
};

export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entry = []) => {
  const annotations = [...entry, fileURLToPath(import.meta.resolve('@storybook/nextjs/preview'))];

  const isNext16orNewer = isNextVersionGte('16.0.0');

  // TODO: Remove this once we only support Next.js v16 and above
  if (!isNext16orNewer) {
    annotations.push(fileURLToPath(import.meta.resolve('@storybook/nextjs/config/preview')));
  }

  return annotations;
};

export const webpackFinal: StorybookConfig['webpackFinal'] = async (baseConfig, options) => {
  const { nextConfigPath } = await options.presets.apply<FrameworkOptions>('frameworkOptions');
  const { executor } = await import('@storybook/builder-webpack5');
  const webpackInstance = await executor.get(options);
  const nextConfig = await configureConfig({
    baseConfig,
    nextConfigPath,
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

  const babelWarning = babelConfigWarning(getNextConfigDir(nextConfigPath), nextConfig);
  if (babelWarning) {
    once.warn(babelWarning);
  }

  const isDevelopment = options.configType !== 'PRODUCTION';

  configureNextFont(baseConfig);
  configureRuntimeNextjsVersionResolution(baseConfig);
  configureImports({ baseConfig, configDir: options.configDir });
  configureCss(baseConfig, nextConfig);
  configureImages(baseConfig, nextConfig);
  configureStyledJsx(baseConfig);
  configureNodePolyfills(baseConfig, webpackInstance);
  configureAliases(baseConfig);

  if (isDevelopment) {
    configureFastRefresh(baseConfig);
  }

  if (options.features?.experimentalRSC) {
    configureRSC(baseConfig);
  }

  await configureSWCLoader(baseConfig, options, nextConfig);

  return baseConfig;
};
