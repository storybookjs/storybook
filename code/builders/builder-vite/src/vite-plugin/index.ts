import {
  experimental_loadStorybook,
  type StoryIndexGenerator,
} from 'storybook/internal/core-server';

import { getPort } from 'get-port-please';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { resolve } from 'pathe';
import polka from 'polka';
import {
  BuildEnvironment,
  DevEnvironment,
  type InlineConfig,
  type PluginOption,
  resolveConfig,
} from 'vite';

import { AsyncLocalStorage } from 'node:async_hooks';
import EventEmitter from 'node:events';
import { pluginConfig } from '../vite-config.ts';
import { createServerChannel } from './middlewares/channel.ts';
import { registerIframeMiddleware } from './middlewares/iframe.ts';
import { buildManager, registerManagerMiddleware } from './middlewares/manager.ts';
import { registerEnvironmentModuleMiddleware } from './middlewares/module-router.ts';
import { createStaticMiddlewares } from './middlewares/static.ts';
import { registerStoryIndexMiddleware } from './middlewares/story-index.ts';
import type { UserOptions } from './types.ts';

// use to guard against duplicate plugin activation
const ViteAsyncLocalStorage = new AsyncLocalStorage<true>();

export function experimental_vitePlugin(options?: UserOptions): Promise<PluginOption> {
  if (ViteAsyncLocalStorage.getStore()) {
    return Promise.resolve([]);
  }
  return Promise.resolve(main(options));
}

function main(options?: UserOptions): PluginOption {
  const finalOptions = {
    base: '/__storybook',
    configDir: resolve(options?.configDir ?? '.storybook'),
    ...options,
  };

  let storybookPromise:
    | Promise<{
        sb: Awaited<ReturnType<typeof experimental_loadStorybook>>;
        finalConfig: InlineConfig;
      }>
    | undefined;

  // load and cache config
  const loadStorybook = () =>
    (storybookPromise ??= ViteAsyncLocalStorage.run(true, async () => {
      const sb = await experimental_loadStorybook({
        configDir: finalOptions.configDir,
        packageJson: {},
      });

      const sbPlugins = await pluginConfig(sb);
      const finalConfig = (await sb.presets.apply('viteFinal', {
        plugins: sbPlugins,
      })) as InlineConfig;

      return { sb, finalConfig };
    }));

  const baseNoSlash = finalOptions.base.replace(/\/+$/, '') || '';
  const baseEscaped = baseNoSlash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let basePath = baseNoSlash === '' ? '/' : `${baseNoSlash}/`;

  const applyToStorybookOnly = (_: unknown, env: { command: string; mode: string }) =>
    env.command === 'serve' || env.mode === 'storybook';

  return [
    {
      name: 'storybook-env',
      apply: applyToStorybookOnly,

      async config(_, { command, mode }) {
        const { sb } = await loadStorybook();

        sb.configType = command === 'build' ? 'PRODUCTION' : 'DEVELOPMENT';
        if (mode === 'storybook') {
          basePath = '/';
        }
        return {
          envPrefix: ['VITE_', 'STORYBOOK_'],
          ...(mode === 'storybook' ? { server: { fs: { allow: [finalOptions.configDir] } } } : {}),
          environments: { storybook: { consumer: 'client' } },
        };
      },

      configEnvironment(name) {
        if (name !== 'storybook') {
          return;
        }
        return {
          build: {
            async createEnvironment() {
              const { finalConfig } = await loadStorybook();
              const sbConfig = await resolveConfig(
                {
                  ...finalConfig,
                  cacheDir: 'node_modules/.cache/storybook-vite-deps',
                  build: {
                    ...finalConfig.build,
                    outDir: 'storybook-static',
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
              const { finalConfig } = await loadStorybook();
              const sbConfig = await resolveConfig(
                {
                  ...finalConfig,
                  cacheDir: 'node_modules/.cache/storybook-vite-deps',
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
              });
            },
          },
        };
      },

      async configureServer(server) {
        const { sb } = await loadStorybook();
        const storyIndexGenerator =
          await sb.presets.apply<StoryIndexGenerator>('storyIndexGenerator');

        const coreOptions = await sb.presets.apply<{ channelOptions?: { wsToken?: string } }>(
          'core',
          {}
        );
        const wsToken = coreOptions.channelOptions?.wsToken ?? '';

        const staticMiddlewares = await createStaticMiddlewares(sb, basePath);
        for (const middleware of staticMiddlewares) {
          server.middlewares.use(middleware);
        }

        // A random port is important: getPort() defaults to preferring port 3000, which can appear
        // free on IPv4 when the surrounding dev server (e.g. Nuxt) only bound IPv6 — polka would
        // then shadow the app for all IPv4 localhost traffic. Loopback-only, as it's internal.
        const port = await getPort({ random: true, host: '127.0.0.1' });
        const polkaServer = polka();
        polkaServer.listen(port, '127.0.0.1');
        sb.port = server.config.server.port;
        await sb.presets.apply('experimental_devServer', polkaServer, sb);
        registerStoryIndexMiddleware(server, storyIndexGenerator, basePath);

        if (server.httpServer) {
          const channel = createServerChannel(
            server.httpServer as Parameters<typeof createServerChannel>[0],
            '/storybook-server-channel',
            wsToken
          );
          sb.channel = channel;

          await sb.presets.apply('experimental_serverChannel', channel);
        } else {
          const globalWithChannel = globalThis as typeof globalThis & {
            __SB_CHANNEL_UPGRADE__?: EventEmitter;
            __SB_CHANNEL__?: ReturnType<typeof createServerChannel>;
          };
          const sharedUpgrades = (globalWithChannel.__SB_CHANNEL_UPGRADE__ ??= new EventEmitter());

          if (!globalWithChannel.__SB_CHANNEL__) {
            globalWithChannel.__SB_CHANNEL__ = createServerChannel(
              sharedUpgrades,
              '/storybook-server-channel',
              wsToken
            );
            await sb.presets.apply('experimental_serverChannel', globalWithChannel.__SB_CHANNEL__);
          }
          sb.channel = globalWithChannel.__SB_CHANNEL__;
        }

        const managerHtml = await buildManager(sb, basePath, '/storybook-server-channel');
        registerManagerMiddleware(server, managerHtml, basePath);
        registerIframeMiddleware(server, sb, basePath);

        registerEnvironmentModuleMiddleware(server);

        server.middlewares.use(
          baseNoSlash || '/',
          createProxyMiddleware({
            target: `http://127.0.0.1:${port}`,
            changeOrigin: true,
            ws: true,
            pathRewrite: (path) =>
              baseNoSlash ? path.replace(new RegExp(`^${baseEscaped}`), '') : path,
          })
        );
        storyIndexGenerator.onInvalidated(() => {
          const virtualStoriesId = '\0virtual:/@storybook/builder-vite/storybook-stories.js';
          server.watcher.emit('change', virtualStoriesId);
        });
      },
    },
  ];
}
