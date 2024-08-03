import type { BuilderOptions, CLIOptions, LoadOptions, Options } from '@storybook/core/types';
import {
  getProjectRoot,
  loadAllPresets,
  loadMainConfig,
  resolveAddonName,
  resolvePathInStorybookCache,
  serverResolve,
  validateFrameworkName,
} from '@storybook/core/common';
import prompts from 'prompts';
import invariant from 'tiny-invariant';
import { global } from '@storybook/global';
import { oneWayHash, telemetry } from '@storybook/core/telemetry';

import { join, relative, resolve } from 'node:path';
import { deprecate } from '@storybook/core/node-logger';
import { dedent } from 'ts-dedent';
import { readFile } from 'fs-extra';
import { MissingBuilderError, NoStatsForViteDevError } from '@storybook/core/server-errors';
import { storybookDevServer } from './dev-server';
import { outputStats } from './utils/output-stats';
import { outputStartupInformation } from './utils/output-startup-information';
import { updateCheck } from './utils/update-check';
import { getServerChannelUrl, getServerPort } from './utils/server-address';
import { getManagerBuilder, getPreviewBuilder } from './utils/get-builders';
import { warnOnIncompatibleAddons } from './utils/warnOnIncompatibleAddons';
import { warnWhenUsingArgTypesRegex } from './utils/warnWhenUsingArgTypesRegex';
import { buildOrThrow } from './utils/build-or-throw';

