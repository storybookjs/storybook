import {
  experimental_loadStorybook,
  type StoryIndexGenerator,
} from 'storybook/internal/core-server';

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
  type ViteBuilder,
} from 'vite';

import { AsyncLocalStorage } from 'node:async_hooks';
import EventEmitter from 'node:events';
import { pluginConfig } from '../vite-config.ts';
import { buildStaticStorybook } from './build.ts';
import { createServerChannel } from './middlewares/channel.ts';
import { registerStorybookMiddleware } from './middlewares/dispatch.ts';
import { buildManager } from './middlewares/manager.ts';
import { createStaticMiddlewares } from './middlewares/static.ts';
import type { UserOptions } from './types.ts';

// use to guard against duplicate plugin activation
const ViteAsyncLocalStorage = new AsyncLocalStorage<true>();

export function experimental_vitePlugin(options?: UserOptions): Promise<PluginOption> {
  if (ViteAsyncLocalStorage.getStore()) {
    return Promise.resolve([]);
  }
  return Promise.resolve(main(options));
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

      finalConfig.plugins = await withoutFrameworkDevtools(finalConfig.plugins ?? []);

      return { sb, finalConfig };
    }));
  let basePath = finalOptions.base === '/' ? '/' : `${finalOptions.base}/`;

  const applyToStorybookOnly = (_: unknown, env: { command: string; mode: string }) =>
    env.command === 'serve' || env.mode === 'storybook';

  return {
    name: 'storybook-env',
    apply: applyToStorybookOnly,

    async config(config, { command, mode }) {
      const { sb } = await loadStorybook();

      sb.configType = command === 'build' ? 'PRODUCTION' : 'DEVELOPMENT';
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
                  await buildStaticStorybook({
                    basePath,
                    builder,
                    options: sb,
                    outputDir: resolve(builder.config.root ?? config.root, finalOptions.outputDir),
                  });
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
            const { finalConfig } = await loadStorybook();
            const sbConfig = await resolveConfig(
              {
                ...finalConfig,
                cacheDir: 'node_modules/.cache/storybook-vite-deps',
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
            const { finalConfig } = await loadStorybook();

            const sbConfig = await resolveConfig(
              {
                ...finalConfig,
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

      const coreOptions = await sb.presets.apply<{ channelOptions?: { wsToken?: string } }>(
        'core',
        {}
      );
      const wsToken = coreOptions.channelOptions?.wsToken ?? '';

      const staticHandlers = await createStaticMiddlewares(sb, '/');

      const port = await getPort({ random: true, host: '127.0.0.1' });
      const polkaServer = polka();
      polkaServer.listen(port, '127.0.0.1');
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
          '/storybook-server-channel',
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
          const CHANNEL = '/storybook-server-channel';

          const hostHmrBase = server.config.base || '/';
          const originals = hostServer.rawListeners('upgrade');
          hostServer.removeAllListeners('upgrade');
          hostServer.on('upgrade', (req, socket, head) => {
            if (req?.url?.startsWith(CHANNEL)) {
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
            '/storybook-server-channel',
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
      const managerHtml = await buildManager(sb, basePath, '/storybook-server-channel', addonsDir);

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
          pathRewrite: (path) =>
            baseNoSlash ? path.replace(new RegExp(`^${baseEscaped}`), '') : path,
        }),
      });
      storyIndexGenerator.onInvalidated(() => {
        const virtualStoriesId = '\0virtual:/@storybook/builder-vite/storybook-stories.js';
        server.watcher.emit('change', virtualStoriesId);
      });
    },
  };
}

async function withoutFrameworkDevtools(plugins: PluginOption[]): Promise<PluginOption[]> {
  const resolved = await Promise.all(plugins);
  const result: PluginOption[] = [];
  for (const plugin of resolved) {
    if (Array.isArray(plugin)) {
      result.push(await withoutFrameworkDevtools(plugin));
    } else if (!plugin || !/devtools/i.test(plugin.name)) {
      result.push(plugin);
    }
  }
  return result;
}
