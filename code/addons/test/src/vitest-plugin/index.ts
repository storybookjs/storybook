/* eslint-disable no-underscore-dangle */
import type { Plugin } from 'vitest/config';

import {
  getInterpretedFile,
  loadAllPresets,
  validateConfigurationFiles,
} from 'storybook/internal/common';
import { readConfig, vitestTransform } from 'storybook/internal/csf-tools';
import { MainFileMissingError } from 'storybook/internal/server-errors';
import type { StoriesEntry } from 'storybook/internal/types';

import { join, resolve } from 'pathe';

import type { InternalOptions, UserOptions } from './types';

const defaultOptions: UserOptions = {
  storybookScript: undefined,
  configDir: undefined,
  storybookUrl: 'http://localhost:6006',
};

const extractTagsFromPreview = async (configDir: string) => {
  const previewConfigPath = getInterpretedFile(join(resolve(configDir), 'preview'));

  if (!previewConfigPath) {
    return [];
  }
  const previewConfig = await readConfig(previewConfigPath);
  return previewConfig.getFieldValue(['tags']) ?? [];
};

export const storybookTest = (options?: UserOptions): Plugin => {
  const finalOptions = {
    ...defaultOptions,
    ...options,
    tags: {
      include: options?.tags?.include ?? ['test'],
      exclude: options?.tags?.exclude ?? [],
      skip: options?.tags?.skip ?? [],
    },
  } as InternalOptions;

  if (process.env.DEBUG) {
    finalOptions.debug = true;
  }

  const storybookUrl = finalOptions.storybookUrl || defaultOptions.storybookUrl;

  // To be accessed by the global setup file
  process.env.__STORYBOOK_URL__ = storybookUrl;
  process.env.__STORYBOOK_SCRIPT__ = finalOptions.storybookScript;

  let stories: StoriesEntry[];

  if (!finalOptions.configDir) {
    finalOptions.configDir = resolve(join(process.cwd(), '.storybook'));
  } else {
    finalOptions.configDir = resolve(process.cwd(), finalOptions.configDir);
  }

  let previewLevelTags: string[];

  return {
    name: 'vite-plugin-storybook-test',
    enforce: 'pre',
    async config(config) {
      const configDir = finalOptions.configDir;
      try {
        await validateConfigurationFiles(configDir);
      } catch (err) {
        throw new MainFileMissingError({
          location: configDir,
          source: 'vitest',
        });
      }

      const presets = await loadAllPresets({
        configDir,
        corePresets: [],
        overridePresets: [],
        packageJson: {},
      });

      stories = await presets.apply('stories', []);
      previewLevelTags = await extractTagsFromPreview(configDir);

      const framework = await presets.apply('framework', undefined);
      const frameworkName = typeof framework === 'string' ? framework : framework.name;

      // If we end up needing to know if we are running in browser mode later
      // const isRunningInBrowserMode = config.plugins.find((plugin: Plugin) =>
      //   plugin.name?.startsWith('vitest:browser')
      // )
      config.test ??= {};

      config.test.env ??= {};
      config.test.env = {
        ...config.test.env,
        // To be accessed by the setup file
        __STORYBOOK_URL__: storybookUrl,
        __VITEST_INCLUDE_TAGS__: finalOptions.tags.include.join(','),
        __VITEST_EXCLUDE_TAGS__: finalOptions.tags.exclude.join(','),
        __VITEST_SKIP_TAGS__: finalOptions.tags.skip.join(','),
      };

      if (config.test.browser) {
        config.test.browser.screenshotFailures ??= false;
      }

      // copying straight from https://github.com/vitejs/vite/blob/main/packages/vite/src/node/constants.ts#L60
      // to avoid having to maintain Vite as a dependency just for this
      const viteDefaultClientConditions = ['module', 'browser', 'development|production'];

      config.resolve ??= {};
      config.resolve.conditions ??= [];
      config.resolve.conditions.push(
        'storybook',
        'stories',
        'test',
        ...viteDefaultClientConditions
      );

      config.test.setupFiles ??= [];
      if (typeof config.test.setupFiles === 'string') {
        config.test.setupFiles = [config.test.setupFiles];
      }
      config.test.setupFiles.push('@storybook/experimental-addon-test/internal/setup-file');

      // when a Storybook script is provided, we spawn Storybook for the user when in watch mode
      if (finalOptions.storybookScript) {
        config.test.globalSetup = config.test.globalSetup ?? [];
        if (typeof config.test.globalSetup === 'string') {
          config.test.globalSetup = [config.test.globalSetup];
        }
        config.test.globalSetup.push('@storybook/experimental-addon-test/internal/global-setup');
      }

      config.test.server ??= {};
      config.test.server.deps ??= {};
      config.test.server.deps.inline ??= [];
      if (Array.isArray(config.test.server.deps.inline)) {
        config.test.server.deps.inline.push('@storybook/experimental-addon-test');
      }

      config.optimizeDeps ??= {};
      config.optimizeDeps = {
        ...config.optimizeDeps,
        include: [...(config.optimizeDeps.include ?? []), '@storybook/experimental-addon-test/**'],
      };

      if (frameworkName?.includes('react') || frameworkName?.includes('nextjs')) {
        config.optimizeDeps.include.push('react-dom/test-utils');
      }

      if (frameworkName?.includes('vue3')) {
        config.define ??= {};
        config.define.__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = 'false';
      }
    },
    async transform(code, id) {
      if (process.env.VITEST !== 'true') {
        return code;
      }

      if (id.match(/(story|stories)\.[cm]?[jt]sx?$/)) {
        return vitestTransform({
          code,
          fileName: id,
          configDir: finalOptions.configDir,
          tagsFilter: finalOptions.tags,
          stories,
          previewLevelTags,
        });
      }
    },
  };
};

export default storybookTest;
