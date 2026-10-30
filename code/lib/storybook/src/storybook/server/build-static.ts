import { mkdir, rm } from 'node:fs/promises';

import { logger } from '@storybook/core/internal/node-logger';
import { getPrecedingUpgrade, telemetry } from '@storybook/core/internal/telemetry';
import type { BuilderOptions, CLIOptions, LoadOptions } from '@storybook/core/internal/types';

import { relative, resolve } from 'pathe';
import picocolors from 'picocolors';

import { createStorybook } from 'storybook/internal/instance';
import { outputStats } from './utils/output-stats.ts';
import { summarizeIndex } from '@storybook/core/internal/deep/story-index/summarizeIndex';

export type BuildStaticStandaloneOptions = CLIOptions &
  LoadOptions &
  BuilderOptions & { outputDir: string };

/** Write a static Storybook through `storybook.build()`, closing the instance afterwards. */
export async function buildStaticStandalone(options: BuildStaticStandaloneOptions): Promise<void> {
  options.configType = 'PRODUCTION';

  if (options.outputDir === '') {
    throw new Error("Won't remove current directory. Check your outputDir!");
  }

  options.outputDir = resolve(options.outputDir);
  options.configDir = resolve(options.configDir);

  logger.step(`Cleaning outputDir: ${picocolors.cyan(relative(process.cwd(), options.outputDir))}`);
  if (options.outputDir === '/') {
    throw new Error("Won't remove directory '/'. Check your outputDir!");
  }
  await rm(options.outputDir, { recursive: true, force: true }).catch(() => {});
  await mkdir(options.outputDir, { recursive: true });

  logger.step('Loading presets');
  const storybook = createStorybook({
    configDir: options.configDir,
    workingDir: process.cwd(),
    mode: 'build',
    cliOptions: options,
  });
  try {
    await storybook.ready();

    const invokedBy = process.env.STORYBOOK_INVOKED_BY;
    if (invokedBy) {
      // NOTE: we don't await this event to avoid slowing things down.
      // This could result in telemetry events being lost.
      telemetry('test-run', { runner: invokedBy, watch: false }, { configDir: options.configDir });
    }

    const { outputDir, previewStats } = await storybook.build();

    const statsOption = options.webpackStatsJson || options.statsJson;
    if (statsOption) {
      const target = statsOption === true ? outputDir : statsOption;
      await outputStats(target, previewStats);
    }

    // Now the code has successfully built, we can count this as a 'build' event.
    // NOTE: we don't send the 'build' event for test runs as we want to be as fast as possible.
    if (!options.test) {
      try {
        const storyIndex = await storybook.getIndex();
        const payload: any = {
          precedingUpgrade: await getPrecedingUpgrade(),
        };
        if (storyIndex) {
          Object.assign(payload, {
            storyIndex: summarizeIndex(storyIndex),
          });
        }

        await telemetry('build', payload, { configDir: options.configDir });
      } catch (e) {
        // Telemetry failures should not fail the build process
        logger.debug?.(`Build telemetry failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    logger.step(`Output directory: ${outputDir}`);
  } finally {
    await storybook.close();
  }
}
