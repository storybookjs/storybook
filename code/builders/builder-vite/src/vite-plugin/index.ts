import EventEmitter from 'node:events';
import { rmSync } from 'node:fs';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';

import { SERVER_CHANNEL_PATH, type Channel } from 'storybook/internal/channels';
import {
  loadMainConfig,
  optionalEnvToBoolean,
  resolvePathInStorybookCache,
  versions,
} from 'storybook/internal/common';
import {
  buildStaticStandalone,
  createStorybookApp,
  experimental_loadStorybook,
  getMcpMetadataFromMainConfig,
  getServerChannel,
  getWsToken,
  internal_universalStatusStore,
  internal_universalTestProviderStore,
  type StorybookApp,
  withTelemetry,
  writeStorybookRuntimeInstanceRecord,
} from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import polka, { type Polka } from 'polka';
import { resolve } from 'pathe';
import type {
  ConfigEnv,
  HmrOptions,
  PluginOption,
  UserConfig,
  HttpServer as ViteHttpServer,
  ViteBuilder,
} from 'vite';

import { normalizeBase } from './base.ts';
import { PLUGIN_NAME } from './constants.ts';
import { createPrefixGuard, type PrefixHandler } from './prefix-guard.ts';
import type { VitePluginPresetOptions } from './preset.ts';
import type { UserOptions } from './types.ts';

export type { UserOptions as experimental_VitePluginUserOptions } from './types.ts';

/** The one Storybook a process serves, shared by every host server Vite creates on restart. */
type PluginProcess = {
  configDir: string;
  /** Receives the server-channel upgrades of every host server. */
  upgradeEmitter: EventEmitter;
  channel: Channel;
  app: Promise<EmbeddedStorybook>;
};

type EmbeddedStorybook = {
  storybook: StorybookApp;
  options: Options;
  mcp: ReturnType<typeof getMcpMetadataFromMainConfig>;
  /** Router the running preview is mounted on, replaced together with the preview. */
  previewRouter: Polka;
  preview: RunningPreview;
};

type RunningPreview = {
  /** The host HTTP server the preview attached its HMR WebSocket to. */
  server: HttpServer;
  bail: () => Promise<void>;
};

type ChannelOptions = Omit<Parameters<typeof getServerChannel>[1], 'token'>;

declare global {
  var STORYBOOK_VITE_PLUGIN_PROCESS: PluginProcess | undefined;
}

const HMR_PATH = '/__storybook-hmr';

// The plugin is bundled into `dist/index.js`, while the preset is its own `dist/vite-plugin/` entry.
const PRESET_PATH = new URL(
  import.meta.url.endsWith('.ts') ? './preset.ts' : './vite-plugin/preset.js',
  import.meta.url
).href;

