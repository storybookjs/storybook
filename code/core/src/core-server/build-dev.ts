import { readFile } from 'node:fs/promises';

import {
  JsPackageManagerFactory,
  getConfigInfo,
  getInterpretedFile,
  getProjectRoot,
  loadAllPresets,
  loadMainConfig,
  resolveAddonName,
  resolvePathInStorybookCache,
  validateFrameworkName,
  versions,
} from 'storybook/internal/common';
import { deprecate, logger, prompt } from 'storybook/internal/node-logger';
import { MissingBuilderError, NoStatsForViteDevError } from 'storybook/internal/server-errors';
import { oneWayHash, telemetry } from 'storybook/internal/telemetry';
import type { BuilderOptions, CLIOptions, LoadOptions, Options } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { join, relative, resolve } from 'pathe';
import invariant from 'tiny-invariant';
import { dedent } from 'ts-dedent';

import { detectPnp } from '../cli/detect';
import { resolvePackageDir } from '../shared/utils/module';
import { storybookDevServer } from './dev-server';
import { buildOrThrow } from './utils/build-or-throw';
import { getManagerBuilder, getPreviewBuilder } from './utils/get-builders';
import { getServerChannel } from './utils/get-server-channel';
import { outputStartupInformation } from './utils/output-startup-information';
import { outputStats } from './utils/output-stats';
import { getServerChannelUrl, getServerPort } from './utils/server-address';
import { getServer } from './utils/server-init';
import { stripCommentsAndStrings } from './utils/strip-comments-and-strings';
import { updateCheck } from './utils/update-check';
import { warnOnIncompatibleAddons } from './utils/warnOnIncompatibleAddons';
import { warnWhenUsingArgTypesRegex } from './utils/warnWhenUsingArgTypesRegex';

export async function buildDevStandalone(
  options: CLIOptions &
    LoadOptions &
    BuilderOptions & {
      storybookVersion?: string;
      previewConfigPath?: string;
    }
): Promise<{ port: number; address: string; networkAddress: string }> {
  const { packageJson, versionUpdates } = options;
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
      storybookVersion = versions.storybook;
    }
  }
  // updateInfo are cached, so this is typically pretty fast
  const [port, versionCheck] = await Promise.all([
    getServerPort(options.port, { exactPort: options.exactPort }),
    versionUpdates
      ? updateCheck(storybookVersion)
      : Promise.resolve({ success: false, cached: false, data: {}, time: Date.now() }),
  ]);

  if (!options.ci && !options.smokeTest && options.port != null && port !== options.port) {
    const shouldChangePort = await prompt.confirm({
      message: dedent`
        Port ${options.port} is not available. 
        Would you like to run Storybook on port ${port} instead?
      `,
      initialValue: true,
    });
    if (!shouldChangePort) {
      process.exit(1);
    }
  }

  const cacheKey = oneWayHash(relative(getProjectRoot(), configDir));

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

  // TODO: Remove in SB11
  options.pnp = await detectPnp();
  if (options.pnp) {
    deprecate(dedent`
      As of Storybook 10.0, PnP is deprecated.
      If you are using PnP, you can continue to use Storybook 10.0, but we recommend migrating to a different package manager or linker-mode.

      In future versions, PnP compatibility will be removed.
    `);
  }

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

  const packageManager = JsPackageManagerFactory.getPackageManager({
    configDir: options.configDir,
  });

  try {
    await warnOnIncompatibleAddons(storybookVersion, packageManager);
  } catch (e) {
    logger.warn('Storybook failed to check addon compatibility');
    logger.debug(`${e instanceof Error ? e.stack : String(e)}`);
  }

  // TODO: Bring back in 9.x when we officialy launch CSF4
  // We need to consider more scenarios in this function, such as removing addons from main.ts
  // try {
  //   await syncStorybookAddons(config, previewConfigPath!);
  // } catch (e) {}

  try {
    await warnWhenUsingArgTypesRegex(previewConfigPath, config);
  } catch (e) {}

  const server = await getServer(options);
  const channel = getServerChannel(server);

  // Load first pass: We need to determine the builder
  // We need to do this because builders might introduce 'overridePresets' which we need to take into account
  // We hope to remove this in SB8
  let presets = await loadAllPresets({
    corePresets,
    overridePresets: [
      import.meta.resolve('storybook/internal/core-server/presets/common-override-preset'),
    ],
    ...options,
    isCritical: true,
    channel,
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
      deprecate(deprecationMessage);
    }
    const mainJsContent = await readFile(mainJsPath, { encoding: 'utf8' });
    // Regex that matches any CommonJS-specific syntax, stolen from Vite: https://github.com/vitejs/vite/blob/91a18c2f7da796ff8217417a4bf189ddda719895/packages/vite/src/node/ssr/ssrExternal.ts#L87
    const CJS_CONTENT_REGEX =
      /\bmodule\.exports\b|\bexports[.[]|\brequire\s*\(|\bObject\.(?:defineProperty|defineProperties|assign)\s*\(\s*exports\b/;
    const strippedContent = stripCommentsAndStrings(mainJsContent);
    if (CJS_CONTENT_REGEX.test(strippedContent)) {
      deprecate(deprecationMessage);
    }
  }

  const resolvedRenderer = renderer && resolveAddonName(options.configDir, renderer, options);

  // Load second pass: all presets are applied in order
  presets = await loadAllPresets({
    corePresets: [
      join(resolvePackageDir('storybook'), 'dist/core-server/presets/common-preset.js'),
      ...(managerBuilder.corePresets || []),
      ...(previewBuilder.corePresets || []),
      ...(resolvedRenderer ? [resolvedRenderer] : []),
      ...corePresets,
    ],
    overridePresets: [
      ...(previewBuilder.overridePresets || []),
      import.meta.resolve('storybook/internal/core-server/presets/common-override-preset'),
    ],
    ...options,
    channel,
  });

  const features = await presets.apply('features');
  global.FEATURES = features;
  await presets.apply('experimental_serverChannel', channel);

  const fullOptions: Options = {
    ...options,
    presets,
    features,
    channel,
  };

  const { address, networkAddress, managerResult, previewResult } = await buildOrThrow(async () =>
    storybookDevServer(fullOptions, server)
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

    logger.log(problems.map((p) => p.stack).join('\n'));
    process.exit(problems.length > 0 ? 1 : 0);
  } else {
    const name =
      frameworkName.split('@storybook/').length > 1
        ? frameworkName.split('@storybook/')[1]
        : frameworkName;

    if (!options.quiet) {
      outputStartupInformation({
        updateInfo: versionCheck,
        version: storybookVersion,
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