export async function buildDevStandalone(
  options: CLIOptions & LoadOptions & BuilderOptions
): Promise<{ port: number; address: string; networkAddress: string }> {
  const { packageJson, versionUpdates } = options;
  invariant(
    packageJson.version !== undefined,
    `Expected package.json#version to be defined in the "${packageJson.name}" package}`
  );
  // updateInfo are cached, so this is typically pretty fast
  const [port, versionCheck] = await Promise.all([
    getServerPort(options.port, { exactPort: options.exactPort }),
    versionUpdates
      ? updateCheck(packageJson.version)
      : Promise.resolve({ success: false, cached: false, data: {}, time: Date.now() }),
  ]);

  if (!options.ci && !options.smokeTest && options.port != null && port !== options.port) {
    const { shouldChangePort } = await prompts({
      type: 'confirm',
      initial: true,
      name: 'shouldChangePort',
      message: `Port ${options.port} is not available. Would you like to run Storybook on port ${port} instead?`,
    });
    if (!shouldChangePort) {
      process.exit(1);
    }
  }

  const rootDir = getProjectRoot();
  const configDir = resolve(options.configDir);
  const cacheKey = oneWayHash(relative(rootDir, configDir));

  const cacheOutputDir = resolvePathInStorybookCache('public', cacheKey);
  let outputDir = resolve(options.outputDir || cacheOutputDir);
  if (options.smokeTest) {
    outputDir = cacheOutputDir;
  }

  options.port = port;
  options.versionCheck = versionCheck;
  options.configType = 'DEVELOPMENT';
  options.configDir = configDir;
  options.cacheKey = cacheKey;
  options.outputDir = outputDir;
  options.serverChannelUrl = getServerChannelUrl(port, options);

  const config = await loadMainConfig(options);
  const { framework } = config;
  const corePresets = [];

  let frameworkName = typeof framework === 'string' ? framework : framework?.name;
  if (!options.ignorePreview) {
    validateFrameworkName(frameworkName);
  }
  if (frameworkName) {
    corePresets.push(join(frameworkName, 'preset'));
  }

  frameworkName = frameworkName || 'custom';

  try {
    await warnOnIncompatibleAddons(packageJson.version);
  } catch (e) {
    console.warn('Storybook failed to check addon compatibility', e);
  }

  try {
    await warnWhenUsingArgTypesRegex(packageJson, configDir, config);
  } catch (e) {}

  // Load first pass: We need to determine the builder
  // We need to do this because builders might introduce 'overridePresets' which we need to take into account
  // We hope to remove this in SB8
  let presets = await loadAllPresets({
    corePresets,
    overridePresets: [
      require.resolve('@storybook/core/core-server/presets/common-override-preset'),
    ],
    ...options,
    isCritical: true,
  });

  const { renderer, builder, disableTelemetry } = await presets.apply('core', {});

  if (!builder) {
    throw new MissingBuilderError();
  }

  if (!options.disableTelemetry && !disableTelemetry) {
    if (versionCheck.success && !versionCheck.cached) {
      telemetry('version-update');
    }
  }

  const builderName = typeof builder === 'string' ? builder : builder.name;
  const [previewBuilder, managerBuilder] = await Promise.all([
    getPreviewBuilder(builderName, options.configDir),
    getManagerBuilder(),
  ]);

  if (builderName.includes('builder-vite')) {
    const deprecationMessage =
      dedent(`Using CommonJS in your main configuration file is deprecated with Vite.
              - Refer to the migration guide at https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#commonjs-with-vite-is-deprecated`);

    const mainJsPath = serverResolve(resolve(options.configDir || '.storybook', 'main')) as string;
    if (/\.c[jt]s$/.test(mainJsPath)) {
      deprecate(deprecationMessage);
    }
    const mainJsContent = await readFile(mainJsPath, 'utf-8');
    // Regex that matches any CommonJS-specific syntax, stolen from Vite: https://github.com/vitejs/vite/blob/91a18c2f7da796ff8217417a4bf189ddda719895/packages/vite/src/node/ssr/ssrExternal.ts#L87
    const CJS_CONTENT_REGEX =
      /\bmodule\.exports\b|\bexports[.[]|\brequire\s*\(|\bObject\.(?:defineProperty|defineProperties|assign)\s*\(\s*exports\b/;
    if (CJS_CONTENT_REGEX.test(mainJsContent)) {
      deprecate(deprecationMessage);
    }
  }

  const resolvedRenderer = renderer && resolveAddonName(options.configDir, renderer, options);

  // Load second pass: all presets are applied in order
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
  });

  const features = await presets.apply('features');
  global.FEATURES = features;

  const fullOptions: Options = {
    ...options,
    presets,
    features,
  };

  const { address, networkAddress, managerResult, previewResult } = await buildOrThrow(async () =>
    storybookDevServer(fullOptions)
  );

  const previewTotalTime = previewResult?.totalTime;
  const managerTotalTime = managerResult?.totalTime;
  const previewStats = previewResult?.stats;
  const managerStats = managerResult?.stats;

  const statsOption = options.webpackStatsJson || options.statsJson;
  if (statsOption) {
    const target = statsOption === true ? options.outputDir : statsOption;

    await outputStats(target, previewStats);
  }

  if (options.smokeTest) {
    const warnings: Error[] = [];
    warnings.push(...(managerStats?.toJson()?.warnings || []));
    try {
      warnings.push(...(previewStats?.toJson()?.warnings || []));
    } catch (err) {
      if (err instanceof NoStatsForViteDevError) {
        // pass, the Vite builder has no warnings in the stats object anyway,
        // but no stats at all in dev mode
      } else {
        throw err;
      }
    }

    const problems = warnings
      .filter((warning) => !warning.message.includes(`export 'useInsertionEffect'`))
      .filter((warning) => !warning.message.includes(`compilation but it's unused`))
      .filter(
        (warning) => !warning.message.includes(`Conflicting values for 'process.env.NODE_ENV'`)
      );

    console.log(problems.map((p) => p.stack));
    process.exit(problems.length > 0 ? 1 : 0);
  } else {
    const name =
      frameworkName.split('@storybook/').length > 1
        ? frameworkName.split('@storybook/')[1]
        : frameworkName;

    if (!options.quiet) {
      outputStartupInformation({
        updateInfo: versionCheck,
        version: packageJson.version,
        name,
        address,
        networkAddress,
        managerTotalTime,
        previewTotalTime,
      });
    }
  }
  return { port, address, networkAddress };
}
