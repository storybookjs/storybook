import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vitest/config';
import type { ViteUserConfig } from 'vitest/config';
import type { VitestPluginContext } from 'vitest/node';
import type {} from '@vitest/browser-playwright';

import { defineAddon, type Storybook } from '@storybook/core';
import {
  DEFAULT_FILES_PATTERN,
  HandledError,
  getFrameworkNameFromConfig,
  getInterpretedFile,
  normalizeStories,
  optionalEnvToBoolean,
  resolvePathInStorybookCache,
  validateConfigurationFiles,
} from '@storybook/core/internal/common';
import { StoryIndexGenerator, Tag } from '@storybook/core/internal/story-index';
import {
  componentTransform,
  readConfig,
  vitestTransform,
} from '@storybook/core/internal/csf-tools';
import { MainFileMissingError } from '@storybook/core/internal/server-errors';
import {
  detectAgent,
  isTelemetryModuleEnabled,
  isWithinInitialSession,
  oneWayHash,
  telemetry,
  setTelemetryEnabled,
} from '@storybook/core/internal/telemetry';
import type { StoriesEntry } from '@storybook/core/internal/types';
// Types only: declares the `builder:vite:extend` hook.
import type {} from '@storybook/builder-vite/node';

import { match } from 'micromatch';
import { join, normalize, relative, resolve, sep } from 'pathe';
import path from 'pathe';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import {
  STORYBOOK_CORE_GHOST_STORIES_PROVIDE_KEY,
  STORYBOOK_CORE_RENDER_ANALYSIS_PROVIDE_KEY,
  STORYBOOK_TEST_FEATURES_PROVIDE_KEY,
  STORYBOOK_TEST_INITIAL_GLOBALS_PROVIDE_KEY,
} from '../constants.ts';
import type { InternalOptions, UserOptions } from './types.ts';
import { AgentTelemetryReporter } from './agent-telemetry-reporter.ts';
import { isStorybookInternalFrame } from './stack-frames.ts';

interface ApiPermissions {
  allowWrite?: boolean;
  allowExec?: boolean;
}

/** State the `config` hook discovers and later hooks read. */
interface TestSession {
  agent?: ReturnType<typeof detectAgent>;
  withinAgenticSetupSession: boolean;
  userApiPermissions: ApiPermissions;
}

/** Values resolved once, before Vite asks for plugins. */
interface TestInputs {
  storiesGlobs: StoriesEntry[];
  previewLevelTags: string[];
}

export const WORKING_DIR = process.cwd();

const DEFAULT_OPTIONS = {
  storybookScript: undefined,
  configDir: resolve(join(WORKING_DIR, '.storybook')),
  storybookUrl: 'http://localhost:6006',
  disableAddonDocs: true,
  initialGlobals: {},
} satisfies UserOptions;

const SETUP_FILES = [
  '@storybook/addon-vitest/internal/setup-file',
  '@storybook/addon-vitest/internal/setup-file-with-project-annotations',
];

/** Run stories as Vitest tests: appends the test plugins to the instance's `builder:vite:extend`. */
export const vitestAddon = defineAddon<UserOptions | void>((input) => ({
  meta: { name: '@storybook/addon-vitest/vitest-plugin' },
  setup(storybook): void {
    const options = resolveOptions(input || undefined, storybook.configDir);
    // Override stage: after `main.ts` viteFinal, where `storybookTest` used to append them.
    storybook.hook(
      'builder:vite:extend',
      async (config) => ({
        ...config,
        plugins: [...(config.plugins ?? []), ...(await storybookTestPlugins(storybook, options))],
      }),
      undefined,
      'override'
    );
  },
}));

/** The absolute config dir `storybookTest` loads. */
export function resolveConfigDir(options: UserOptions | undefined): string {
  return options?.configDir ? resolve(WORKING_DIR, options.configDir) : DEFAULT_OPTIONS.configDir;
}

/** Whether addon docs stay off, as `disableAddonDocs` defaults. */
export function isAddonDocsDisabled(options: UserOptions | undefined): boolean {
  return options?.disableAddonDocs ?? DEFAULT_OPTIONS.disableAddonDocs;
}

