import { createRequire } from 'node:module';

import type { Plugin } from 'vitest/config';
import { mergeConfig } from 'vitest/config';
import type { ViteUserConfig } from 'vitest/config';

import {
  DEFAULT_FILES_PATTERN,
  getInterpretedFile,
  normalizeStories,
  resolvePathInStorybookCache,
  validateConfigurationFiles,
} from 'storybook/internal/common';
import type {
  experimental_loadStorybook as ExperimentalLoadStorybookType,
  mapStaticDir as MapStaticDirType,
  StoryIndexGenerator as StoryIndexGeneratorType,
} from 'storybook/internal/core-server';
import { readConfig, vitestTransform } from 'storybook/internal/csf-tools';
import { MainFileMissingError } from 'storybook/internal/server-errors';
import { telemetry } from 'storybook/internal/telemetry';
import { oneWayHash } from 'storybook/internal/telemetry';
import type { Presets } from 'storybook/internal/types';

import { match } from 'micromatch';
import { dirname, join, normalize, relative, resolve, sep } from 'pathe';
import picocolors from 'picocolors';
import sirv from 'sirv';
import { dedent } from 'ts-dedent';

// ! Relative import to prebundle it without needing to depend on the Vite builder
import { INCLUDE_CANDIDATES } from '../../../../builders/builder-vite/src/constants';
import { withoutVitePlugins } from '../../../../builders/builder-vite/src/utils/without-vite-plugins';
import type { InternalOptions, UserOptions } from './types';

const require = createRequire(import.meta.url);

// we need to require core-server here, because its ESM output is not valid

const { StoryIndexGenerator, experimental_loadStorybook, mapStaticDir } =
  require('storybook/internal/core-server') as {
    StoryIndexGenerator: typeof StoryIndexGeneratorType;
    experimental_loadStorybook: typeof ExperimentalLoadStorybookType;
    mapStaticDir: typeof MapStaticDirType;
  };

const WORKING_DIR = process.cwd();

const defaultOptions: UserOptions = {
  storybookScript: undefined,
  configDir: resolve(join(WORKING_DIR, '.storybook')),
  storybookUrl: 'http://localhost:6006',
  disableAddonDocs: true,
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

  const normalizedStories = normalizeStories(stories, {
    configDir: directories.configDir,
    workingDir: directories.workingDir,
  });

  const matchingStoryFiles = await StoryIndexGenerator.findMatchingFilesForSpecifiers(
    normalizedStories,
    directories.workingDir
  );

  return {
    storiesGlobs: stories,
    storiesFiles: StoryIndexGenerator.storyFileNames(
      new Map(matchingStoryFiles.map(([specifier, cache]) => [specifier, cache]))
    ),
  };
};

/**
 * Plugin to stub MDX imports during testing This prevents the need to process MDX files in the test
 * environment
 */
const mdxStubPlugin: Plugin = {
  name: 'storybook:stub-mdx-plugin',
  enforce: 'pre',
  resolveId(id) {
    if (id.endsWith('.mdx')) {
      return id;
    }
    return null;
  },
  load(id) {
    if (id.endsWith('.mdx')) {
      return `export default {};`;
    }
    return null;
  },
};

const PACKAGE_DIR = dirname(require.resolve('@storybook/addon-vitest/package.json'));

