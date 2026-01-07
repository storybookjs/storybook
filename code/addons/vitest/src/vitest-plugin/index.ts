import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vitest/config';
import { mergeConfig } from 'vitest/config';
import type { ViteUserConfig } from 'vitest/config';

import {
  DEFAULT_FILES_PATTERN,
  getInterpretedFile,
  normalizeStories,
  optionalEnvToBoolean,
  resolvePathInStorybookCache,
  validateConfigurationFiles,
} from 'storybook/internal/common';
import {
  StoryIndexGenerator,
  experimental_loadStorybook,
  mapStaticDir,
} from 'storybook/internal/core-server';
import { componentTransform, readConfig, vitestTransform } from 'storybook/internal/csf-tools';
import { MainFileMissingError } from 'storybook/internal/server-errors';
import { telemetry } from 'storybook/internal/telemetry';
import { oneWayHash } from 'storybook/internal/telemetry';
import type { Presets } from 'storybook/internal/types';

import { match } from 'micromatch';
import { join, normalize, relative, resolve, sep } from 'pathe';
import picocolors from 'picocolors';
import sirv from 'sirv';
import { dedent } from 'ts-dedent';

// ! Relative import to prebundle it without needing to depend on the Vite builder
import { withoutVitePlugins } from '../../../../builders/builder-vite/src/utils/without-vite-plugins';
import type { InternalOptions, UserOptions } from './types';

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

// Transforming components and extracting args can be expensive
// so we pass the paths via env variable and use as filter
const getComponentTestPaths = (vitestRoot: string): string[] => {
  const envPaths = process.env.STORYBOOK_COMPONENT_PATHS;

  if (!envPaths) {
    return [];
  }

  const path = require('path');
  return (
    envPaths
      .split(';')
      .filter(Boolean)
      // TODO: check whether this is actually needed
      .map((p) => path.relative(vitestRoot, path.resolve(process.cwd(), p)))
  );
};

