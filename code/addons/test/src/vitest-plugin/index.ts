/* eslint-disable no-underscore-dangle */
import type { Plugin } from 'vitest/config';
import { mergeConfig } from 'vitest/config';

import {
  getInterpretedFile,
  normalizeStories,
  validateConfigurationFiles,
} from 'storybook/internal/common';
import { StoryIndexGenerator, experimental_loadStorybook } from 'storybook/internal/core-server';
import { readConfig, vitestTransform } from 'storybook/internal/csf-tools';
import { MainFileMissingError } from 'storybook/internal/server-errors';
import type { DocsOptions, StoriesEntry } from 'storybook/internal/types';

import { join, resolve } from 'pathe';
import { convertPathToPattern } from 'tinyglobby';

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

export const storybookTest = async (options?: UserOptions): Promise<Plugin> => {
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

  if (!finalOptions.configDir) {
    finalOptions.configDir = resolve(join(process.cwd(), '.storybook'));
  } else {
    finalOptions.configDir = resolve(process.cwd(), finalOptions.configDir);
  }

  let previewLevelTags: string[];
  let storiesGlobs: StoriesEntry[];
  let storiesFiles: string[];

  const configDir = finalOptions.configDir;

  const storybookOptions = await experimental_loadStorybook({
    configDir,
    packageJson: {},
  });

  return {
    name: 'vite-plugin-storybook-test',
    enforce: 'pre',
    async transformIndexHtml(html) {
      const { presets } = storybookOptions;

      const headHtmlSnippet = await presets.apply<string | undefined>('previewHead');
      const bodyHtmlSnippet = await presets.apply<string | undefined>('previewBody');

      return html
        .replace('</head>', `${headHtmlSnippet ?? ''}</head>`)
        .replace('<body>', `<body>${bodyHtmlSnippet ?? ''}`);
    },
    async config(input) {
      let config = input;

      try {
        await validateConfigurationFiles(configDir);
      } catch (err) {
        throw new MainFileMissingError({
          location: configDir,
          source: 'vitest',
        });
      }

      const { presets } = storybookOptions;

      const workingDir = process.cwd();
      const directories = {
        configDir,
        workingDir,
      };
      storiesGlobs = await presets.apply('stories');
      const indexers = await presets.apply('experimental_indexers', []);
      const docsOptions = await presets.apply<DocsOptions>('docs', {});
      const normalizedStories = normalizeStories(await storiesGlobs, directories);

      const generator = new StoryIndexGenerator(normalizedStories, {
        ...directories,
        indexers: indexers,
        docs: docsOptions,
        workingDir,
      });

      await generator.initialize();

      storiesFiles = generator.storyFileNames();

      previewLevelTags = await extractTagsFromPreview(configDir);

      const framework = await presets.apply('framework', undefined);
      const frameworkName = typeof framework === 'string' ? framework : framework.name;
      const storybookEnv = await presets.apply('env', {});

      // If we end up needing to know if we are running in browser mode later
      // const isRunningInBrowserMode = config.plugins.find((plugin: Plugin) =>
      //   plugin.name?.startsWith('vitest:browser')
      // )

      const viteConfigFromStorybook = await presets.apply('viteFinal', {});
      config = mergeConfig(viteConfigFromStorybook, config);

      config.test ??= {};

      config.test.include ??= [];
      config.test.include.push(...storiesFiles.map((path) => convertPathToPattern(path)));

      config.test.exclude ??= [];
      config.test.exclude.push('**/*.mdx');

      config.test.env ??= {};
      config.test.env = {
        ...storybookEnv,
        ...config.test.env,
        // To be accessed by the setup file
        __STORYBOOK_URL__: storybookUrl,
        __VITEST_INCLUDE_TAGS__: finalOptions.tags.include.join(','),
        __VITEST_EXCLUDE_TAGS__: finalOptions.tags.exclude.join(','),
        __VITEST_SKIP_TAGS__: finalOptions.tags.skip.join(','),
      };

      config.envPrefix = Array.from(new Set([...(config.envPrefix || []), 'STORYBOOK_', 'VITE_']));

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

      if (storiesFiles.includes(id)) {
        return vitestTransform({
          code,
          fileName: id,
          configDir: finalOptions.configDir,
          tagsFilter: finalOptions.tags,
          stories: storiesGlobs,
          previewLevelTags,
        });
      }
    },
  };
};

export default storybookTest;
