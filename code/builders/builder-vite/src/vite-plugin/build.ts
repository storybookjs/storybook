import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

import { mapStaticDir, type StoryIndexGenerator } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { basename, join } from 'pathe';
import type { ViteBuilder } from 'vite';

import { buildManager, copyManagerAssets } from './middlewares/manager.ts';

type StaticBuildOptions = {
  basePath: string;
  builder: ViteBuilder;
  options: Options;
  outputDir: string;
};

async function copyStaticDirs(options: Options, outputDir: string): Promise<void> {
  const staticDirs = await options.presets.apply<Array<string | { from: string; to: string }>>(
    'staticDirs',
    []
  );
  const protectedFiles = new Set([join(outputDir, 'index.html'), join(outputDir, 'iframe.html')]);

  for (const dir of staticDirs) {
    const { staticPath, targetEndpoint } = mapStaticDir(dir, options.configDir);
    await cp(staticPath, join(outputDir, targetEndpoint), {
      dereference: true,
      preserveTimestamps: true,
      filter: (_, destination) => !protectedFiles.has(destination),
      recursive: true,
      force: true,
    });
  }
}

export async function buildStaticStorybook({
  basePath,
  builder,
  options,
  outputDir,
}: StaticBuildOptions): Promise<void> {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  options.outputDir = outputDir;

  const storybookEnvironment = builder.environments.storybook;
  if (!storybookEnvironment) {
    throw new TypeError('The Storybook Vite build environment was not created.');
  }
  await builder.build(storybookEnvironment);

  const addonsDir = join(outputDir, 'sb-addons');
  const managerHtml = await buildManager(options, basePath, undefined, addonsDir);
  await writeFile(join(outputDir, 'index.html'), managerHtml);
  await copyManagerAssets(outputDir);

  await copyStaticDirs(options, outputDir);

  try {
    const favicon = await options.presets.apply<string>('favicon');
    await cp(favicon, join(outputDir, basename(favicon)), { force: true });
  } catch (error) {
    logger.warn('Failed to copy the Storybook favicon; continuing the static Storybook build.');
    logger.warn(String(error));
  }

  const storyIndexGenerator =
    await options.presets.apply<StoryIndexGenerator>('storyIndexGenerator');
  const storyIndex = await storyIndexGenerator.getIndex();
  await writeFile(join(outputDir, 'index.json'), JSON.stringify(storyIndex));
}