/** Serves Storybook from the host Vite dev server under `base`, or builds it in `storybook` mode. */
export function experimental_vitePlugin(options?: UserOptions): PluginOption {
  const base = normalizeBase(options?.base);
  const configDir = resolve(options?.configDir ?? '.storybook');
  const outputDir = options?.outputDir ?? './storybook-static';
  const telemetryOptions = {
    cliOptions: {
      configDir,
      disableTelemetry: optionalEnvToBoolean(process.env.STORYBOOK_DISABLE_TELEMETRY),
    },
    skipPrompt: true,
  };

  return {
    name: PLUGIN_NAME,
    apply: applyToStorybookOnly,

    config(_, { command, mode }): UserConfig {
      if (!(command === 'build' && mode === 'storybook')) {
        return {};
      }
      return {
        builder: {
          buildApp: async (builder: ViteBuilder): Promise<void> => {
            await withTelemetry('build', telemetryOptions, () =>
              buildStaticStandalone({
                configDir,
                outputDir: resolve(builder.config.root, outputDir),
              })
            );
            // Storybook's build already ran; this stops Vite from also building the host environments.
            for (const environment of Object.values(builder.environments)) {
              environment.isBuilt = true;
            }
          },
        },
      };
    },

    async configureServer(host): Promise<void> {
      const upgradeServer = host.httpServer ?? hmrServerOf(host.config.server.hmr);
      if (!upgradeServer) {
        throw new Error(
          'The Storybook Vite plugin needs the host HTTP server to attach its WebSockets. When Vite runs in middleware mode, pass your server as `server.hmr.server`.'
        );
      }
      // Vite's type also admits an HTTP/2 server, which Storybook's builders do not take.
      const server = upgradeServer as HttpServer;
      const basePath = host.config.mode === 'storybook' || base === '/' ? '/' : `${base}/`;
      const { allowedHosts } = host.config.server;
      const listenHost = toListenHost(host.config.server.host);

      await withTelemetry('dev', telemetryOptions, async () => {
        const pluginProcess = getPluginProcess(
          configDir,
          { allowedHosts, host: listenHost },
          (channel) =>
            loadEmbeddedStorybook({
              configDir,
              channel,
              server,
              host: listenHost,
              vitePlugin: { base: basePath, hmrPath: HMR_PATH, allowedHosts },
            })
        );
        forwardServerChannelUpgrades(upgradeServer, pluginProcess.upgradeEmitter);

        const embedded = await pluginProcess.app;
        if (embedded.preview.server !== server) {
          await embedded.preview.bail();
          embedded.previewRouter = polka();
          embedded.preview = await startPreview(embedded, server, pluginProcess.channel);
        }
        const { preview } = embedded;
        upgradeServer.once('close', () => {
          void preview.bail();
        });

        const register = (): void => {
          void registerRuntimeInstance(
            upgradeServer,
            embedded,
            basePath,
            !!host.config.server.https
          );
        };
        if (upgradeServer.listening) {
          register();
        } else {
          upgradeServer.once('listening', register);
        }

        host.middlewares.use(
          createPrefixGuard(basePath, embedded.storybook.app.handler as PrefixHandler)
        );
      });
    },
  };
}

function applyToStorybookOnly(_: UserConfig, env: ConfigEnv): boolean {
  // Vitest loads the host config in `test` mode, where no Storybook server must start.
  if (env.mode === 'test' || env.isPreview) {
    return false;
  }
  return env.command === 'serve' || env.mode === 'storybook';
}

function getPluginProcess(
  configDir: string,
  channelOptions: ChannelOptions,
  load: (channel: Channel) => Promise<EmbeddedStorybook>
): PluginProcess {
  const existing = globalThis.STORYBOOK_VITE_PLUGIN_PROCESS;
  if (existing) {
    if (existing.configDir !== configDir) {
      throw new Error(
        `The Storybook Vite plugin is already running for '${existing.configDir}' in this process, ` +
          `so it cannot also serve '${configDir}'. Run each Storybook in its own dev-server process.`
      );
    }
    return existing;
  }

  const upgradeEmitter = new EventEmitter();
  const channel = getServerChannel(upgradeEmitter, { ...channelOptions, token: getWsToken() });
  const pluginProcess: PluginProcess = { configDir, upgradeEmitter, channel, app: load(channel) };
  globalThis.STORYBOOK_VITE_PLUGIN_PROCESS = pluginProcess;
  // A failed load must not be cached: the next `configureServer` retries it.
  pluginProcess.app.catch(() => {
    if (globalThis.STORYBOOK_VITE_PLUGIN_PROCESS === pluginProcess) {
      globalThis.STORYBOOK_VITE_PLUGIN_PROCESS = undefined;
    }
  });
  return pluginProcess;
}

