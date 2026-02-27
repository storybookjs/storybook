import { getConfigInfo, loadAllPresets, loadMainConfig } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type {
  BuilderOptions,
  LoadOptions,
  StoryIndex,
  StoryRunOptions,
} from 'storybook/internal/types';

import { global } from '@storybook/global';

import { join, resolve } from 'pathe';
import { chromium } from 'playwright-core';
import { dedent } from 'ts-dedent';

import { resolvePackageDir } from '../shared/utils/module';
import { storybookDevServer } from './dev-server';
import { RunStoryChannel } from './server-channel/run-story-channel';
import { StoryRunner } from './story-runner';
import { buildOrThrow } from './utils/build-or-throw';
import { getPreviewBuilder } from './utils/get-builders';
import { RunReporter } from './utils/run-reporter';
import { getServerChannelUrl, getServerPort } from './utils/server-address';

async function resolveStoryInputs(
  inputs: string[],
  serverAddress: string,
  cwd: string
): Promise<string[]> {
  const isFilePathInput = (input: string) =>
    input.includes('/') ||
    input.includes('\\') ||
    ['.stories.ts', '.stories.tsx', '.stories.js', '.stories.jsx', '.stories.mdx'].some((suffix) =>
      input.endsWith(suffix)
    );

  const fileInputs = inputs.filter(isFilePathInput);
  if (fileInputs.length === 0) {
    return inputs;
  }

  const response = await fetch(`${serverAddress}index.json`);
  if (!response.ok) {
    logger.error(`✗ Failed to load story index from ${serverAddress}index.json`);
    process.exit(1);
  }
  const storyIndex = (await response.json()) as StoryIndex;

  const resolvedIds: string[] = inputs.filter((input) => !isFilePathInput(input));

  for (const input of fileInputs) {
    const resolvedInput = resolve(cwd, input);
    const entriesForPath = Object.values(storyIndex.entries).filter((entry) =>
      entry.importPath ? resolve(cwd, entry.importPath) === resolvedInput : false
    );
    const storyEntries = entriesForPath.filter((entry) => entry.type === 'story');
    const docsEntries = entriesForPath.filter((entry) => entry.type === 'docs');

    if (storyEntries.length > 0) {
      resolvedIds.push(...storyEntries.map((entry) => entry.id));
    } else if (docsEntries.length > 0) {
      logger.warn(`Skipping docs-only file: ${input}`);
    } else {
      logger.error(`✗ ${input} — no stories found for this file`);
      process.exit(1);
    }
  }

  const dedupedIds = [...new Set(resolvedIds)];
  if (dedupedIds.length === 0) {
    logger.error('✗ No stories found for the provided inputs');
    process.exit(1);
  }

  return dedupedIds;
}

export async function buildRunStandalone(
  options: StoryRunOptions &
    LoadOptions &
    BuilderOptions & {
      storybookVersion?: string;
      previewConfigPath?: string;
    }
): Promise<void> {
  // Flag contract validation
  if (options.previewUrl || options.forceBuildPreview || options.smokeTest) {
    const unsupportedFlags = [];
    if (options.previewUrl) {
      unsupportedFlags.push('--preview-url');
    }
    if (options.forceBuildPreview) {
      unsupportedFlags.push('--force-build-preview');
    }
    if (options.smokeTest) {
      unsupportedFlags.push('--smoke-test');
    }

    logger.error(
      dedent`
        The following flags are not supported with 'storybook run':
        ${unsupportedFlags.map((f) => `  - ${f}`).join('\n')}
      `
    );
    process.exit(1);
  }

  // Playwright preflight
  try {
    chromium.executablePath();
  } catch {
    logger.error(
      dedent`
        Error: No Chromium browser found for storybook run.
        Run the following command once to install it:
          npx playwright install chromium
      `
    );
    process.exit(1);
  }

  const configDir = resolve(options.configDir);

  const port = await getServerPort(options.port);
  options.port = port;
  options.configType = 'DEVELOPMENT';
  options.configDir = configDir;
  options.serverChannelUrl = getServerChannelUrl(port, options);

  const config = await loadMainConfig(options);
  const { framework } = config;
  const corePresets: string[] = [];

  const frameworkName = (typeof framework === 'string' ? framework : framework?.name) || 'custom';

  if (frameworkName) {
    corePresets.push(join(frameworkName, 'preset'));
  }

  // Load first pass: We need to determine the builder
  let presets = await loadAllPresets({
    corePresets,
    overridePresets: [
      import.meta.resolve('storybook/internal/core-server/presets/common-override-preset'),
    ],
    ...options,
    isCritical: true,
  });

  const core = await presets.apply('core', {});
  const builder = core.builder;

  const resolvedPreviewBuilder = typeof builder === 'string' ? builder : builder.name;
  const [previewBuilder] = await Promise.all([getPreviewBuilder(resolvedPreviewBuilder)]);

  // Load second pass: all presets are applied in order
  presets = await loadAllPresets({
    corePresets: [
      join(resolvePackageDir('storybook'), 'dist/core-server/presets/common-preset.js'),
      ...(previewBuilder.corePresets || []),
      ...corePresets,
    ],
    overridePresets: [
      ...(previewBuilder.overridePresets || []),
      import.meta.resolve('storybook/internal/core-server/presets/common-override-preset'),
    ],
    ...options,
  });

  const features = await presets.apply('features');
  global.FEATURES = features;

  const fullOptions = {
    ...options,
    presets,
    features,
    previewOnly: true,
  } as unknown as typeof options & { presets: typeof presets; features: typeof features };

  const { address, serverChannel } = await buildOrThrow(async () =>
    storybookDevServer(fullOptions)
  );

  options.storyIds = await resolveStoryInputs(options.storyIds, address, process.cwd());

  // Instantiate components
  const runStoryChannel = new RunStoryChannel(serverChannel);
  const reporter = new RunReporter({ json: options.json });
  const storyRunner = new StoryRunner(options, address, runStoryChannel, reporter);

  // Await run
  try {
    const runResult = await storyRunner.run();

    // --keep-open handling
    if (options.keepOpen) {
      await new Promise<void>((resolve) => {
        process.once('SIGINT', resolve);
      });
    }

    // Exit
    process.exit(runResult.failed > 0 || runResult.skipped > 0 ? 1 : 0);
  } catch (err) {
    logger.error(`Error during Storybook run: ${err instanceof Error ? err.message : String(err)}`);
  }
}