export const storybookTest = async (options?: UserOptions): Promise<Plugin[]> => {
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

  const stories = await presets.apply('stories', []);

  const [
    { storiesGlobs },
    framework,
    storybookEnv,
    viteConfigFromStorybook,
    staticDirs,
    previewLevelTags,
    core,
    extraOptimizeDeps,
  ] = await Promise.all([
    getStoryGlobsAndFiles(presets, directories),
    presets.apply('framework', undefined),
    presets.apply('env', {}),
    presets.apply<{ plugins?: Plugin[] }>('viteFinal', {}),
    presets.apply('staticDirs', []),
    extractTagsFromPreview(finalOptions.configDir),
    presets.apply('core'),
    presets.apply('optimizeViteDeps', []),
  ]);

  const pluginsToIgnore = [
    'storybook:react-docgen-plugin',
    'vite:react-docgen-typescript', // aka @joshwooding/vite-plugin-react-docgen-typescript
    'storybook:svelte-docgen-plugin',
    'storybook:vue-component-meta-plugin',
  ];

  if (finalOptions.disableAddonDocs) {
    pluginsToIgnore.push('storybook:package-deduplication', 'storybook:mdx-plugin');
  }

  // filter out plugins that we know are unnecesary for tests, eg. docgen plugins
  const plugins = await withoutVitePlugins(viteConfigFromStorybook.plugins ?? [], pluginsToIgnore);

  if (finalOptions.disableAddonDocs) {
    plugins.push(mdxStubPlugin);
  }

  const storybookTestPlugin: Plugin = {
    name: 'vite-plugin-storybook-test',
    async transformIndexHtml(html) {
      const [headHtmlSnippet, bodyHtmlSnippet] = await Promise.all([
        presets.apply('previewHead'),
        presets.apply('previewBody'),
      ]);

      return html
        .replace('</head>', `${headHtmlSnippet ?? ''}</head>`)
        .replace('<body>', `<body>${bodyHtmlSnippet ?? ''}`);
    },
    async config(nonMutableInputConfig) {
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
      // We are overriding the environment variable to 'true' if vitest runs via @storybook/addon-vitest's backend
      const vitestStorybook = process.env.VITEST_STORYBOOK ?? 'false';

      const testConfig = nonMutableInputConfig.test;
      finalOptions.vitestRoot =
        testConfig?.dir || testConfig?.root || nonMutableInputConfig.root || process.cwd();

      const includeStories = stories
        .map((story) => {
          let storyPath;

          if (typeof story === 'string') {
            storyPath = story;
          } else {
            storyPath = `${story.directory}/${story.files ?? DEFAULT_FILES_PATTERN}`;
          }

          return join(finalOptions.configDir, storyPath);
        })
        .map((story) => {
          return relative(finalOptions.vitestRoot, story);
        });

      finalOptions.includeStories = includeStories;
      const projectId = oneWayHash(finalOptions.configDir);

      const baseConfig: Omit<ViteUserConfig, 'plugins'> = {
        cacheDir: resolvePathInStorybookCache('sb-vitest', projectId),
        test: {
          setupFiles: [
            join(PACKAGE_DIR, 'dist/vitest-plugin/setup-file.mjs'),
            // if the existing setupFiles is a string, we have to include it otherwise we're overwriting it
            typeof nonMutableInputConfig.test?.setupFiles === 'string' &&
              nonMutableInputConfig.test?.setupFiles,
          ].filter(Boolean) as string[],

          ...(finalOptions.storybookScript
            ? {
                globalSetup: [join(PACKAGE_DIR, 'dist/vitest-plugin/global-setup.mjs')],
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

          include: includeStories,
          exclude: [
            ...(nonMutableInputConfig.test?.exclude ?? []),
            join(relative(finalOptions.vitestRoot, process.cwd()), '**/*.mdx').replaceAll(sep, '/'),
          ],

          // if the existing deps.inline is true, we keep it as-is, because it will inline everything
          ...(nonMutableInputConfig.test?.server?.deps?.inline !== true
            ? {
                server: {
                  deps: {
                    inline: ['@storybook/addon-vitest'],
                  },
                },
              }
            : {}),

          browser: {
            commands: {
              getInitialGlobals: () => {
                const envConfig = JSON.parse(process.env.VITEST_STORYBOOK_CONFIG ?? '{}');

                const shouldRunA11yTests = process.env.VITEST_STORYBOOK
                  ? (envConfig.a11y ?? false)
                  : true;

                return {
                  a11y: {
                    manual: !shouldRunA11yTests,
                  },
                };
              },
            },
            // if there is a test.browser config AND test.browser.screenshotFailures is not explicitly set, we set it to false
            ...(nonMutableInputConfig.test?.browser &&
            nonMutableInputConfig.test.browser.screenshotFailures === undefined
              ? {
                  screenshotFailures: false,
                }
              : {}),
          },
        },

        envPrefix: Array.from(
          new Set([...(nonMutableInputConfig.envPrefix || []), 'STORYBOOK_', 'VITE_'])
        ),

        resolve: {
          conditions: [
            'storybook',
            'stories',
            'test',
            // copying straight from https://github.com/vitejs/vite/blob/main/packages/vite/src/node/constants.ts#L60
            // to avoid having to maintain Vite as a dependency just for this
            'module',
            'browser',
            'development|production',
          ],
        },

        optimizeDeps: {
          include: [
            ...extraOptimizeDeps,
            ...INCLUDE_CANDIDATES,
            '@storybook/addon-vitest/internal/setup-file',
            '@storybook/addon-vitest/internal/global-setup',
            '@storybook/addon-vitest/internal/test-utils',
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
      if ((nonMutableInputConfig.test?.include?.length ?? 0) > 0) {
        // remove the user's existing include, because we're replacing it with our own heuristic based on main.ts#stories
        // @ts-expect-error: Ignore
        nonMutableInputConfig.test.include = [];
        console.log(
          picocolors.yellow(dedent`
            Warning: Starting in Storybook 8.5.0-alpha.18, the "test.include" option in Vitest is discouraged in favor of just using the "stories" field in your Storybook configuration.

            The values you passed to "test.include" will be ignored, please remove them from your Vitest configuration where the Storybook plugin is applied.
            
            More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#addon-test-indexing-behavior-of-storybookaddon-test-is-changed
          `)
        );
      }

      // return the new config, it will be deep-merged by vite
      return config;
    },
    configureVitest(context) {
      context.vitest.config.coverage.exclude.push('storybook-static');

      const disableTelemetryVar =
        process.env.STORYBOOK_DISABLE_TELEMETRY &&
        process.env.STORYBOOK_DISABLE_TELEMETRY !== 'false';
      if (!core?.disableTelemetry && !disableTelemetryVar) {
        // NOTE: we start telemetry immediately but do not wait on it. Typically it should complete
        // before the tests do. If not we may miss the event, we are OK with that.
        telemetry(
          'test-run',
          {
            runner: 'vitest',
            watch: context.vitest.config.watch,
            coverage: !!context.vitest.config.coverage?.enabled,
          },
          { configDir: finalOptions.configDir }
        );
      }
    },
    async configureServer(server) {
      if (staticDirs) {
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
      }
    },
    async transform(code, id) {
      if (process.env.VITEST !== 'true') {
        return code;
      }

      const relativeId = relative(finalOptions.vitestRoot, id);

      if (match([relativeId], finalOptions.includeStories).length > 0) {
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

  plugins.push(storybookTestPlugin);

  // When running tests via the Storybook UI, we need
  // to find the right project to run, thus we override
  // with a unique identifier using the path to the config dir
  if (process.env.VITEST_STORYBOOK) {
    const projectName = `storybook:${normalize(finalOptions.configDir)}`;
    plugins.push({
      name: 'storybook:workspace-name-override',
      config: {
        order: 'pre',
        handler: () => {
          return {
            test: {
              name: projectName,
            },
          };
        },
      },
    });
  }
  return plugins;
};

export default storybookTest;
