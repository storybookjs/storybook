import chalk from 'chalk';
import { copy, emptyDir, ensureDir } from 'fs-extra';
import { dirname, join, relative, resolve } from 'node:path';
import { global } from '@storybook/global';
import { logger } from '@storybook/core/node-logger';
import { getPrecedingUpgrade, telemetry } from '@storybook/core/telemetry';
import type { BuilderOptions, CLIOptions, LoadOptions, Options } from '@storybook/core/types';
import {
  loadAllPresets,
  loadMainConfig,
  logConfig,
  normalizeStories,
  resolveAddonName,
} from '@storybook/core/common';

import { outputStats } from './utils/output-stats';
import { copyAllStaticFilesRelativeToMain } from './utils/copy-all-static-files';
import { getBuilders } from './utils/get-builders';
import { extractStoriesJson } from './utils/stories-json';
import { extractStorybookMetadata } from './utils/metadata';
import { StoryIndexGenerator } from './utils/StoryIndexGenerator';
import { summarizeIndex } from './utils/summarizeIndex';
import { buildOrThrow } from './utils/build-or-throw';

export type BuildStaticStandaloneOptions = CLIOptions &
  LoadOptions &
  BuilderOptions & { outputDir: string };

export async function buildStaticStandalone(options: BuildStaticStandaloneOptions) {
  options.configType = 'PRODUCTION';

  if (options.outputDir === '') {
    throw new Error("Won't remove current directory. Check your outputDir!");
  }

  options.outputDir = resolve(options.outputDir);
  options.configDir = resolve(options.configDir);

  logger.info(`=> Cleaning outputDir: ${chalk.cyan(relative(process.cwd(), options.outputDir))}`);
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
      require.resolve('@storybook/core/core-server/presets/common-preset'),
      ...corePresets,
    ],
    overridePresets: [
      require.resolve('@storybook/core/core-server/presets/common-override-preset'),
    ],
    isCritical: true,
    ...options,
  });

  const { renderer } = await presets.apply('core', {});
  const build = await presets.apply('build', {});
  const [previewBuilder, managerBuilder] = await getBuilders({ ...options, presets, build });

  const resolvedRenderer = renderer
    ? resolveAddonName(options.configDir, renderer, options)
    : undefined;
  presets = await loadAllPresets({
    corePresets: [
      require.resolve('@storybook/core/core-server/presets/common-preset'),
      ...(managerBuilder.corePresets || []),
      ...(previewBuilder.corePresets || []),
      ...(resolvedRenderer ? [resolvedRenderer] : []),
      ...corePresets,
    ],
    overridePresets: [
      ...(previewBuilder.overridePresets || []),
      require.resolve('@storybook/core/core-server/presets/common-override-preset'),
    ],
    ...options,
    build,
  });

  const [features, core, staticDirs, indexers, stories, docsOptions] = await Promise.all([
    presets.apply('features'),
    presets.apply('core'),
    presets.apply('staticDirs'),
    presets.apply('experimental_indexers', []),
    presets.apply('stories'),
    presets.apply('docs', {}),
  ]);

  const fullOptions: Options = {
    ...options,
    presets,
    features,
    build,
  };

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

  const coreServerPublicDir = join(
    dirname(require.resolve('@storybook/core/package.json')),
    'assets/browser'
  );
  effects.push(copy(coreServerPublicDir, options.outputDir));

  let initializedStoryIndexGenerator: Promise<StoryIndexGenerator | undefined> =
    Promise.resolve(undefined);
  if (!options.ignorePreview) {
    const workingDir = process.cwd();
    const directories = {
      configDir: options.configDir,
      workingDir,
    };
    const normalizedStories = normalizeStories(stories, directories);
    const generator = new StoryIndexGenerator(normalizedStories, {
      ...directories,
      indexers,
      docs: docsOptions,
      build,
    });

    initializedStoryIndexGenerator = generator.initialize().then(() => generator);
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

              const statsOption = options.webpackStatsJson || options.statsJson;
              if (statsOption) {
                const target = statsOption === true ? options.outputDir : statsOption;
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