async function loadEmbeddedStorybook({
  configDir,
  channel,
  server,
  host,
  vitePlugin,
}: {
  configDir: string;
  channel: Channel;
  server: HttpServer;
  host: string | undefined;
  vitePlugin: VitePluginPresetOptions['vitePlugin'];
}): Promise<EmbeddedStorybook> {
  const options = await experimental_loadStorybook({
    configDir,
    channel,
    host,
    overridePresets: [{ name: PRESET_PATH, options: { vitePlugin } }],
  });
  // `cacheKey` is computed while loading, so the CLI's dev cache directory can only be set after.
  options.outputDir = resolvePathInStorybookCache('public', options.cacheKey);

  // Accessing actors creates the server-side leaders.
  void internal_universalStatusStore.actor;
  void internal_universalTestProviderStore.actor;
  await options.presets.apply('experimental_serverChannel', channel);

  const previewRouter = polka();
  const storybook = await createStorybookApp(options, server, previewRouter);
  const embedded: EmbeddedStorybook = {
    storybook,
    options,
    mcp: getMcpMetadataFromMainConfig(await loadMainConfig({ configDir })),
    previewRouter,
    preview: { server, bail: bailOf(storybook, storybook.previewResult) },
  };
  storybook.app.use((req, res) => {
    (embedded.previewRouter.handler as PrefixHandler)(req, res);
  });
  return embedded;
}

async function startPreview(
  embedded: EmbeddedStorybook,
  server: HttpServer,
  channel: Channel
): Promise<RunningPreview> {
  const previewResult = await embedded.storybook.previewBuilder.start({
    startTime: process.hrtime(),
    options: embedded.options,
    router: embedded.previewRouter,
    server,
    channel,
  });
  return { server, bail: bailOf(embedded.storybook, previewResult) };
}

/** A builder whose `start` returns no handle is closed through its module-level `bail`. */
function bailOf(
  storybook: StorybookApp,
  previewResult: StorybookApp['previewResult']
): () => Promise<void> {
  return previewResult ? previewResult.bail : storybook.previewBuilder.bail;
}

async function registerRuntimeInstance(
  upgradeServer: ViteHttpServer,
  embedded: EmbeddedStorybook,
  basePath: string,
  https: boolean
): Promise<void> {
  const address = upgradeServer.address();
  if (!address || typeof address !== 'object') {
    return;
  }
  // addon-mcp's request handler reads `options.port` lazily to build its origin.
  embedded.options.port = address.port;

  try {
    const registration = await writeStorybookRuntimeInstanceRecord({
      address: new URL(basePath, getLocalOrigin(address, https)).href,
      configDir: embedded.options.configDir,
      mcp: embedded.mcp,
      port: address.port,
      storybookVersion: versions.storybook,
      token: getWsToken(),
      // The registry's signal listeners would stop Vite from exiting on Ctrl+C.
      registerCleanup: false,
    });
    // Vite exits right after closing on SIGTERM, before an async cleanup could finish.
    const removeOnExit = (): void => rmSync(registration.recordPath, { force: true });
    process.once('exit', removeOnExit);
    upgradeServer.once('close', () => {
      void registration.cleanup().finally(() => process.off('exit', removeOnExit));
    });
  } catch (error) {
    logger.warn('Storybook failed to write its runtime instance registry record.');
    logger.debug(error instanceof Error ? (error.stack ?? error.message) : String(error));
  }
}

function getLocalOrigin(address: AddressInfo, https: boolean): string {
  const wildcard = address.address === '0.0.0.0' || address.address === '::';
  const hostname = wildcard
    ? 'localhost'
    : address.family === 'IPv6'
      ? `[${address.address}]`
      : address.address;
  return `${https ? 'https' : 'http'}://${hostname}:${address.port}`;
}

function toListenHost(host: string | boolean | undefined): string | undefined {
  if (host === true) {
    return '0.0.0.0';
  }
  return typeof host === 'string' ? host : undefined;
}

function hmrServerOf(hmr: HmrOptions | boolean | undefined): ViteHttpServer | undefined {
  return typeof hmr === 'object' && hmr ? hmr.server : undefined;
}

function forwardServerChannelUpgrades(upgradeServer: ViteHttpServer, emitter: EventEmitter): void {
  const forward = (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
    if (req.url?.startsWith(SERVER_CHANNEL_PATH)) {
      emitter.emit('upgrade', req, socket, head);
    }
  };
  upgradeServer.on('upgrade', forward);
  upgradeServer.once('close', () => upgradeServer.off('upgrade', forward));
}
