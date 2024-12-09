/* eslint-disable no-underscore-dangle */
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
import type { DocsOptions, StoriesEntry } from 'storybook/internal/types';

import { join, resolve } from 'pathe';
import picocolors from 'picocolors';
import sirv from 'sirv';
import { convertPathToPattern } from 'tinyglobby';
import { dedent } from 'ts-dedent';

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

  const workingDir = process.cwd();

  finalOptions.configDir = finalOptions.configDir
    ? resolve(workingDir, finalOptions.configDir)
    : resolve(join(workingDir, '.storybook'));

  const directories = {
    configDir: finalOptions.configDir,
    workingDir,
  };

  let previewLevelTags: string[];
  let storiesGlobs: StoriesEntry[];
  let storiesFiles: string[];

  const storybookOptions = await experimental_loadStorybook({
    configDir: finalOptions.configDir,
    packageJson: {},
  });

  return {
    name: 'vite-plugin-storybook-test',
    enforce: 'pre',
    async transformIndexHtml(html) {
      const { presets } = storybookOptions;

      const [headHtmlSnippet, bodyHtmlSnippet] = await Promise.all([
        presets.apply('previewHead'),
        presets.apply('previewBody'),
      ]);

      return html
        .replace('</head>', `${headHtmlSnippet ?? ''}</head>`)
        .replace('<body>', `<body>${bodyHtmlSnippet ?? ''}`);
    },
    async config(input) {
      try {
        await validateConfigurationFiles(finalOptions.configDir);
      } catch (err) {
        throw new MainFileMissingError({
          location: finalOptions.configDir,
          source: 'vitest',
        });
      }

      const { presets } = storybookOptions;

      // performance optimization: load all in parallel
      const [
        //
        framework,
        storiesGlobsData,
        indexers,
        docsOptions,
        storybookEnv,
        viteConfigFromStorybook,
        previewLevelTagsData,
      ] = await Promise.all([
        //
        presets.apply('framework', undefined),
        presets.apply('stories'),
        presets.apply('experimental_indexers', []),
        presets.apply<DocsOptions>('docs', {}),
        presets.apply('env', {}),
        presets.apply('viteFinal', {}),

        extractTagsFromPreview(finalOptions.configDir),
      ]);

      const generator = new StoryIndexGenerator(normalizeStories(storiesGlobsData, directories), {
        ...directories,
        indexers: indexers,
        docs: docsOptions,
      });

      await generator.initialize();

      storiesGlobs = storiesGlobsData;
      storiesFiles = generator.storyFileNames();
      previewLevelTags = previewLevelTagsData;

      const frameworkName = typeof framework === 'string' ? framework : framework.name;

      // If we end up needing to know if we are running in browser mode later
      // const isRunningInBrowserMode = config.plugins.find((plugin: Plugin) =>
      //   plugin.name?.startsWith('vitest:browser')
      // )

      const baseConfig: Omit<ViteUserConfig, 'plugins'> = {
        test: {
          setupFiles: ['@storybook/experimental-addon-test/internal/setup-file'],

          ...(finalOptions.storybookScript
            ? {
                globalSetup: ['@storybook/experimental-addon-test/internal/global-setup'],
              }
            : {}),

          env: {
            ...storybookEnv,
            // To be accessed by the setup file
            __STORYBOOK_URL__: storybookUrl,
            __VITEST_INCLUDE_TAGS__: finalOptions.tags.include.join(','),
            __VITEST_EXCLUDE_TAGS__: finalOptions.tags.exclude.join(','),
            __VITEST_SKIP_TAGS__: finalOptions.tags.skip.join(','),
          },

          include: storiesFiles
            .filter((path) => !path.endsWith('.mdx'))
            .map((path) => convertPathToPattern(path)),

          server: {
            deps: {
              inline: ['@storybook/experimental-addon-test'],
            },
          },

          ...(input.test.browser
            ? {
                browser: {
                  name: input.test.browser.name,
                  screenshotFailures: input.test.browser?.screenshotFailures ?? false,
                },
              }
            : {}),
        },

        envPrefix: ['STORYBOOK_', 'VITE_'],

        // copying straight from https://github.com/vitejs/vite/blob/main/packages/vite/src/node/constants.ts#L60
        // to avoid having to maintain Vite as a dependency just for this
        resolve: {
          conditions: [
            'storybook',
            'stories',
            'test',
            'module',
            'browser',
            'development|production',
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
      if (config.test.include?.length > 0) {
        console.warn(
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
      const { presets } = storybookOptions;
      const statics: ReturnType<typeof mapStaticDir>[] = [];
      const staticDirs = await presets.apply('staticDirs', []);

      for (const staticDir of staticDirs) {
        try {
          statics.push(mapStaticDir(staticDir, directories.configDir));
        } catch (e) {
          console.warn(e);
        }
      }

      statics.forEach(({ staticPath, targetEndpoint }) => {
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
