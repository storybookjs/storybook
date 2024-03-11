import chalk from 'chalk';
import { copy, emptyDir, ensureDir } from 'fs-extra';
import { dirname, isAbsolute, join, resolve } from 'path';
import { global } from '@storybook/global';
import { deprecate, logger } from '@storybook/node-logger';
import { getPrecedingUpgrade, telemetry } from '@storybook/telemetry';
import type {
  BuilderOptions,
  CLIOptions,
  CoreConfig,
  DocsOptions,
  LoadOptions,
  Options,
  StorybookConfig,
} from '@storybook/types';
import {
  loadAllPresets,
  loadMainConfig,
  logConfig,
  normalizeStories,
  resolveAddonName,
} from '@storybook/core-common';
import { ConflictingStaticDirConfigError } from '@storybook/core-events/server-errors';

import isEqual from 'lodash/isEqual.js';
import dedent from 'ts-dedent';
import { outputStats } from './utils/output-stats';
import {
  copyAllStaticFiles,
  copyAllStaticFilesRelativeToMain,
} from './utils/copy-all-static-files';
import { getBuilders } from './utils/get-builders';
import { convertToIndexV3, extractStoriesJson } from './utils/stories-json';
import { extractStorybookMetadata } from './utils/metadata';
import { StoryIndexGenerator } from './utils/StoryIndexGenerator';
import { summarizeIndex } from './utils/summarizeIndex';
import { defaultStaticDirs } from './utils/constants';
import { buildOrThrow } from './utils/build-or-throw';

export type BuildStaticStandaloneOptions = CLIOptions &
  LoadOptions &
  BuilderOptions & { outputDir: string };

