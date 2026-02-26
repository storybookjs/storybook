import { readFile } from 'node:fs/promises';

import {
  getConfigInfo,
  getInterpretedFile,
  loadAllPresets,
  loadMainConfig,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { MissingBuilderError } from 'storybook/internal/server-errors';
import type { BuilderOptions, LoadOptions, StoryRunOptions } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { join, resolve } from 'pathe';
import { chromium } from 'playwright-core';
import invariant from 'tiny-invariant';
import { dedent } from 'ts-dedent';

import { detectPnp } from '../cli/detect';
import { resolvePackageDir } from '../shared/utils/module';
import { storybookDevServer } from './dev-server';
import { RunStoryChannel } from './server-channel/run-story-channel';
import { StoryRunner } from './story-runner';
import { buildOrThrow } from './utils/build-or-throw';
import { getManagerBuilder, getPreviewBuilder } from './utils/get-builders';
import { RunReporter } from './utils/run-reporter';
import { getServerChannelUrl, getServerPort } from './utils/server-address';
import { stripCommentsAndStrings } from './utils/strip-comments-and-strings';

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

  const port = await getServerPort(options.port);
  options.port = port;
  options.configType = 'DEVELOPMENT';
  options.configDir = configDir;
  options.serverChannelUrl = getServerChannelUrl(port, options);

  // TODO: Remove in SB11
  options.pnp = await detectPnp();

  const config = await loadMainConfig(options);
  const { framework } = config;
  const corePresets: string[] = [];

  const frameworkName = (typeof framework === 'string' ? framework : framework?.name) || 'custom';

  // Load first pass: We need to determine the builder
  let presets = await loadAllPresets({
    corePresets,
    overridePresets: [
      import.meta.resolve('storybook/internal/core-server/presets/common-override-preset'),
    ],
    ...options,
    isCritical: true,
  });

  const { renderer, builder } = await presets.apply('core', {});

  if (!builder) {
    throw new MissingBuilderError();
  }

  const resolvedPreviewBuilder = typeof builder === 'string' ? builder : builder.name;
  const [previewBuilder, managerBuilder] = await Promise.all([
    getPreviewBuilder(resolvedPreviewBuilder),
    getManagerBuilder(),
  ]);

  if (resolvedPreviewBuilder.includes('builder-vite')) {
    const deprecationMessage =
      dedent(`Using CommonJS in your main configuration file is deprecated with Vite.
              - Refer to the migration guide at https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#commonjs-with-vite-is-deprecated`);

    const mainJsPath = getInterpretedFile(
      resolve(options.configDir || '.storybook', 'main')
    ) as string;
    if (/\.c[jt]s$/.test(mainJsPath)) {
      logger.warn(deprecationMessage);
    }
    const mainJsContent = await readFile(mainJsPath, { encoding: 'utf8' });
    const CJS_CONTENT_REGEX =
      /\bmodule\.exports\b|\bexports[.[]|\brequire\s*\(|\bObject\.(?:defineProperty|defineProperties|assign)\s*\(\s*exports\b/;
    const strippedContent = stripCommentsAndStrings(mainJsContent);
    if (CJS_CONTENT_REGEX.test(strippedContent)) {
      logger.warn(deprecationMessage);
    }
  }

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
  const runResult = await storyRunner.run();

  // --keep-open handling
  if (options.keepOpen) {
    await new Promise<void>((resolve) => {
      process.once('SIGINT', resolve);
    });
  }

  // Exit
  process.exit(runResult.failed > 0 || runResult.skipped > 0 ? 1 : 0);
}
