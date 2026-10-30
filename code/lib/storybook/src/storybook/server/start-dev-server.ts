import { isWebContainer, versions } from '@storybook/core/internal/common';
import { logger } from '@storybook/core/internal/node-logger';
import type { CreateStorybookInput, Storybook, StorybookDevServer } from '@storybook/core';
import { runWithStorybook } from '@storybook/core/internal/deep/instance/instance-context';
import { TOOLSET_RPC_PROTOCOL_VERSION } from '@storybook/core/internal/deep/shared/open-service/toolset-rpc';

import { storybookDevServer } from './dev-server.ts';
import { getWsToken } from './presets/wsToken.ts';
import { buildOrThrow } from './utils/build-or-throw.ts';
import { attachServerTransport } from './utils/get-server-channel.ts';
import {
  getMcpMetadataFromMainConfig,
  getStorybookBaseUrl,
  type RuntimeInstanceRecord,
  type RuntimeInstanceRegistration,
  writeStorybookRuntimeInstanceRecord,
} from './utils/runtime-instance-registry.ts';
import { getServerAddresses } from './utils/server-address.ts';
import { getServer } from './utils/server-init.ts';
import { serveToolsetRpc } from './utils/toolset-rpc-host.ts';

/** CLI settings the dev server reads, on top of the instance's own. */
export type DevServerCliOptions = NonNullable<CreateStorybookInput['cliOptions']> & {
  /** Where to write the runtime instance record; defaults to the user's registry. */
  runtimeRegistryDir?: string;
};

/** The product dev server, with the manager and preview startup results the CLI reports. */
export interface DevServer extends StorybookDevServer {
  /** Absent with `previewOnly`. */
  managerResult: Awaited<ReturnType<typeof storybookDevServer>>['managerResult'];
  previewResult: Awaited<ReturnType<typeof storybookDevServer>>['previewResult'];
}

/** Serve a ready `mode: 'dev'` instance over HTTP and the channel; resolves once it listens. */
export async function startDevServer(
  storybook: Storybook,
  cliOptions: DevServerCliOptions = {}
): Promise<DevServer> {
  const { port } = cliOptions;
  if (!port) {
    throw new Error('Starting the dev server requires cliOptions.port.');
  }
  const fallback = getServerAddresses(
    port,
    cliOptions.host,
    cliOptions.https ? 'https' : 'http',
    cliOptions.initialPath
  );
  const address = cliOptions.localAddress ?? fallback.address;
  const networkAddress = cliOptions.networkAddress ?? fallback.networkAddress;

  const server = await getServer(cliOptions);
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
    const token = runWithStorybook(storybook, getWsToken);
    const { allowedHosts } = await storybook.callHook('core:config:extend', {});
    transport = attachServerTransport(storybook.channel, server, {
      token,
      host: cliOptions.host,
      allowedHosts,
      skipValidation: isWebContainer(),
      localAddress: address,
      networkAddress,
    });
    disposeToolsetRpc = serveToolsetRpc({
      channel: storybook.channel,
      toolsets: () => storybook.toolsets.values(),
      getService: (serviceId, serviceOptions) =>
        storybook.services.get(serviceId as never, serviceOptions),
      origin: getStorybookBaseUrl(address),
      configDir: storybook.configDir,
    });
    await storybook.callHook('server:channel:ready', storybook.channel);

    const { managerResult, previewResult } = await buildOrThrow(() =>
      storybookDevServer(storybook, server)
    );

    const mcp: RuntimeInstanceRecord['mcp'] = await storybook.callHook(
      'server:mcp:extend',
      getMcpMetadataFromMainConfig(storybook.options.main)
    );

    // Written last, so a client that finds the record can already connect and call.
    registration = await writeStorybookRuntimeInstanceRecord({
      address,
      configDir: cliOptions.configDir ?? storybook.configDir,
      cwd: storybook.workingDir,
      registryDir: cliOptions.runtimeRegistryDir,
      mcp,
      port,
      storybookVersion: cliOptions.storybookVersion ?? versions.storybook,
      token,
      toolsetRpc: TOOLSET_RPC_PROTOCOL_VERSION,
    }).catch((error: unknown) => {
      logger.warn('Storybook failed to write its runtime instance registry record.');
      logger.debug(error instanceof Error ? (error.stack ?? error.message) : String(error));
      return undefined;
    });

    return { port, address, networkAddress, close, managerResult, previewResult };
  } catch (error) {
    await close().catch((closeError: unknown) => {
      logger.debug(String(closeError));
    });
    throw error;
  }
}
