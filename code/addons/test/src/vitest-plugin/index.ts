/* eslint-disable no-underscore-dangle */
import type { Plugin } from 'vitest/config';

import {
  getInterpretedFile,
  loadAllPresets,
  normalizeStories,
  validateConfigurationFiles,
} from 'storybook/internal/common';
import { StoryIndexGenerator, mapStaticDir } from 'storybook/internal/core-server';
import { readConfig, vitestTransform } from 'storybook/internal/csf-tools';
import { MainFileMissingError } from 'storybook/internal/server-errors';
import type { DocsOptions, StoriesEntry } from 'storybook/internal/types';

import { join, resolve } from 'pathe';
import picocolors from 'picocolors';
import sirv from 'sirv';
import { convertPathToPattern } from 'tinyglobby';
import { dedent } from 'ts-dedent';

import { TestManager } from '../node/test-manager';
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

  if (!finalOptions.configDir) {
    finalOptions.configDir = resolve(join(process.cwd(), '.storybook'));
  } else {
    finalOptions.configDir = resolve(process.cwd(), finalOptions.configDir);
  }

  let previewLevelTags: string[];
  let storiesGlobs: StoriesEntry[];
  let storiesFiles: string[];
  const statics: ReturnType<typeof mapStaticDir>[] = [];

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
      const staticDirs = await presets.apply('staticDirs', []);

      for (const staticDir of staticDirs) {
        try {
          statics.push(mapStaticDir(staticDir, configDir));
        } catch (e) {
          console.warn(e);
        }
      }

      // If we end up needing to know if we are running in browser mode later
      // const isRunningInBrowserMode = config.plugins.find((plugin: Plugin) =>
      //   plugin.name?.startsWith('vitest:browser')
      // )

      config.test ??= {};

      if (config.test.include?.length > 0) {
        console.warn(
          picocolors.yellow(dedent`
            Warning: Starting in Storybook 8.5.0-alpha.18, the "test.include" option in Vitest is discouraged in favor of just using the "stories" field in your Storybook configuration.

            The values you passed to "test.include" will be ignored, please remove them from your Vitest configuration where the Storybook plugin is applied.
            
            More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#indexing-behavior-of-storybookexperimental-addon-test-is-changed
          `)
        );
      }

      config.test.include = storiesFiles
        .filter((path) => !path.endsWith('.mdx'))
        .map((path) => convertPathToPattern(path));

      config.test.env ??= {};
      config.test.env = {
        ...storybookEnv,
        ...config.test.env,
        // To be accessed by the setup file
        __STORYBOOK_URL__: storybookUrl,
        // We signal the test runner that we are not running it via Storybook
        // We are overriding the environment variable to 'true' if vitest runs via @storybook/addon-test's backend
        VITEST_STORYBOOK: 'false',
        __VITEST_INCLUDE_TAGS__: finalOptions.tags.include.join(','),
        __VITEST_EXCLUDE_TAGS__: finalOptions.tags.exclude.join(','),
        __VITEST_SKIP_TAGS__: finalOptions.tags.skip.join(','),
      };

      config.envPrefix = Array.from(new Set([...(config.envPrefix || []), 'STORYBOOK_', 'VITE_']));

      if (config.test.browser) {
        config.define ??= {
          ...config.define,
          // polyfilling process.env.VITEST_STORYBOOK to 'false' in the browser
          'process.env.VITEST_STORYBOOK': JSON.stringify('false'),
        };

        config.test.browser.screenshotFailures ??= false;

        config.test.browser.commands ??= {
          getInitialGlobals: () => {
            const envConfig = JSON.parse(process.env.VITEST_STORYBOOK_CONFIG ?? '{}');

            const isA11yEnabled = process.env.VITEST_STORYBOOK ? (envConfig.a11y ?? false) : true;

            return {
              a11y: {
                manual: !isA11yEnabled,
              },
            };
          },
        };
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
    configureServer(server) {
      statics.map(({ staticPath, targetEndpoint }) => {
        server.middlewares.use(
          targetEndpoint,
          sirv(staticPath, {
            dev: true,
            etag: true,
            extensions: [],
          })
        );
      });
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
