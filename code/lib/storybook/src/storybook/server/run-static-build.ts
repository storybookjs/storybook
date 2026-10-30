import { cp } from 'node:fs/promises';

import { MissingBuilderError } from '@storybook/core/internal/server-errors';
import { logger } from '@storybook/core/internal/node-logger';
import type {
  BuilderAddon,
  CreateStorybookInput,
  Storybook,
  StorybookBuildResult,
} from '@storybook/core';

import { join, resolve } from 'pathe';

import {
  getRegisteredServices,
  writeOpenServiceStaticFiles,
} from '@storybook/core/internal/deep/shared/open-service/server';
import { runWithStorybook } from '@storybook/core/internal/deep/instance/instance-context';
import { resolvePackageDir } from '@storybook/core/internal/deep/utils/module';
import { createManagerHost } from '@storybook/manager/internal/deep/builder-manager/host';
import { buildOrThrow } from './utils/build-or-throw.ts';
import { copyAllStaticFilesRelativeToMain } from './utils/copy-all-static-files.ts';
import { writeIndexJson } from './utils/index-json.ts';
import { extractStorybookMetadata } from './utils/metadata.ts';
import { getPreviewSources } from '../preview-page.ts';

/** The product static build, with the preview stats the CLI reports. */
export interface StaticBuild extends StorybookBuildResult {
  previewStats: Awaited<ReturnType<BuilderAddon['build']>>;
}

/** Write the manager, preview, index and static files of a ready `mode: 'build'` instance. */
export async function runStaticBuild(
  storybook: Storybook,
  cliOptions: CreateStorybookInput['cliOptions'] = {}
): Promise<StaticBuild> {
  if (!cliOptions.outputDir) {
    throw new Error('Building Storybook requires cliOptions.outputDir.');
  }
  const outputDir = resolve(storybook.workingDir, cliOptions.outputDir);
  const { configDir } = storybook;

  return runWithStorybook(storybook, async () => {
    const { builder: previewBuilder } = storybook;
    if (!previewBuilder) {
      throw new MissingBuilderError();
    }
    const { staticDirs } = storybook.options;
    const core = await storybook.callHook('core:config:extend', undefined);
    const manager = createManagerHost(storybook);
    const effects: Promise<void>[] = [];

    if (!cliOptions.previewOnly) {
      await buildOrThrow(async () => manager.build({ startTime: process.hrtime() }));
    }

    if (staticDirs) {
      effects.push(copyAllStaticFilesRelativeToMain(staticDirs, outputDir, configDir));
    }

    const coreServerPublicDir = join(
      resolvePackageDir('@storybook/core', import.meta.url),
      'assets/browser'
    );
    effects.push(cp(coreServerPublicDir, outputDir, { recursive: true, force: true }));

    const hasRegisteredServices = getRegisteredServices().length > 0;
    const staticOutputWriters = await storybook.callHook('server:static-output:collect', []);

    if (hasRegisteredServices || staticOutputWriters.length > 0) {
      effects.push(
        (async () => {
          if (hasRegisteredServices) {
            logger.info('Building open services..');
            await writeOpenServiceStaticFiles(outputDir);
          }

          // Writers may read the open-service snapshots, so they run after those, in order.
          for (const write of staticOutputWriters) {
            await write({ outputDir });
          }
        })()
      );
    }

    effects.push(writeIndexJson(join(outputDir, 'index.json'), storybook.getStoryIndexGenerator()));

    if (!core?.disableProjectJson) {
      effects.push(extractStorybookMetadata(join(outputDir, 'project.json'), configDir));
    }

    logger.info('Building preview..');

    const startTime = process.hrtime();
    const preview = await getPreviewSources(storybook, { hmr: previewBuilder.hmr ?? 'vite' });
    const [previewStats] = await Promise.all([
      previewBuilder
        .build(storybook, { startTime, outDir: outputDir, preview })
        .then((stats) => {
          logger.trace({ message: 'Preview built', time: process.hrtime(startTime) });
          return stats;
        })
        .catch((error) => {
          logger.error('Failed to build the preview');
          process.exitCode = 1;
          throw error;
        }),
      ...effects,
    ]);

    return { outputDir, previewStats };
  });
}
