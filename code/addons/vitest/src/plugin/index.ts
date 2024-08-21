/* eslint-disable no-underscore-dangle */
import { join, resolve } from 'node:path';

import type { Plugin } from 'vitest/config';

import {
  getInterpretedFile,
  loadAllPresets,
  validateConfigurationFiles,
} from 'storybook/internal/common';
import { readConfig, vitestTransform } from 'storybook/internal/csf-tools';
import { MainFileMissingError } from 'storybook/internal/server-errors';
import type { StoriesEntry } from 'storybook/internal/types';

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
    async buildStart() {
      // evaluate main.js and preview.js so we can extract
      // stories for autotitle support and tags for tags filtering support
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
    },
    async config(config) {
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
      };

      if (config.test.browser) {
        config.test.browser.screenshotFailures ??= false;
      }

      config.resolve ??= {};
      config.resolve.conditions ??= [];
      config.resolve.conditions.push('storybook', 'stories', 'test');

      config.test.setupFiles ??= [];
      if (typeof config.test.setupFiles === 'string') {
        config.test.setupFiles = [config.test.setupFiles];
      }
      config.test.setupFiles.push('@storybook/experimental-addon-vitest/internal/setup-file');

      // when a Storybook script is provided, we spawn Storybook for the user when in watch mode
      if (finalOptions.storybookScript) {
        config.test.globalSetup = config.test.globalSetup ?? [];
        if (typeof config.test.globalSetup === 'string') {
          config.test.globalSetup = [config.test.globalSetup];
        }
        config.test.globalSetup.push('@storybook/experimental-addon-vitest/internal/global-setup');
      }

      config.test.server ??= {};
      config.test.server.deps ??= {};
      config.test.server.deps.inline ??= [];
      if (Array.isArray(config.test.server.deps.inline)) {
        config.test.server.deps.inline.push('@storybook/experimental-addon-vitest');
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
