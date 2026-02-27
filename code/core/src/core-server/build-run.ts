import { getConfigInfo, loadAllPresets, loadMainConfig } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { BuilderOptions, LoadOptions, StoryRunOptions } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { join, resolve } from 'pathe';
import { chromium } from 'playwright-core';
import invariant from 'tiny-invariant';
import { dedent } from 'ts-dedent';

import { resolvePackageDir } from '../shared/utils/module';
import { storybookDevServer } from './dev-server';
import { RunStoryChannel } from './server-channel/run-story-channel';
import { StoryRunner } from './story-runner';
import { buildOrThrow } from './utils/build-or-throw';
import { getManagerBuilder, getPreviewBuilder } from './utils/get-builders';
import { RunReporter } from './utils/run-reporter';
import { getServerChannelUrl, getServerPort } from './utils/server-address';

export async function buildRunStandalone(
  options: StoryRunOptions &
    LoadOptions &
    BuilderOptions & {
      storybookVersion?: string;
      previewConfigPath?: string;
    }
): Promise<void> {
  // Flag contract validation
  console.log('Starting Storybook run with options:', options);
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

  console.log('Initializing Storybook run...');

  // Playwright preflight
  try {
    chromium.executablePath();
  } catch (_) {
    logger.error(
      dedent`
        Error: No Chromium browser found for storybook run.
        Run the following command once to install it:
          npx playwright install chromium
      `
    );
    process.exit(1);
  }

  console.log('Chromium browser found, proceeding with Storybook run...');

  const { packageJson } = options;
  let { storybookVersion, previewConfigPath } = options;
  const configDir = resolve(options.configDir);
  if (packageJson) {
    invariant(
      packageJson.version !== undefined,
      `Expected package.json#version to be defined in the "${packageJson.name}" package}`
    );
    storybookVersion = packageJson.version;
    previewConfigPath = getConfigInfo(configDir).previewConfigPath ?? undefined;
  } else {
    if (!storybookVersion) {
      storybookVersion = '0.0.0';
    }
  }

  console.log(`Using Storybook version: ${storybookVersion}`);

  const port = await getServerPort(options.port);
  options.port = port;
  options.configType = 'DEVELOPMENT';
  options.configDir = configDir;
  options.serverChannelUrl = getServerChannelUrl(port, options);

  const config = await loadMainConfig(options);
  const { framework } = config;
  const corePresets: string[] = [];

  const frameworkName = (typeof framework === 'string' ? framework : framework?.name) || 'custom';

  console.log(`Detected framework: ${frameworkName}`);

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

  console.log('Initial presets loaded, determining builder...');

  const core = await presets.apply('core', {});
  console.log({ core });

  console.log({ options });
  const builder = core.builder;

  console.log(`Using builder: ${typeof builder === 'string' ? builder : builder?.name}`);

  const resolvedPreviewBuilder = typeof builder === 'string' ? builder : builder.name;
  const [previewBuilder, managerBuilder] = await Promise.all([
    getPreviewBuilder(resolvedPreviewBuilder),
    getManagerBuilder(),
  ]);

  console.log(
    'Preview and manager builders resolved, checking for CommonJS usage in main config...'
  );

  // Load second pass: all presets are applied in order
  presets = await loadAllPresets({
    corePresets: [
      join(resolvePackageDir('storybook'), 'dist/core-server/presets/common-preset.js'),
      ...(managerBuilder.corePresets || []),
      ...(previewBuilder.corePresets || []),
      ...corePresets,
    ],
    overridePresets: [
      ...(previewBuilder.overridePresets || []),
      import.meta.resolve('storybook/internal/core-server/presets/common-override-preset'),
    ],
    ...options,
  });

  console.log('All presets loaded successfully.');

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