const createComponentTestTransformPlugin = (presets: Presets, configDir: string): Plugin => {
  let vitestRoot: string;
  let storybookComponentTestPaths: string[] = [];

  console.log('🚨');
  return {
    name: 'storybook:component-test-transform-plugin',
    enforce: 'pre',
    async config(config) {
      console.log('🚨🚨');
      vitestRoot = config.test?.dir || config.test?.root || config.root || process.cwd();
      storybookComponentTestPaths = getComponentTestPaths(vitestRoot);
      console.log({ storybookComponentTestPaths });
    },
    async transform(code, id) {
      if (!optionalEnvToBoolean(process.env.VITEST)) {
        return code;
      }

      if (id.includes('.stories') || id.includes('dist') || id.includes('node_modules')) {
        return code;
      }

      // If STORYBOOK_COMPONENT_PATHS env is set, filter on that
      if (storybookComponentTestPaths.length > 0) {
        const path = require('path');
        const resolvedId = path.resolve(id);
        const matches = storybookComponentTestPaths.some(
          (testPath) =>
            resolvedId === testPath ||
            resolvedId.startsWith(testPath + path.sep) ||
            resolvedId.endsWith(testPath)
        );
        if (!matches) {
          return code;
        }
      }
      const result = await componentTransform({
        code,
        fileName: id,
        getComponentArgTypes: async ({ componentName, fileName }) =>
          presets.apply('experimental_getArgTypesData', null, {
            componentFilePath: fileName,
            componentExportName: componentName,
            configDir,
          }),
      });

      console.log('RESULT', id, result.code);
      return result.code;
    },
  };
};

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

  if (optionalEnvToBoolean(process.env.DEBUG)) {
    finalOptions.debug = true;
  }

  // To be accessed by the global setup file
  process.env.__STORYBOOK_URL__ = finalOptions.storybookUrl;
  process.env.__STORYBOOK_SCRIPT__ = finalOptions.storybookScript;

  // We signal the test runner that we are not running it via Storybook
  // We are overriding the environment variable to 'true' if vitest runs via @storybook/addon-vitest's backend
  const isVitestStorybook = optionalEnvToBoolean(process.env.VITEST_STORYBOOK);

  const directories = {
    configDir: finalOptions.configDir,
    workingDir: WORKING_DIR,
  };

  const { presets } = await experimental_loadStorybook({
    configDir: finalOptions.configDir,
    packageJson: {},
  });

  const stories = await presets.apply('stories', []);

  // We can probably add more config here. See code/builders/builder-vite/src/vite-config.ts
  // This one is specifically needed for code/builders/builder-vite/src/preset.ts
  const commonConfig = { root: resolve(finalOptions.configDir, '..') };

  const [
    { storiesGlobs },
    framework,
    storybookEnv,
    viteConfigFromStorybook,
    staticDirs,
    previewLevelTags,
    core,
    extraOptimizeDeps,
    features,
  ] = await Promise.all([
    getStoryGlobsAndFiles(presets, directories),
    presets.apply('framework', undefined),
    presets.apply('env', {}),
    presets.apply<{ plugins?: Plugin[]; root: string }>('viteFinal', commonConfig),
    presets.apply('staticDirs', []),
    extractTagsFromPreview(finalOptions.configDir),
    presets.apply('core'),
    presets.apply('optimizeViteDeps', []),
    presets.apply('features', {}),
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
      } catch {
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
            fileURLToPath(import.meta.resolve('@storybook/addon-vitest/internal/setup-file')),
            // if the existing setupFiles is a string, we have to include it otherwise we're overwriting it
            typeof nonMutableInputConfig.test?.setupFiles === 'string' &&
              nonMutableInputConfig.test?.setupFiles,
          ].filter(Boolean) as string[],

          ...(finalOptions.storybookScript
            ? {
                globalSetup: [
                  fileURLToPath(
                    import.meta.resolve('@storybook/addon-vitest/internal/global-setup')
                  ),
                ],
              }
            : {}),

          env: {
            ...storybookEnv,
            // To be accessed by the setup file
            __STORYBOOK_URL__: finalOptions.storybookUrl,

            VITEST_STORYBOOK: isVitestStorybook ? 'true' : 'false',
            __VITEST_INCLUDE_TAGS__: finalOptions.tags.include.join(','),
            __VITEST_EXCLUDE_TAGS__: finalOptions.tags.exclude.join(','),
            __VITEST_SKIP_TAGS__: finalOptions.tags.skip.join(','),
          },

          include: [...includeStories, ...getComponentTestPaths(finalOptions.vitestRoot)],
          exclude: [
            ...(nonMutableInputConfig.test?.exclude ?? []),
            join(relative(finalOptions.vitestRoot, process.cwd()), '**/*.mdx').replaceAll(sep, '/'),
          ],

          // if the existing deps.inline is true, we keep it as-is, because it will inline everything
          // TODO: Remove the check once we don't support Vitest 3 anymore
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

                const shouldRunA11yTests = isVitestStorybook ? (envConfig.a11y ?? false) : true;

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
          FEATURES: JSON.stringify(features),
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
        console.log(
          picocolors.yellow(dedent`
            Warning: Starting in Storybook 8.5.0-alpha.18, the "test.include" option in Vitest is discouraged in favor of just using the "stories" field in your Storybook configuration.

            The values you passed to "test.include" will be ignored, please remove them from your Vitest configuration where the Storybook plugin is applied.
            
            More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#addon-test-indexing-behavior-of-storybookaddon-test-is-changed
          `)
        );
      }

      console.log('INCLUDE', config.test?.include);
      // return the new config, it will be deep-merged by vite
      return config;
    },
    configureVitest(context) {
      context.vitest.config.coverage.exclude.push('storybook-static');

      if (
        !core?.disableTelemetry &&
        !optionalEnvToBoolean(process.env.STORYBOOK_DISABLE_TELEMETRY)
      ) {
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
      if (!optionalEnvToBoolean(process.env.VITEST)) {
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

  if (!!process.env.STORYBOOK_COMPONENT_PATHS) {
    plugins.push(createComponentTestTransformPlugin(presets, finalOptions.configDir));
  }

  plugins.push(storybookTestPlugin);

  // When running tests via the Storybook UI, we need
  // to find the right project to run, thus we override
  // with a unique identifier using the path to the config dir
  if (isVitestStorybook) {
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
