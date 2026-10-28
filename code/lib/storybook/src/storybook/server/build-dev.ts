import './hooks.ts';

import { readFile } from 'node:fs/promises';

import {
  JsPackageManagerFactory,
  cache,
  getConfigInfo,
  getInterpretedFile,
  getProjectRoot,
  isWebContainer,
  resolvePathInStorybookCache,
  versions,
} from '@storybook/core/internal/common';
import { CLI_COLORS, deprecate, logger, prompt } from '@storybook/core/internal/node-logger';
import { isStorybookError } from '@storybook/core/internal/server-errors';
import { detectAgent, oneWayHash, telemetry } from '@storybook/core/internal/telemetry';
import type { BuilderOptions, CLIOptions, LoadOptions } from '@storybook/core/internal/types';

import { relative, resolve } from 'pathe';
import { dedent, invariant } from '@storybook/core/internal/deep/utils/node-libs';

import { createStorybook, type Storybook } from 'storybook/internal/instance';
import { runWithStorybook } from '@storybook/core/internal/deep/instance/instance-context';
import { storybookDevServer } from './dev-server.ts';
import { getWsToken } from './presets/wsToken.ts';
import { buildOrThrow } from './utils/build-or-throw.ts';
import { attachServerTransport } from './utils/get-server-channel.ts';
import { serveToolsetRpc } from './utils/toolset-rpc-host.ts';
import { TOOLSET_RPC_PROTOCOL_VERSION } from '@storybook/core/internal/deep/shared/open-service/toolset-rpc';
import { warnOnDisabledHostValidation } from './utils/host-validation-warning.ts';
import { outputStartupInformation } from './utils/output-startup-information.ts';
import { outputStats } from './utils/output-stats.ts';
import {
  getMcpMetadataFromMainConfig,
  getStorybookBaseUrl,
  type RuntimeInstanceRecord,
  type RuntimeInstanceRegistration,
  writeStorybookRuntimeInstanceRecord,
} from './utils/runtime-instance-registry.ts';
import { getServerAddresses, getServerChannelUrl, getServerPort } from './utils/server-address.ts';
import { getServer } from './utils/server-init.ts';
import { stripCommentsAndStrings } from '@storybook/core/internal/deep/story-index/strip-comments-and-strings';
import { updateCheck } from './utils/update-check.ts';
import { warnOnIncompatibleAddons } from './utils/warnOnIncompatibleAddons.ts';
import { warnWhenUsingArgTypesRegex } from './utils/warnWhenUsingArgTypesRegex.ts';

/**
 * Resolves the initialPath for the browser open URL.
 * CLI-provided initialPath always wins. If not set and not running in an agent context,
 * checks the project cache for an `onboarding-pending` entry written by `storybook init`.
 * If found, returns '/onboarding' and removes the cache entry so it only triggers once.
 * The cache entry is only written by init when onboarding is known to be supported,
 * so no further addon check is needed here.
 */
export async function resolveOnboardingInitialPath(
  cliInitialPath: string | undefined
): Promise<string | undefined> {
  if (cliInitialPath || detectAgent()) {
    // Explicit CLI flag wins; leave cache intact for next run.
    // Agent environments skip onboarding (no browser to open).
    return cliInitialPath;
  }
  const onboardingPending = await cache.get('onboarding-pending').catch(() => {});
  if (onboardingPending) {
    try {
      await cache.remove('onboarding-pending');
    } catch {}
    return '/onboarding';
  }
  return undefined;
}

/**
 * Start a Storybook dev server and resolve once it is listening.
 *
 * It never exits the process or installs signal handlers: in smoke-test mode it closes the server
 * and resolves with `exitCode`, otherwise the caller owns `close()` (see `exitOnDevServerSignal`).
 */
