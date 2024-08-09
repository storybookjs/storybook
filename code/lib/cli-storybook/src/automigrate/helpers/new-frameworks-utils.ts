import { frameworkPackages } from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import type { Preset, StorybookConfigRaw } from 'storybook/internal/types';

import findUp from 'find-up';

import { getBuilderPackageName, getFrameworkPackageName } from './mainConfigFile';

const logger = console;

export const packagesMap: Record<string, { webpack5?: string; vite?: string }> = {
  '@storybook/react': {
    webpack5: '@storybook/react-webpack5',
    vite: '@storybook/react-vite',
  },
  '@storybook/preact': {
    webpack5: '@storybook/preact-webpack5',
    vite: '@storybook/preact-vite',
  },
  '@storybook/server': {
    webpack5: '@storybook/server-webpack5',
  },
  '@storybook/ember': {
    webpack5: '@storybook/ember',
  },
  '@storybook/angular': {
    webpack5: '@storybook/angular',
  },
  '@storybook/vue3': {
    webpack5: '@storybook/vue3-webpack5',
    vite: '@storybook/vue3-vite',
  },
  '@storybook/svelte': {
    webpack5: '@storybook/svelte-webpack5',
    vite: '@storybook/svelte-vite',
  },
  '@storybook/web-components': {
    webpack5: '@storybook/web-components-webpack5',
    vite: '@storybook/web-components-vite',
  },
  '@storybook/html': {
    webpack5: '@storybook/html-webpack5',
    vite: '@storybook/html-vite',
  },
};

const communityFrameworks: { vite: string[]; webpack5: string[] } = {
  vite: ['storybook-framework-qwik', 'storybook-solidjs-vite'],
  webpack5: [],
};

const viteConfigFiles = ['vite.config.js', 'vite.config.cjs', 'vite.config.mjs', 'vite.config.ts'];
const webpackConfigFiles = [
  'webpack.config.js',
  'webpack.config.cjs',
  'webpack.config.mjs',
  'webpack.config.ts',
];

type BuilderType = 'vite' | 'webpack5';

export const detectBuilderInfo = async ({
  mainConfig,
  configDir,
  packageManager,
}: {
  mainConfig: StorybookConfigRaw & { builder?: string | Preset };
  configDir: string;
  packageManager: JsPackageManager;
}): Promise<{ name: BuilderType; options: any }> => {
  let builderName: BuilderType;
  let builderOrFrameworkName: string | undefined;

  const { core = {}, framework } = mainConfig;
  const { builder } = core;

  const builderPackageName = getBuilderPackageName(mainConfig);
  const frameworkPackageName = getFrameworkPackageName(mainConfig) as string;

  let builderOptions = typeof builder !== 'string' ? builder?.options ?? {} : {};

  if (builderPackageName) {
    builderOrFrameworkName = builderPackageName;
  } else if (framework) {
    if (Object.keys(frameworkPackages).includes(frameworkPackageName)) {
      builderOrFrameworkName = frameworkPackageName;
      builderOptions = typeof framework === 'object' ? framework.options?.builder ?? {} : {};
    }
  }

  // if there is no builder or framework field, we look for config files instead
  if (!builderOrFrameworkName) {
    const viteConfigFile = await findUp(viteConfigFiles, { cwd: configDir });
    if (viteConfigFile) {
      logger.info(
        `No builder or framework field, detected Storybook builder via: ${viteConfigFile}`
      );
      builderOrFrameworkName = 'vite';
    } else {
      const webpackConfigFile = await findUp(webpackConfigFiles, { cwd: configDir });
      if (webpackConfigFile) {
        logger.info(
          `No builder or framework field, detected Storybook builder via: ${webpackConfigFile}`
        );
        builderOrFrameworkName = 'webpack5';
      }
    }
  }

  // if builder is still not detected, rely on package dependencies
  if (!builderOrFrameworkName) {
    const storybookBuilderViteVersion =
      await packageManager.getPackageVersion('@storybook/builder-vite');
    const storybookBuilderVite2Version =
      await packageManager.getPackageVersion('storybook-builder-vite');
    const storybookBuilderWebpack5Version = await packageManager.getPackageVersion(
      '@storybook/builder-webpack5'
    );
    const storybookBuilderManagerWebpack5Version = await packageManager.getPackageVersion(
      '@storybook/manager-webpack5'
    );

    if (storybookBuilderViteVersion || storybookBuilderVite2Version) {
      builderOrFrameworkName = 'vite';
    } else if (storybookBuilderWebpack5Version || storybookBuilderManagerWebpack5Version) {
      builderOrFrameworkName = 'webpack5';
    }
  }

  if (
    builderOrFrameworkName?.includes('vite') ||
    (builderOrFrameworkName && communityFrameworks.vite.includes(builderOrFrameworkName))
  ) {
    builderName = 'vite';
  } else if (
    builderOrFrameworkName?.includes('webpack') ||
    (builderOrFrameworkName && communityFrameworks.webpack5.includes(builderOrFrameworkName))
  ) {
    builderName = 'webpack5';
  } else {
    // we've exhausted all options, default to webpack5.
    // reason to default to webpack5 is that whoever comes from SB 6.5, if they
    // don't have a builder field or any vite config file or dependency, they are most likely using webpack5
    builderName = 'webpack5';
  }

  return {
    name: builderName,
    options: builderOptions,
  };
};

export const getNextjsAddonOptions = (addons: Preset[] | undefined) => {
  const nextjsAddon = addons?.find((addon) =>
    typeof addon === 'string'
      ? addon === 'storybook-addon-next'
      : addon.name === 'storybook-addon-next'
  );

  if (!nextjsAddon || typeof nextjsAddon === 'string') {
    return {};
  }

  return nextjsAddon.options || {};
};