function resolveOptions(options: UserOptions | undefined, configDir: string): InternalOptions {
  const finalOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    configDir,
    tags: {
      include: options?.tags?.include ?? [Tag.TEST],
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

  return finalOptions;
}

async function storybookTestPlugins(
  storybook: Storybook,
  options: InternalOptions
): Promise<Plugin[]> {
  const [{ storiesGlobs }, previewLevelTags, core] = await Promise.all([
    getStoryGlobsAndFiles(storybook.options.stories, {
      configDir: options.configDir,
      workingDir: WORKING_DIR,
    }),
    extractTagsFromPreview(options.configDir),
    storybook.callHook('core:config:extend', undefined),
  ]);
  await setTelemetryEnabled(!core?.disableTelemetry);

  return [
    ...(options.disableAddonDocs ? [mdxStubPlugin()] : []),
    ...(getComponentTestPaths().length > 0
      ? [componentTestTransformPlugin(storybook, options.configDir)]
      : []),
    storybookTestPlugin(storybook, options, { storiesGlobs, previewLevelTags }),
    // The Storybook UI finds its Vitest project by this name.
    ...(optionalEnvToBoolean(process.env.VITEST_STORYBOOK)
      ? [workspaceNameOverridePlugin(options.configDir)]
      : []),
  ];
}

function storybookTestPlugin(
  storybook: Storybook,
  options: InternalOptions,
  inputs: TestInputs
): Plugin {
  const session: TestSession = { withinAgenticSetupSession: false, userApiPermissions: {} };

  return {
    name: 'vite-plugin-storybook-test',
    async closeBundle() {
      await storybook.close();
    },
    config: {
      // After the preview host plugin, which sits after this one and applies the preview root.
      order: 'post',
      async handler(nonMutableInputConfig, { mode }) {
        if (isTelemetryModuleEnabled()) {
          session.agent = detectAgent();
          session.withinAgenticSetupSession =
            !!session.agent && (await isWithinInitialSession('ai-setup'));
        }

        if (mode) {
          // Needed for `preset.apply('env')` to work correctly
          process.env.BUILD_TARGET = mode;
        }

        try {
          await validateConfigurationFiles(options.configDir);
        } catch {
          throw new MainFileMissingError({ location: options.configDir, source: 'vitest' });
        }

        session.userApiPermissions = getUserApiPermissions(nonMutableInputConfig.test);
        const config = await testConfig(storybook, options, session, nonMutableInputConfig);
        warnAboutUserIncludes(nonMutableInputConfig);
        return config;
      },
    },
    async configureVitest(context) {
      configureVitestRun(context, options, session);
    },
    async transform(code, id) {
      const relativeId = relative(options.vitestRoot, id);

      if (match([relativeId], options.includeStories).length > 0) {
        return vitestTransform({
          code,
          fileName: id,
          configDir: options.configDir,
          tagsFilter: options.tags,
          stories: inputs.storiesGlobs,
          previewLevelTags: inputs.previewLevelTags,
        });
      }
    },
  };
}

// Returns a new partial config that Vite deep-merges; the input config is never mutated here.
async function testConfig(
  storybook: Storybook,
  options: InternalOptions,
  session: TestSession,
  inputConfig: ViteUserConfig
): Promise<ViteUserConfig> {
  const { stories, framework, features } = storybook.options;
  const frameworkName = getFrameworkNameFromConfig(framework);
  const inputTestConfig = inputConfig.test;

  // Vitest resolves the story globs below against the final root, not the invoking one. The
  // preview host plugin configures first, so `inputConfig.root` already carries the
  // `builder:vite:extend` root; a Vitest config above `configDir/..` (a monorepo) would otherwise
  // point every glob outside the project and silently match no files.
  options.vitestRoot =
    inputTestConfig?.dir || inputTestConfig?.root || inputConfig.root || process.cwd();

  options.includeStories = stories.map((story) =>
    relative(
      options.vitestRoot,
      join(
        options.configDir,
        typeof story === 'string'
          ? story
          : `${story.directory}/${story.files ?? DEFAULT_FILES_PATTERN}`
      )
    )
  );

  return {
    cacheDir: resolvePathInStorybookCache('sb-vitest', oneWayHash(options.configDir)),
    test: {
      expect: { requireAssertions: false },

      onStackTrace: (error, frame) => {
        if (isStorybookInternalFrame(frame.file)) {
          return false;
        }
        return inputTestConfig?.onStackTrace?.(error, frame) ?? true;
      },

      setupFiles: [...SETUP_FILES],

      ...(options.storybookScript
        ? {
            globalSetup: [
              fileURLToPath(import.meta.resolve('@storybook/addon-vitest/internal/global-setup')),
            ],
          }
        : {}),

      env: {
        /**
         * Read late, because Vitest's --mode must be synced into BUILD_TARGET first; the .env
         * loaders only read that variable, and a stale mode would leak envs from the wrong file.
         *
         * @see https://github.com/storybookjs/storybook/issues/33101
         */
        ...(await storybook.callHook('core:env:extend', {})),
        // To be accessed by the setup file
        __STORYBOOK_URL__: options.storybookUrl,
        VITEST_STORYBOOK: optionalEnvToBoolean(process.env.VITEST_STORYBOOK) ? 'true' : 'false',
        __VITEST_INCLUDE_TAGS__: options.tags.include.join(','),
        __VITEST_EXCLUDE_TAGS__: options.tags.exclude.join(','),
        __VITEST_SKIP_TAGS__: options.tags.skip.join(','),
      },

      provide: {
        [STORYBOOK_TEST_FEATURES_PROVIDE_KEY]: features,
        [STORYBOOK_CORE_GHOST_STORIES_PROVIDE_KEY]: !!process.env.STORYBOOK_COMPONENT_PATHS,
        [STORYBOOK_CORE_RENDER_ANALYSIS_PROVIDE_KEY]:
          !!process.env.STORYBOOK_COMPONENT_PATHS || session.withinAgenticSetupSession,
        [STORYBOOK_TEST_INITIAL_GLOBALS_PROVIDE_KEY]: options.initialGlobals,
      },

      include: [...options.includeStories, ...getComponentTestPaths()],
      exclude: [
        ...(inputTestConfig?.exclude ?? []),
        join(relative(options.vitestRoot, process.cwd()), '**/*.mdx').replaceAll(sep, '/'),
      ],

      browser: {
        // Without an explicit choice, failing browser tests do not save screenshots.
        ...(inputTestConfig?.browser && inputTestConfig.browser.screenshotFailures === undefined
          ? { screenshotFailures: false }
          : {}),

        // Chromium on Linux can apply :hover to the element under a still cursor, so tests move
        // the cursor out of the page first.
        commands: {
          async resetMousePosition(ctx) {
            if (ctx.provider.name === 'playwright') {
              const frame = await ctx.frame();
              await frame.page().mouse.move(-1000, -1000);
            }
          },
        },
      },
    },

    optimizeDeps: {
      include: [
        '@storybook/addon-vitest/internal/setup-file',
        '@storybook/addon-vitest/internal/setup-file.browser.4',
        '@storybook/addon-vitest/internal/global-setup',
        '@storybook/addon-vitest/internal/test-utils',
        'storybook/preview-api',
        // imported by the setup files; without pinning, its CJS-only deps (via
        // @testing-library/dom) reach the browser raw on hoisted node_modules layouts
        'storybook/test',
        ...(frameworkName?.includes('react') || frameworkName?.includes('nextjs')
          ? ['react-dom/test-utils']
          : []),
      ],
      // Vitest only excludes these when coverage is enabled at startup. Storybook can enable
      // coverage later, and without this Vite would optimize them mid-run and reload the tests.
      exclude: ['@vitest/coverage-v8/browser', '@vitest/coverage-istanbul'],
    },

    ...(frameworkName?.includes('vue3')
      ? { define: { __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' } }
      : {}),
  };
}

// Story globs from main.ts replace the user's `test.include`.
function warnAboutUserIncludes(inputConfig: ViteUserConfig): void {
  if ((inputConfig.test?.include?.length ?? 0) > 0) {
    // @ts-expect-error: Ignore
    inputConfig.test.include = [];
    console.log(
      picocolors.yellow(dedent`
        Warning: Starting in Storybook 8.5.0-alpha.18, the "test.include" option in Vitest is discouraged in favor of just using the "stories" field in your Storybook configuration.

        The values you passed to "test.include" will be ignored, please remove them from your Vitest configuration where the Storybook plugin is applied.

        More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#addon-test-indexing-behavior-of-storybookaddon-test-is-changed
      `)
    );
  }
}

function configureVitestRun(
  context: VitestPluginContext,
  options: InternalOptions,
  session: TestSession
): void {
  context.vitest.config.coverage.exclude.push('storybook-static');

  if (context.project.config.browser?.enabled === true) {
    const browserSetupFile = fileURLToPath(
      import.meta.resolve('@storybook/addon-vitest/internal/setup-file.browser.4')
    );

    if (!context.project.config.setupFiles.includes(browserSetupFile)) {
      context.project.config.setupFiles.push(browserSetupFile);
    }

    restrictBrowserApi(context.project.config, session.userApiPermissions);
  }

  // Started but not awaited: an event that outlives the run is acceptable to lose.
  telemetry(
    'test-run',
    {
      runner: 'vitest',
      watch: context.vitest.config.watch,
      coverage: !!context.vitest.config.coverage?.enabled,
    },
    { configDir: options.configDir }
  );

  // Internal runs (STORYBOOK_INTERNAL_TEST_RUN: ghost stories, final scoring) are not the agent's
  // self-healing loop, so they must not report as it.
  if (
    isTelemetryModuleEnabled() &&
    session.agent &&
    session.withinAgenticSetupSession &&
    !process.env.STORYBOOK_INTERNAL_TEST_RUN
  ) {
    context.vitest.config.reporters.push(
      new AgentTelemetryReporter({ configDir: options.configDir, agent: session.agent })
    );
  }
}

// Story code runs in the browser, and Vitest otherwise lets it write files and run commands in
// Node whenever the server is bound to loopback. Vitest 5 reads `api`; Vitest 4 also `browser.api`.
function restrictBrowserApi(projectConfig: object, userApiPermissions: ApiPermissions): void {
  const { api, browser } = projectConfig as {
    api: ApiPermissions;
    browser: { api?: ApiPermissions };
  };
  for (const target of [api, browser.api]) {
    if (target) {
      target.allowWrite = userApiPermissions.allowWrite ?? false;
      target.allowExec = userApiPermissions.allowExec ?? false;
    }
  }
}

function workspaceNameOverridePlugin(configDir: string): Plugin {
  const projectName = `storybook:${normalize(configDir)}`;
  return {
    name: 'storybook:workspace-name-override',
    config: {
      order: 'pre',
      handler: () => ({ test: { name: projectName } }),
    },
  };
}

async function extractTagsFromPreview(configDir: string): Promise<string[]> {
  const previewConfigPath = getInterpretedFile(join(resolve(configDir), 'preview'));

  if (!previewConfigPath) {
    return [];
  }
  const previewConfig = await readConfig(previewConfigPath);
  const tags =
    previewConfig.inspect(['tags']).kind === 'value' ? previewConfig.getValue(['tags']) : [];
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) {
    throw new HandledError('Preview tags must be a static array of strings');
  }
  return tags;
}

async function getStoryGlobsAndFiles(
  stories: StoriesEntry[],
  directories: { configDir: string; workingDir: string }
): Promise<{ storiesGlobs: StoriesEntry[]; storiesFiles: string[] }> {
  const normalizedStories = normalizeStories(stories, directories);

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
}

/** Stub MDX imports, so tests never compile MDX. */
function mdxStubPlugin(): Plugin {
  return {
    name: 'storybook:stub-mdx-plugin',
    enforce: 'pre',
    resolveId(id) {
      return id.endsWith('.mdx') ? id : null;
    },
    load(id) {
      return id.endsWith('.mdx') ? `export default {};` : null;
    },
  };
}

// Docgen makes the component transform expensive, so it only runs on STORYBOOK_COMPONENT_PATHS.
function getComponentTestPaths(): string[] {
  const envPaths = process.env.STORYBOOK_COMPONENT_PATHS;

  if (!envPaths) {
    return [];
  }

  return envPaths.split(';').filter(Boolean);
}

function componentTestTransformPlugin(
  storybook: Pick<Storybook, 'callHook'>,
  configDir: string
): Plugin {
  const storybookComponentTestPaths: string[] = getComponentTestPaths();

  return {
    name: 'storybook:component-test-transform-plugin',
    transform: {
      order: 'pre',
      async handler(code, id) {
        if (!optionalEnvToBoolean(process.env.VITEST) || storybookComponentTestPaths.length === 0) {
          return code;
        }

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

        const result = await componentTransform({
          code,
          fileName: id,
          getComponentArgTypes: async ({ componentName, fileName }) =>
            storybook.callHook('legacy:internal_getArgTypesData:extend', null, {
              componentFilePath: fileName,
              componentExportName: componentName,
              configDir,
            }),
        });

        return result.code;
      },
    },
  };
}

// Users on Vitest 4 may have set the permissions on `browser.api`, which Vitest 5 no longer types.
function getUserApiPermissions(testConfig: ViteUserConfig['test']): ApiPermissions {
  const api = toApiPermissions(testConfig?.api);
  const browserApi = toApiPermissions((testConfig?.browser as { api?: unknown } | undefined)?.api);
  return {
    allowWrite: api.allowWrite ?? browserApi.allowWrite,
    allowExec: api.allowExec ?? browserApi.allowExec,
  };
}

function toApiPermissions(api: unknown): ApiPermissions {
  return api && typeof api === 'object' ? (api as ApiPermissions) : {};
}
