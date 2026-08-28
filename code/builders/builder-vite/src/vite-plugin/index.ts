import { optionalEnvToBoolean } from 'storybook/internal/common';
import {
  experimental_loadStorybook,
  type StoryIndexGenerator,
} from 'storybook/internal/core-server';
import { setTelemetryVitePlugin } from 'storybook/internal/telemetry';
import type { CoreConfig } from 'storybook/internal/types';

import { getPort } from 'get-port-please';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { join, resolve } from 'pathe';
import polka from 'polka';
import {
  BuildEnvironment,
  DevEnvironment,
  resolveConfig,
  type InlineConfig,
  type PluginOption,
  type UserConfig,
  type ViteBuilder,
} from 'vite';

import { AsyncLocalStorage } from 'node:async_hooks';
import EventEmitter from 'node:events';
import { commonConfig, type PluginConfigType } from '../vite-config.ts';
import { buildStaticStorybook } from './build.ts';
import { createServerChannel } from './middlewares/channel.ts';
import { registerStorybookMiddleware } from './middlewares/dispatch.ts';
import { buildManager } from './middlewares/manager.ts';
import { createStaticMiddlewares } from './middlewares/static.ts';
import { createProxyPathFilter, SERVER_CHANNEL_PATH } from './proxy-path-filter.ts';
import { emitDevTelemetry, reportTelemetryError } from './telemetry.ts';
import type { UserOptions } from './types.ts';

// use to guard against duplicate plugin activation
const ViteAsyncLocalStorage = new AsyncLocalStorage<true>();
const PLUGIN_NAME = 'storybook-env';

/**
 * The app config was already merged before `viteFinal`; reloading it would re-add app plugins after
 * framework presets had filtered them.
 */
const APP_CONFIG_ALREADY_LOADED = { configFile: false } as const;

