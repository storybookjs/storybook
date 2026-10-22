import { randomUUID } from 'node:crypto';
import EventEmitter from 'node:events';
import type { IncomingMessage, Server as HttpServer, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';

import { SERVER_CHANNEL_PATH, type Channel } from 'storybook/internal/channels';
import {
  normalizeStories,
  optionalEnvToBoolean,
  resolvePathInStorybookCache,
} from 'storybook/internal/common';

import {
  buildStaticStandalone,
  doTelemetry,
  experimental_loadStorybook,
  getBuilders,
  getServerChannel,
  internal_universalStatusStore,
  internal_universalTestProviderStore,
  registerIndexJsonRoute,
  type StoryIndexGenerator,
  useStatics,
  withTelemetry,
} from 'storybook/internal/core-server';
import type { Builder, CoreConfig, Options, Presets } from 'storybook/internal/types';

import polka, { type Polka } from 'polka';
import { resolve } from 'pathe';
import type {
  ConfigEnv,
  HmrOptions,
  HttpServer as ViteHttpServer,
  PluginOption,
  UserConfig,
  ViteBuilder,
} from 'vite';

import { createPrefixGuard } from './prefix-guard.ts';
import type { VitePluginPresetOptions } from './preset.ts';
import { startPreview } from './preview-lifecycle.ts';
import { isPluginDisabled, withPluginDisabled } from './self-guard.ts';
import type { UserOptions } from './types.ts';

export type { UserOptions as experimental_VitePluginUserOptions } from './types.ts';

type StorybookApp = {
  options: Options;
  app: Polka;
  previewBuilder: Builder<unknown>;
};

type ServerChannelOptions = Parameters<typeof getServerChannel>[1];

const PLUGIN_NAME = 'storybook:vite-plugin';
const HMR_PATH = '/__storybook-hmr';

// The plugin is bundled into `dist/index.js`, while the preset is its own `dist/vite-plugin/` entry.
const PRESET_PATH = new URL(
  import.meta.url.endsWith('.ts') ? './preset.ts' : './vite-plugin/preset.js',
  import.meta.url
).href;

const GLOBAL_WITH_CHANNEL = globalThis as typeof globalThis & {
  __SB_CHANNEL_UPGRADE__?: EventEmitter;
  __SB_CHANNEL__?: Channel;
  __SB_CHANNEL_INITIALIZED__?: Promise<void>;
  __SB_CHANNEL_OWNER__?: string;
  STORYBOOK_WEBSOCKET_TOKEN?: string;
};

export function experimental_vitePlugin(options?: UserOptions): PluginOption {
  // Avoid nested activation and activation through the Storybook CLI.
  if (isPluginDisabled() || optionalEnvToBoolean(process.env.STORYBOOK_CLI)) {
    return [];
  }
  return main(options);
}

function normalizeBase(base: string): string {
  const trimmed = base.trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
}

function main(options?: UserOptions): PluginOption {
  const finalOptions = {
    base: normalizeBase(options?.base ?? '/__storybook'),
    configDir: resolve(options?.configDir ?? '.storybook'),
    outputDir: options?.outputDir ?? './storybook-static',
  };
  const telemetryOptions = {
    cliOptions: {
      configDir: finalOptions.configDir,
      disableTelemetry: optionalEnvToBoolean(process.env.STORYBOOK_DISABLE_TELEMETRY),
    },
    skipPrompt: true,
  };
  let basePath = finalOptions.base === '/' ? '/' : `${finalOptions.base}/`;
  let storybookPromise: Promise<StorybookApp> | undefined;
  // The preview server is bound to the host HTTP server and must be replaced on restart.
  let previewApp = polka();

  const loadStorybookApp = (
    channel: Channel,
    server: HttpServer,
    vitePlugin: VitePluginPresetOptions['vitePlugin']
  ): Promise<StorybookApp> =>
    (storybookPromise ??= withPluginDisabled(async () => {
      const sb = await experimental_loadStorybook({
        configDir: finalOptions.configDir,
        channel,
        overridePresets: [{ name: PRESET_PATH, options: { vitePlugin } }],
      });
      // Manager addon bundles use the CLI's dev cache rather than the static output directory.
      sb.outputDir = resolvePathInStorybookCache('public', sb.cacheKey);
      await initializeServerChannelOnce(channel, sb.presets);

      const app = polka();
      const storyIndexGeneratorPromise =
        sb.presets.apply<StoryIndexGenerator>('storyIndexGenerator');
      registerIndexJsonRoute({
        app,
        storyIndexGeneratorPromise,
        channel,
        configDir: sb.configDir,
        normalizedStories: normalizeStories(await sb.presets.apply('stories'), {
          configDir: sb.configDir,
          workingDir: process.cwd(),
        }),
      });
      await sb.presets.apply('experimental_devServer', app);
      const [previewBuilder, managerBuilder] = await getBuilders(sb);
      await useStatics(app, sb);
      await managerBuilder.start({
        startTime: process.hrtime(),
        options: sb,
        router: app,
        server,
        channel,
      });
      app.use((req, res) => handlePolkaApp(previewApp, req, res));

      const core = await sb.presets.apply<CoreConfig>('core', {});
      doTelemetry(app, core, storyIndexGeneratorPromise, sb);

      return { options: sb, app, previewBuilder };
    }));

  const applyToStorybookOnly = (_: unknown, env: ConfigEnv): boolean => {
    // Vitest loads the host config but must not start a nested Storybook server.
    if (process.env.VITEST) {
      return false;
    }
    if (env.isPreview) {
      return false;
    }
    return env.command === 'serve' || env.mode === 'storybook';
  };

  return {
    name: PLUGIN_NAME,
    apply: applyToStorybookOnly,

    config(_, { command, mode }): UserConfig {
      if (mode === 'storybook') {
        basePath = '/';
      }
      if (!(command === 'build' && mode === 'storybook')) {
        return {};
      }
      return {
        builder: {
          buildApp: async (builder: ViteBuilder): Promise<void> => {
            await withPluginDisabled(() =>
              withTelemetry('build', telemetryOptions, () =>
                buildStaticStandalone({
                  configDir: finalOptions.configDir,
                  outputDir: resolve(builder.config.root, finalOptions.outputDir),
                })
              )
            );
            // Prevent Vite from falling back to building every host environment.
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
          'The Storybook Vite plugin needs the host HTTP server to attach its WebSockets.When Vite runs in middleware mode, pass your server as `server.hmr.server`.'
        );
      }

      await withTelemetry('dev', telemetryOptions, async () => {
        const channel = getOrCreateServerChannel(finalOptions.configDir, {
          allowedHosts: host.config.server.allowedHosts,
          host: typeof host.config.server.host === 'string' ? host.config.server.host : undefined,
        });
        forwardServerChannelUpgrades(upgradeServer, getSharedUpgradeEmitter());
        const builderServer = toBuilderServer(upgradeServer);

        const storybook = await loadStorybookApp(channel, builderServer, {
          base: basePath,
          hmrPath: HMR_PATH,
          allowedHosts: host.config.server.allowedHosts,
        });
        const reportPort = (): void => {
          const address = upgradeServer.address();
          if (address && typeof address === 'object') {
            storybook.options.port = address.port;
          }
        };
        if (upgradeServer.listening) {
          reportPort();
        } else {
          upgradeServer.once('listening', reportPort);
        }

        previewApp = polka();
        const closePreview = await withPluginDisabled(() =>
          startPreview(storybook.previewBuilder, {
            startTime: process.hrtime(),
            options: storybook.options,
            router: previewApp,
            server: builderServer,
            channel,
          })
        );
        upgradeServer.once('close', () => {
          void closePreview();
        });
        host.middlewares.use(
          createPrefixGuard(basePath, (req, res) => handlePolkaApp(storybook.app, req, res))
        );
      });
    },
  };
}

function getSharedUpgradeEmitter(): EventEmitter {
  return (GLOBAL_WITH_CHANNEL.__SB_CHANNEL_UPGRADE__ ??= new EventEmitter());
}

function getOrCreateServerChannel(
  configDir: string,
  options: Omit<ServerChannelOptions, 'token'>
): Channel {
  GLOBAL_WITH_CHANNEL.__SB_CHANNEL_OWNER__ ??= configDir;
  if (GLOBAL_WITH_CHANNEL.__SB_CHANNEL_OWNER__ !== configDir) {
    throw new Error(
      `The Storybook Vite plugin is already running for '${GLOBAL_WITH_CHANNEL.__SB_CHANNEL_OWNER__}' in this process, ` +
        `so it cannot also serve '${configDir}'. Run each Storybook in its own dev-server process.`
    );
  }
  return (GLOBAL_WITH_CHANNEL.__SB_CHANNEL__ ??= getServerChannel(getSharedUpgradeEmitter(), {
    ...options,
    token: (GLOBAL_WITH_CHANNEL.STORYBOOK_WEBSOCKET_TOKEN ??= randomUUID()),
  }));
}

function initializeServerChannelOnce(channel: Channel, presets: Presets): Promise<void> {
  return (GLOBAL_WITH_CHANNEL.__SB_CHANNEL_INITIALIZED__ ??= (async () => {
    // Accessing actors creates the server-side leaders.
    void internal_universalStatusStore.actor;
    void internal_universalTestProviderStore.actor;
    await presets.apply('experimental_serverChannel', channel);
  })());
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

function toBuilderServer(server: ViteHttpServer): HttpServer {
  return server as HttpServer;
}

function handlePolkaApp(app: Polka, req: IncomingMessage, res: ServerResponse): void {
  (app.handler as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
