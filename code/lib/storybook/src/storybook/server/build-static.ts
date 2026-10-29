import { cp, mkdir } from 'node:fs/promises';
import { rm } from 'node:fs/promises';

import { MissingBuilderError } from '@storybook/core/internal/server-errors';
import { logger } from '@storybook/core/internal/node-logger';
import { getPrecedingUpgrade, telemetry } from '@storybook/core/internal/telemetry';
import type { BuilderOptions, CLIOptions, LoadOptions } from '@storybook/core/internal/types';

import { join, relative, resolve } from 'pathe';
import picocolors from 'picocolors';

import {
  getRegisteredServices,
  writeOpenServiceStaticFiles,
} from '@storybook/core/internal/deep/shared/open-service/server';
import { createStorybook } from 'storybook/internal/instance';
import { runWithStorybook } from '@storybook/core/internal/deep/instance/instance-context';
import { resolvePackageDir } from '@storybook/core/internal/deep/utils/module';
import { buildOrThrow } from './utils/build-or-throw.ts';
import { copyAllStaticFilesRelativeToMain } from './utils/copy-all-static-files.ts';
import { createManagerHost } from '@storybook/manager/internal/deep/builder-manager/host';
import { writeIndexJson } from './utils/index-json.ts';
import { extractStorybookMetadata } from './utils/metadata.ts';
import { outputStats } from './utils/output-stats.ts';
import { summarizeIndex } from '@storybook/core/internal/deep/story-index/summarizeIndex';
import { getPreviewSources } from '../preview-page.ts';

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

  logger.step(`Cleaning outputDir: ${picocolors.cyan(relative(process.cwd(), options.outputDir))}`);
  if (options.outputDir === '/') {
    throw new Error("Won't remove directory '/'. Check your outputDir!");
  }
  await rm(options.outputDir, { recursive: true, force: true }).catch(() => {});
  await mkdir(options.outputDir, { recursive: true });

  logger.step('Loading presets');
  const storybook = await createStorybook({
    configDir: options.configDir,
    workingDir: process.cwd(),
    mode: 'build',
    cliOptions: options,
  });
  try {
    await runWithStorybook(storybook, async () => {
      const { builder: previewBuilder } = storybook;
      if (!previewBuilder) {
        throw new MissingBuilderError();
      }
      const { staticDirs } = storybook.options;
      const core = await storybook.callHook('core:config:extend', undefined);

      const invokedBy = process.env.STORYBOOK_INVOKED_BY;
      if (invokedBy) {
        // NOTE: we don't await this event to avoid slowing things down.
        // This could result in telemetry events being lost.
        telemetry(
          'test-run',
          { runner: invokedBy, watch: false },
          { configDir: options.configDir }
        );
      }

      const manager = createManagerHost(storybook);

      const effects: Promise<void>[] = [];

      if (!options.previewOnly) {
        await buildOrThrow(async () => manager.build({ startTime: process.hrtime() }));
      }

      if (staticDirs) {
        effects.push(
          copyAllStaticFilesRelativeToMain(staticDirs, options.outputDir, options.configDir)
        );
      }

      const coreServerPublicDir = join(
        resolvePackageDir('@storybook/core', import.meta.url),
        'assets/browser'
      );
      effects.push(cp(coreServerPublicDir, options.outputDir, { recursive: true, force: true }));

      const hasRegisteredServices = getRegisteredServices().length > 0;
      const staticOutputWriters = await storybook.callHook('server:static-output:collect', []);

      if (hasRegisteredServices || staticOutputWriters.length > 0) {
        effects.push(
          (async () => {
            if (hasRegisteredServices) {
              logger.info('Building open services..');
              await writeOpenServiceStaticFiles(options.outputDir);
            }

            // Writers may read the open-service snapshots, so they run after those, in order.
            for (const write of staticOutputWriters) {
              await write({ outputDir: options.outputDir });
            }
          })()
        );
      }

      const storyIndexGeneratorPromise = storybook.getStoryIndexGenerator();

      effects.push(
        writeIndexJson(join(options.outputDir, 'index.json'), storyIndexGeneratorPromise)
      );

      if (!core?.disableProjectJson) {
        effects.push(
          extractStorybookMetadata(join(options.outputDir, 'project.json'), options.configDir)
        );
      }

      logger.info('Building preview..');

      const startTime = process.hrtime();
      const preview = await getPreviewSources(storybook, { hmr: previewBuilder.hmr ?? 'vite' });
      await Promise.all([
        previewBuilder
          .build(storybook, { startTime, outDir: options.outputDir, preview })
          .then(async (previewStats) => {
            logger.trace({ message: 'Preview built', time: process.hrtime(startTime) });

            const statsOption = options.webpackStatsJson || options.statsJson;
            if (statsOption) {
              const target = statsOption === true ? options.outputDir : statsOption;
              await outputStats(target, previewStats);
            }
          })
          .catch((error) => {
            logger.error('Failed to build the preview');
            process.exitCode = 1;
            throw error;
          }),
        ...effects,
      ]);

      // Now the code has successfully built, we can count this as a 'build' event.
      // NOTE: we don't send the 'build' event for test runs as we want to be as fast as possible.
      if (!options.test) {
        try {
          const generator = await storyIndexGeneratorPromise;
          const storyIndex = await generator?.getIndex();
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

      logger.step(`Output directory: ${options.outputDir}`);
    });
  } finally {
    await storybook.close();
  }
}