export function experimental_vitePlugin(options?: UserOptions): PluginOption {
  // prevent nested activation and deactivate self when ran through CLI
  if (ViteAsyncLocalStorage.getStore() || optionalEnvToBoolean(process.env.STORYBOOK_CLI)) {
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
  setTelemetryVitePlugin();

  const finalOptions = {
    base: normalizeBase(options?.base ?? '/__storybook'),
    configDir: resolve(options?.configDir ?? '.storybook'),
    outputDir: options?.outputDir ?? './storybook-static',
  };

  const projectRoot = resolve(finalOptions.configDir, '..');

  let storybookPromise:
    | Promise<{
        sb: Awaited<ReturnType<typeof experimental_loadStorybook>>;
        finalConfig: InlineConfig;
      }>
    | undefined;

  // load and cache config
  const loadStorybook = (command: 'serve' | 'build' = 'serve', appConfig?: UserConfig) =>
    (storybookPromise ??= ViteAsyncLocalStorage.run(true, async () => {
      const sb = await experimental_loadStorybook({
        configDir: finalOptions.configDir,
        packageJson: {},
      });

      sb.configType = command === 'build' ? 'PRODUCTION' : 'DEVELOPMENT';

      const configType: PluginConfigType = command === 'build' ? 'build' : 'development';
      const mergedConfig = await commonConfig(sb, configType, appConfig);
      const finalConfig = (await sb.presets.apply('viteFinal', mergedConfig)) as InlineConfig;

      finalConfig.plugins = await withoutInternalPlugins(finalConfig.plugins ?? []);

      return { sb, finalConfig };
    }));
  let basePath = finalOptions.base === '/' ? '/' : `${finalOptions.base}/`;

  const activePolkaServers = new Set<ReturnType<typeof polka>>();
  const closePolkaServer = (instance: ReturnType<typeof polka>) => {
    if (!activePolkaServers.has(instance)) {
      return;
    }
    activePolkaServers.delete(instance);
    instance.server?.close();
  };

  const applyToStorybookOnly = (_: unknown, env: { command: string; mode: string }) => {
    // don't activate the plugin if we're running Vitest, since that will load Storybook's Vite config and cause issues with Vitest's Vite config
    if (process.env.VITEST) {
      return false;
    }
    return env.command === 'serve' || env.mode === 'storybook';
  };

  return {
    name: PLUGIN_NAME,
    apply: applyToStorybookOnly,

    async config(config, { command, mode }) {
      const { sb } = await loadStorybook(command, config).catch(async (error) => {
        await reportTelemetryError(error, command === 'build' ? 'build' : 'dev');
        throw error;
      });

      if (mode === 'storybook') {
        basePath = '/';
      }
      return {
        envPrefix: ['VITE_', 'STORYBOOK_'],
        ...(mode === 'storybook' ? { server: { fs: { allow: [finalOptions.configDir] } } } : {}),
        environments: { storybook: { consumer: 'client' } },
        ...(mode === 'storybook' && command === 'build'
          ? {
              builder: {
                buildApp: async (builder: ViteBuilder) => {
                  try {
                    await buildStaticStorybook({
                      basePath,
                      builder,
                      options: sb,
                      outputDir: finalOptions.outputDir,
                      root: builder.config.root ?? config.root,
                    });
                  } catch (error) {
                    const core = await sb.presets
                      .apply<CoreConfig>('core', {})
                      .catch(() => ({}) as CoreConfig);
                    await reportTelemetryError(error, 'build', core.disableTelemetry);
                    throw error;
                  }
                },
              },
            }
          : {}),
      };
    },

    configEnvironment(name) {
      if (name !== 'storybook') {
        return;
      }
      return {
        build: {
          async createEnvironment() {
            const { finalConfig } = await loadStorybook('build');
            const sbConfig = await resolveConfig(
              {
                ...finalConfig,
                ...APP_CONFIG_ALREADY_LOADED,
                root: finalConfig.root ?? projectRoot,
                cacheDir: 'node_modules/.cache/storybook-vite-deps',
                base: basePath,
                build: {
                  ...finalConfig.build,
                  outDir: finalOptions.outputDir,
                  emptyOutDir: false,
                },
              },
              'build',
              'production',
              'production'
            );

            return new BuildEnvironment('client', sbConfig);
          },
        },
        dev: {
          async createEnvironment(name, config, context) {
            const { finalConfig } = await loadStorybook('serve');

            const sbConfig = await resolveConfig(
              {
                ...finalConfig,
                ...APP_CONFIG_ALREADY_LOADED,
                root: finalConfig.root ?? projectRoot,
                plugins: [
                  ...(finalConfig.plugins ?? []),
                  {
                    name: 'storybook:enforce-env-base',
                    enforce: 'post',
                    config: () => ({ base: basePath, server: { hmr: config.server?.hmr } }),
                  },
                ],
                cacheDir: 'node_modules/.cache/storybook-vite-deps',
                base: basePath,
              },
              'serve'
            );

            Object.defineProperty(sbConfig, 'webSocketToken', {
              value: config.webSocketToken,
              configurable: !0,
              writable: !0,
            });

            return new DevEnvironment('client', sbConfig, {
              ...context,
              hot: true,
              transport: {
                send: (p) => context.ws.send(p),
                // @ts-expect-error wtf ?
                on: (e, listener) => context.ws.on(e, listener),
                // @ts-expect-error wtf ?
                off: (e, listener) => context.ws.off(e, listener),
              },
            });
          },
        },
      };
    },

    async configureServer(server) {
      const { sb } = await loadStorybook();
      const storyIndexGenerator =
        await sb.presets.apply<StoryIndexGenerator>('storyIndexGenerator');

      const coreOptions = await sb.presets.apply<CoreConfig>('core', {});

      const wsToken = coreOptions.channelOptions?.wsToken ?? server.config.webSocketToken;

      const staticHandlers = await createStaticMiddlewares(sb, '/');

      const port = await getPort({ random: true, host: '127.0.0.1' });
      const polkaServer = polka();
      polkaServer.listen(port, '127.0.0.1');
      activePolkaServers.add(polkaServer);
      server.httpServer?.once('close', () => closePolkaServer(polkaServer));
      sb.port = server.config.server.port;
      await sb.presets.apply('experimental_devServer', polkaServer, sb);

      if (server.httpServer) {
        server.httpServer?.prependListener('upgrade', (req) => {
          const protocol = req.headers['sec-websocket-protocol'];
          if (
            basePath !== '/' &&
            (protocol === 'vite-hmr' || protocol === 'vite-ping') &&
            req.url?.startsWith(basePath)
          ) {
            req.url = req.url.slice(basePath.length - 1) || '/';
          }
        });

        const channel = createServerChannel(
          server.httpServer as Parameters<typeof createServerChannel>[0],
          SERVER_CHANNEL_PATH,
          wsToken
        );
        sb.channel = channel;

        await sb.presets.apply('experimental_serverChannel', channel);
      } else {
        // vite is in middleware mode
        const globalWithChannel = globalThis as typeof globalThis & {
          __SB_CHANNEL_UPGRADE__?: EventEmitter;
          __SB_CHANNEL__?: ReturnType<typeof createServerChannel>;
        };
        const sharedUpgrades = (globalWithChannel.__SB_CHANNEL_UPGRADE__ ??= new EventEmitter());

        const hmrOpts = server.config.server.hmr;
        const hostServer = typeof hmrOpts == 'object' && hmrOpts && hmrOpts.server;
        if (hostServer) {
          const hostHmrBase = server.config.base || '/';
          const originals = hostServer.rawListeners('upgrade');
          hostServer.removeAllListeners('upgrade');
          hostServer.on('upgrade', (req, socket, head) => {
            if (req?.url?.startsWith(SERVER_CHANNEL_PATH)) {
              sharedUpgrades.emit('upgrade', req, socket, head);
              return;
            }
            const protocol = req.headers['sec-websocket-protocol'];
            if (
              (protocol === 'vite-hmr' || protocol === 'vite-ping') &&
              req.url?.startsWith(basePath)
            ) {
              const queryIndex = req.url.indexOf('?');
              req.url = hostHmrBase + (queryIndex >= 0 ? req.url.slice(queryIndex) : '');
            }
            for (const fn of originals) fn.call(hostServer, req, socket, head);
          });
        }

        if (!globalWithChannel.__SB_CHANNEL__) {
          globalWithChannel.__SB_CHANNEL__ = createServerChannel(
            sharedUpgrades,
            SERVER_CHANNEL_PATH,
            wsToken
          );
          await sb.presets.apply('experimental_serverChannel', globalWithChannel.__SB_CHANNEL__);
        }
        sb.channel = globalWithChannel.__SB_CHANNEL__;
      }

      const addonsDir = join(
        server.config.root,
        'node_modules/.cache/storybook-vite-manager/sb-addons'
      );
      const managerHtml = await buildManager(sb, basePath, SERVER_CHANNEL_PATH, addonsDir);

      // derived here (not at plugin creation) so the storybook-mode basePath override applies
      const baseNoSlash = basePath.replace(/\/+$/, '');
      const baseEscaped = baseNoSlash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      registerStorybookMiddleware(server, {
        options: sb,
        basePath,
        managerHtml,
        addonsDir,
        storyIndexGenerator,
        staticHandlers,
        proxy: createProxyMiddleware({
          target: `http://127.0.0.1:${port}`,
          changeOrigin: true,
          ws: true,
          pathFilter: createProxyPathFilter({
            basePath,
            channelPath: SERVER_CHANNEL_PATH,
          }),
          pathRewrite: (path) =>
            baseNoSlash ? path.replace(new RegExp(`^${baseEscaped}`), '') : path,
        }),
      });
      storyIndexGenerator.onInvalidated(() => {
        const virtualStoriesId = '\0virtual:/@storybook/builder-vite/storybook-stories.js';
        server.watcher.emit('change', virtualStoriesId);
      });

      await emitDevTelemetry({
        configDir: sb.configDir,
        disableTelemetry: coreOptions.disableTelemetry,
        storyIndexGenerator,
      });
    },

    closeBundle() {
      for (const instance of [...activePolkaServers]) {
        closePolkaServer(instance);
      }
    },
  };
}

async function withoutInternalPlugins(plugins: PluginOption[]): Promise<PluginOption[]> {
  const resolved = await Promise.all(plugins);
  const result: PluginOption[] = [];
  for (const plugin of resolved) {
    if (Array.isArray(plugin)) {
      result.push(await withoutInternalPlugins(plugin));
    } else if (!plugin || (plugin.name !== PLUGIN_NAME && !/devtools/i.test(plugin.name))) {
      result.push(plugin);
    }
  }
  return result;
}
