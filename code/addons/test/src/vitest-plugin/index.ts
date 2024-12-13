/* eslint-disable no-underscore-dangle */
import { dirname } from 'node:path';

import type { Plugin } from 'vitest/config';
import { mergeConfig } from 'vitest/config';
import type { ViteUserConfig } from 'vitest/config';

import {
  getInterpretedFile,
  normalizeStories,
  validateConfigurationFiles,
} from 'storybook/internal/common';
import {
  StoryIndexGenerator,
  experimental_loadStorybook,
  mapStaticDir,
} from 'storybook/internal/core-server';
import { readConfig, vitestTransform } from 'storybook/internal/csf-tools';
import { MainFileMissingError } from 'storybook/internal/server-errors';
import type { Presets } from 'storybook/internal/types';

import { join, resolve } from 'pathe';
import picocolors from 'picocolors';
import sirv from 'sirv';
import { convertPathToPattern } from 'tinyglobby';
import { dedent } from 'ts-dedent';
import * as vite from 'vite';

import type { InternalOptions, UserOptions } from './types';

const WORKING_DIR = process.cwd();

const defaultOptions: UserOptions = {
  storybookScript: undefined,
  configDir: resolve(join(WORKING_DIR, '.storybook')),
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

const getStoryGlobsAndFiles = async (
  presets: Presets,
  directories: { configDir: string; workingDir: string }
) => {
  const stories = await presets.apply('stories', []);
  const docs = await presets.apply('docs', {});
  const indexers = await presets.apply('experimental_indexers', []);
  const generator = new StoryIndexGenerator(normalizeStories(stories, directories), {
    ...directories,
    indexers,
    docs,
  });
  await generator.initialize();
  return {
    storiesGlobs: stories,
    storiesFiles: generator.storyFileNames(),
  };
};

const packageDir = dirname(require.resolve('@storybook/experimental-addon-test/package.json'));

export const storybookTest = async (options?: UserOptions): Promise<Plugin> => {
  const finalOptions = {
    ...defaultOptions,
    ...options,
    configDir: options?.configDir
      ? resolve(WORKING_DIR, options.configDir)
      : defaultOptions.configDir,
    tags: {
      include: options?.tags?.include ?? ['test'],
      exclude: options?.tags?.exclude ?? [],
      skip: options?.tags?.skip ?? [],
    },
  } as InternalOptions;

  if (process.env.DEBUG) {
    finalOptions.debug = true;
  }

  // To be accessed by the global setup file
  process.env.__STORYBOOK_URL__ = finalOptions.storybookUrl;
  process.env.__STORYBOOK_SCRIPT__ = finalOptions.storybookScript;

  const directories = {
    configDir: finalOptions.configDir,
    workingDir: WORKING_DIR,
  };

  const { presets } = await experimental_loadStorybook({
    configDir: finalOptions.configDir,
    packageJson: {},
  });

  const [
    { storiesGlobs, storiesFiles },
    framework,
    storybookEnv,
    viteConfigFromStorybook,
    staticDirs,
    previewLevelTags,
  ] = await Promise.all([
    getStoryGlobsAndFiles(presets, directories),
    presets.apply('framework', undefined),
    presets.apply('env', {}),
    presets.apply('viteFinal', {}),
    presets.apply('staticDirs', []),
    extractTagsFromPreview(finalOptions.configDir),
  ]);

  return {
    name: 'vite-plugin-storybook-test',
    enforce: 'pre',
    async transformIndexHtml(html) {
      const [headHtmlSnippet, bodyHtmlSnippet] = await Promise.all([
        presets.apply('previewHead'),
        presets.apply('previewBody'),
      ]);

      return html
        .replace('</head>', `${headHtmlSnippet ?? ''}</head>`)
        .replace('<body>', `<body>${bodyHtmlSnippet ?? ''}`);
    },
    async config(inputConfig_ONLY_MUTATE_WHEN_STRICTLY_NEEDED_OR_YOU_WILL_BE_FIRED) {
      // ! We're not mutating the input config, instead we're returning a new partial config
      // ! see https://vite.dev/guide/api-plugin.html#config
      try {
        await validateConfigurationFiles(finalOptions.configDir);
      } catch (err) {
        throw new MainFileMissingError({
          location: finalOptions.configDir,
          source: 'vitest',
        });
      }

      const frameworkName = typeof framework === 'string' ? framework : framework.name;

      // If we end up needing to know if we are running in browser mode later
      // const isRunningInBrowserMode = config.plugins.find((plugin: Plugin) =>
      //   plugin.name?.startsWith('vitest:browser')
      // )

      // We signal the test runner that we are not running it via Storybook
      // We are overriding the environment variable to 'true' if vitest runs via @storybook/addon-test's backend
      const vitestStorybook = process.env.VITEST_STORYBOOK ?? 'false';

      const baseConfig: Omit<ViteUserConfig, 'plugins'> = {
        test: {
          setupFiles: [
            join(packageDir, 'dist/vitest-plugin/setup-file.mjs'),
            // if the existing setupFiles is a string, we have to include it otherwise we're overwriting it
            typeof inputConfig_ONLY_MUTATE_WHEN_STRICTLY_NEEDED_OR_YOU_WILL_BE_FIRED.test
              ?.setupFiles === 'string' &&
              inputConfig_ONLY_MUTATE_WHEN_STRICTLY_NEEDED_OR_YOU_WILL_BE_FIRED.test?.setupFiles,
          ].filter(Boolean) as string[],

          ...(finalOptions.storybookScript
            ? {
                globalSetup: [join(packageDir, 'dist/vitest-plugin/global-setup.mjs')],
              }
            : {}),

          env: {
            ...storybookEnv,
            // To be accessed by the setup file
            __STORYBOOK_URL__: finalOptions.storybookUrl,

            VITEST_STORYBOOK: vitestStorybook,
            __VITEST_INCLUDE_TAGS__: finalOptions.tags.include.join(','),
            __VITEST_EXCLUDE_TAGS__: finalOptions.tags.exclude.join(','),
            __VITEST_SKIP_TAGS__: finalOptions.tags.skip.join(','),
          },

          include: storiesFiles
            .filter((path) => !path.endsWith('.mdx'))
            .map((path) => convertPathToPattern(path)),

          // if the existing deps.inline is true, we keep it as-is, because it will inline everything
          ...(inputConfig_ONLY_MUTATE_WHEN_STRICTLY_NEEDED_OR_YOU_WILL_BE_FIRED.test?.server?.deps
            ?.inline !== true
            ? {
                server: {
                  deps: {
                    inline: ['@storybook/experimental-addon-test'],
                  },
                },
              }
            : {}),

          browser: {
            ...inputConfig_ONLY_MUTATE_WHEN_STRICTLY_NEEDED_OR_YOU_WILL_BE_FIRED.test?.browser,
            commands: {
              getInitialGlobals: () => {
                const envConfig = JSON.parse(process.env.VITEST_STORYBOOK_CONFIG ?? '{}');

                const isA11yEnabled = process.env.VITEST_STORYBOOK
                  ? (envConfig.a11y ?? false)
                  : true;

                return {
                  a11y: {
                    manual: !isA11yEnabled,
                  },
                };
              },
            },
            // if there is a test.browser config AND test.browser.screenshotFailures is not explicitly set, we set it to false
            ...(inputConfig_ONLY_MUTATE_WHEN_STRICTLY_NEEDED_OR_YOU_WILL_BE_FIRED.test?.browser &&
            inputConfig_ONLY_MUTATE_WHEN_STRICTLY_NEEDED_OR_YOU_WILL_BE_FIRED.test.browser
              .screenshotFailures === undefined
              ? {
                  screenshotFailures: false,
                }
              : {}),
          },
        },

        envPrefix: Array.from(
          new Set([
            ...(inputConfig_ONLY_MUTATE_WHEN_STRICTLY_NEEDED_OR_YOU_WILL_BE_FIRED.envPrefix || []),
            'STORYBOOK_',
            'VITE_',
          ])
        ),

        resolve: {
          conditions: [
            'storybook',
            'stories',
            'test',
            // In Vite 6+ we have to manually add defaultClientConditions when setting custom conditions
            // In Vite 4/5 we should NOT add defaultClientConditions, they will already be there
            //@ts-expect-error defaultClientConditions is a Vite 6 only export, but we're using Vite 4
            ...(vite.defaultClientConditions ?? []),
          ],
        },

        optimizeDeps: {
          include: [
            '@storybook/experimental-addon-test/**',
            ...(frameworkName?.includes('react') || frameworkName?.includes('nextjs')
              ? ['react-dom/test-utils']
              : []),
          ],
        },

        define: {
          ...(frameworkName?.includes('vue3')
            ? { __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' }
            : {}),
        },
      };

      // Merge config from storybook with the plugin config
      const config: Omit<ViteUserConfig, 'plugins'> = mergeConfig(
        baseConfig,
        viteConfigFromStorybook
      );

      // alert the user of problems
      if (
        inputConfig_ONLY_MUTATE_WHEN_STRICTLY_NEEDED_OR_YOU_WILL_BE_FIRED.test.include?.length > 0
      ) {
        // remove the user's existing include, because we're replacing it with our own heuristic based on main.ts#stories
        inputConfig_ONLY_MUTATE_WHEN_STRICTLY_NEEDED_OR_YOU_WILL_BE_FIRED.test.include = [];
        console.log(
          picocolors.yellow(dedent`
            Warning: Starting in Storybook 8.5.0-alpha.18, the "test.include" option in Vitest is discouraged in favor of just using the "stories" field in your Storybook configuration.

            The values you passed to "test.include" will be ignored, please remove them from your Vitest configuration where the Storybook plugin is applied.
            
            More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#indexing-behavior-of-storybookexperimental-addon-test-is-changed
          `)
        );
      }

      // return the new config, it will be deep-merged by vite
      return config;
    },
    async configureServer(server) {
      for (const staticDir of staticDirs) {
        try {
          const { staticPath, targetEndpoint } = mapStaticDir(staticDir, directories.configDir);
          server.middlewares.use(
            targetEndpoint,
            sirv(staticPath, {
              dev: true,
              etag: true,
              extensions: [],
            })
          );
        } catch (e) {
          console.warn(e);
        }
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