export async function buildDevStandalone(
  options: CLIOptions &
    LoadOptions &
    BuilderOptions & {
      storybookVersion?: string;
      previewConfigPath?: string;
      runtimeRegistryDir?: string;
      workingDir?: string;
    }
): Promise<{
  port: number;
  address: string;
  networkAddress: string;
  storybook: Storybook;
  close(): Promise<void>;
  exitCode?: number;
}> {
  const { packageJson, versionUpdates } = options;
  let { storybookVersion, previewConfigPath } = options;
  const workingDir = resolve(options.workingDir ?? process.cwd());
  const configDir = resolve(workingDir, options.configDir);
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
    const shouldChangePort = await prompt.confirm(
      {
        message: dedent`
        Port ${options.port} is not available. 
        Would you like to run Storybook on port ${port} instead?
      `,
        initialValue: true,
      },
      {
        onCancel: () => {
          throw new Error('Storybook startup canceled.');
        },
      }
    );
    if (!shouldChangePort) {
      throw new Error('Storybook startup canceled because the requested port is unavailable.');
    }
  }

  const cacheKey = oneWayHash(relative(getProjectRoot(), configDir));

  // Resolve initialPath: CLI flag takes precedence; fall back to onboarding-pending cache entry.
  invariant(port, 'expected options to have a port');
  options.initialPath = await resolveOnboardingInitialPath(options.initialPath);

  const { address: localAddress, networkAddress } = getServerAddresses(
    port,
    options.host,
    options.https ? 'https' : 'http',
    options.initialPath
  );

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
  options.localAddress = localAddress;
  options.networkAddress = networkAddress;

  const server = await getServer(options);
  let storybook: Storybook | undefined;
  let registration: RuntimeInstanceRegistration | undefined;
  let transport: ReturnType<typeof attachServerTransport> | undefined;
  let disposeToolsetRpc: (() => void) | undefined;
  let closePromise: Promise<void> | undefined;

  function close(): Promise<void> {
    closePromise ??= (async () => {
      disposeToolsetRpc?.();
      transport?.close();
      const results = await Promise.allSettled([
        new Promise<void>((resolveClose, rejectClose) => {
          server.close((error) => {
            if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') {
              rejectClose(error);
            } else {
              resolveClose();
            }
          });
          server.closeAllConnections();
        }),
        storybook?.close(),
        registration?.cleanup(),
      ]);
      const errors = results.filter((result) => result.status === 'rejected');
      if (errors.length) {
        throw new AggregateError(
          errors.map((result) => result.reason),
          'Dev server cleanup failed.'
        );
      }
    })();
    return closePromise;
  }

  try {
    storybook = await createStorybook({
      configDir,
      workingDir,
      mode: 'dev',
      cliOptions: options,
    });
    const token = runWithStorybook(storybook, getWsToken);
    const { framework, main } = storybook.options;
    const config = {
      ...main,
      framework: undefined,
      addons: main.addons?.flatMap((addon) =>
        typeof addon === 'object' && 'meta' in addon ? [] : [addon]
      ),
    };
    const frameworkName =
      (typeof framework === 'string'
        ? framework
        : framework && 'meta' in framework
          ? framework.meta.name
          : framework?.name) || 'custom';
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
    } catch {}

    const { allowedHosts } = await storybook.callHook('core:config:extend', {});

    await warnOnDisabledHostValidation({
      host: options.host,
      allowedHosts,
      ci: options.ci,
      smokeTest: options.smokeTest,
      cacheKey,
    });

    if (versionCheck.success && !versionCheck.cached) {
      telemetry('version-update');
    }

    const resolvedPreviewBuilder = storybook.builder?.meta.name ?? '';
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

    transport = attachServerTransport(storybook.channel, server, {
      token,
      host: options.host,
      allowedHosts,
      skipValidation: isWebContainer(),
      localAddress,
      networkAddress,
    });
    const host = storybook;
    disposeToolsetRpc = serveToolsetRpc({
      channel: host.channel,
      toolsets: () => host.toolsets.values(),
      getService: (serviceId, serviceOptions) =>
        host.services.get(serviceId as never, serviceOptions),
      origin: getStorybookBaseUrl(localAddress),
      configDir: host.configDir,
    });
    await storybook.callHook('server:channel:ready', storybook.channel);

    const { managerResult, previewResult } = await buildOrThrow(() =>
      storybookDevServer(storybook!, server)
    );

    const mcp: RuntimeInstanceRecord['mcp'] = await storybook.callHook(
      'server:mcp:extend',
      getMcpMetadataFromMainConfig(main)
    );

    registration = await writeStorybookRuntimeInstanceRecord({
      address: localAddress,
      configDir: options.configDir,
      cwd: workingDir,
      registryDir: options.runtimeRegistryDir,
      mcp,
      port,
      storybookVersion,
      token,
      toolsetRpc: TOOLSET_RPC_PROTOCOL_VERSION,
    }).catch((error: unknown) => {
      logger.warn('Storybook failed to write its runtime instance registry record.');
      logger.debug(error instanceof Error ? (error.stack ?? error.message) : String(error));
      return undefined;
    });

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
        if (isStorybookError(err, 'NoStatsForViteDevError')) {
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

      if (problems.length > 0) {
        logger.error('Smoke tests failed.');
        logger.log(problems.map((p) => p.stack).join('\n'));
      } else {
        logger.step(CLI_COLORS.success('Smoke tests passed, exiting.'));
      }
      logger.outro('');
      await close();
      return {
        port,
        address: localAddress,
        networkAddress,
        storybook,
        close,
        exitCode: problems.length > 0 ? 1 : 0,
      };
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
          address: localAddress,
          host: options.host,
          networkAddress,
          allowedHosts,
          managerTotalTime,
          previewTotalTime,
        });
      }
    }
    return { port, address: localAddress, networkAddress, storybook, close };
  } catch (error) {
    await close();
    throw error;
  }
}