export async function buildStaticStandalone(options: BuildStaticStandaloneOptions) {
  /* eslint-disable no-param-reassign */
  options.configType = 'PRODUCTION';

  if (options.outputDir === '') {
    throw new Error("Won't remove current directory. Check your outputDir!");
  }

  if (options.staticDir?.includes('/')) {
    throw new Error("Won't copy root directory. Check your staticDirs!");
  }

  options.outputDir = isAbsolute(options.outputDir)
    ? options.outputDir
    : join(process.cwd(), options.outputDir);
  options.configDir = resolve(options.configDir);
  /* eslint-enable no-param-reassign */

  logger.info(chalk`=> Cleaning outputDir: {cyan ${options.outputDir.replace(process.cwd(), '')}}`);
  if (options.outputDir === '/') {
    throw new Error("Won't remove directory '/'. Check your outputDir!");
  }
  await emptyDir(options.outputDir);
  await ensureDir(options.outputDir);

  const config = await loadMainConfig(options);
  const { framework } = config;
  const corePresets = [];

  const frameworkName = typeof framework === 'string' ? framework : framework?.name;
  if (frameworkName) {
    corePresets.push(join(frameworkName, 'preset'));
  } else if (!options.ignorePreview) {
    logger.warn(`you have not specified a framework in your ${options.configDir}/main.js`);
  }

  logger.info('=> Loading presets');
  let presets = await loadAllPresets({
    corePresets: [
      require.resolve('@storybook/core-server/dist/presets/common-preset'),
      ...corePresets,
    ],
    overridePresets: [
      require.resolve('@storybook/core-server/dist/presets/common-override-preset'),
    ],
    isCritical: true,
    ...options,
  });

  const { renderer } = await presets.apply<CoreConfig>('core', {});
  const build = await presets.apply('build', {});
  const [previewBuilder, managerBuilder] = await getBuilders({ ...options, presets, build });

  const resolvedRenderer = renderer
    ? resolveAddonName(options.configDir, renderer, options)
    : undefined;
  presets = await loadAllPresets({
    corePresets: [
      require.resolve('@storybook/core-server/dist/presets/common-preset'),
      ...(managerBuilder.corePresets || []),
      ...(previewBuilder.corePresets || []),
      ...(resolvedRenderer ? [resolvedRenderer] : []),
      ...corePresets,
      require.resolve('@storybook/core-server/dist/presets/babel-cache-preset'),
    ],
    overridePresets: [
      ...(previewBuilder.overridePresets || []),
      require.resolve('@storybook/core-server/dist/presets/common-override-preset'),
    ],
    ...options,
    build,
  });

  const [features, core, staticDirs, indexers, deprecatedStoryIndexers, stories, docsOptions] =
    await Promise.all([
      presets.apply<StorybookConfig['features']>('features'),
      presets.apply<CoreConfig>('core'),
      presets.apply<StorybookConfig['staticDirs']>('staticDirs'),
      presets.apply('experimental_indexers', []),
      presets.apply('storyIndexers', []),
      presets.apply('stories'),
      presets.apply<DocsOptions>('docs', {}),
    ]);

  if (features?.storyStoreV7 === false) {
    deprecate(
      dedent`storyStoreV6 is deprecated, please migrate to storyStoreV7 instead.
        - Refer to the migration guide at https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#storystorev6-and-storiesof-is-deprecated`
    );
  }

  const fullOptions: Options = {
    ...options,
    presets,
    features,
    build,
  };

  if (options.staticDir && !isEqual(staticDirs, defaultStaticDirs)) {
    throw new ConflictingStaticDirConfigError();
  }

  const effects: Promise<void>[] = [];

  global.FEATURES = features;

  await buildOrThrow(async () =>
    managerBuilder.build({ startTime: process.hrtime(), options: fullOptions })
  );

  if (staticDirs) {
    effects.push(
      copyAllStaticFilesRelativeToMain(staticDirs, options.outputDir, options.configDir)
    );
  }
  if (options.staticDir) {
    effects.push(copyAllStaticFiles(options.staticDir, options.outputDir));
  }

  const coreServerPublicDir = join(
    dirname(require.resolve('@storybook/core-server/package.json')),
    'public'
  );
  effects.push(copy(coreServerPublicDir, options.outputDir));

  let initializedStoryIndexGenerator: Promise<StoryIndexGenerator | undefined> =
    Promise.resolve(undefined);
  if ((features?.buildStoriesJson || features?.storyStoreV7) && !options.ignorePreview) {
    const workingDir = process.cwd();
    const directories = {
      configDir: options.configDir,
      workingDir,
    };
    const normalizedStories = normalizeStories(stories, directories);
    const generator = new StoryIndexGenerator(normalizedStories, {
      ...directories,
      storyIndexers: deprecatedStoryIndexers,
      indexers,
      docs: docsOptions,
      storiesV2Compatibility: !features?.storyStoreV7,
      storyStoreV7: !!features?.storyStoreV7,
      build,
    });

    initializedStoryIndexGenerator = generator.initialize().then(() => generator);
    effects.push(
      extractStoriesJson(
        join(options.outputDir, 'stories.json'),
        initializedStoryIndexGenerator as Promise<StoryIndexGenerator>,
        convertToIndexV3
      )
    );
    effects.push(
      extractStoriesJson(
        join(options.outputDir, 'index.json'),
        initializedStoryIndexGenerator as Promise<StoryIndexGenerator>
      )
    );
  }

  if (!core?.disableProjectJson) {
    effects.push(
      extractStorybookMetadata(join(options.outputDir, 'project.json'), options.configDir)
    );
  }

  if (options.debugWebpack) {
    logConfig('Preview webpack config', await previewBuilder.getConfig(fullOptions));
  }

  if (options.ignorePreview) {
    logger.info(`=> Not building preview`);
  } else {
    logger.info('=> Building preview..');
  }

  const startTime = process.hrtime();
  await Promise.all([
    ...(options.ignorePreview
      ? []
      : [
          previewBuilder
            .build({
              startTime,
              options: fullOptions,
            })
            .then(async (previewStats) => {
              logger.trace({ message: '=> Preview built', time: process.hrtime(startTime) });

              if (options.webpackStatsJson) {
                const target =
                  options.webpackStatsJson === true ? options.outputDir : options.webpackStatsJson;
                await outputStats(target, previewStats);
              }
            })
            .catch((error) => {
              logger.error('=> Failed to build the preview');
              process.exitCode = 1;
              throw error;
            }),
        ]),
    ...effects,
  ]);

  // Now the code has successfully built, we can count this as a 'dev' event.
  if (!core?.disableTelemetry) {
    effects.push(
      initializedStoryIndexGenerator.then(async (generator) => {
        const storyIndex = await generator?.getIndex();
        const payload = {
          precedingUpgrade: await getPrecedingUpgrade(),
        };
        if (storyIndex) {
          Object.assign(payload, {
            storyIndex: summarizeIndex(storyIndex),
          });
        }
        await telemetry('build', payload, { configDir: options.configDir });
      })
    );
  }

  logger.info(`=> Output directory: ${options.outputDir}`);
}
