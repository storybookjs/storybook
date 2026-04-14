import {
  experimental_loadStorybook,
  type StoryIndexGenerator,
} from 'storybook/internal/core-server';

import type { InlineConfig, Plugin, PluginOption } from 'vite';

import { pluginConfig } from '../../builder-vite/src/vite-config';
import { bundlerOptionsKey } from '../../builder-vite/src/utils/vite-features';
import { buildStorybookPlugin } from './build';
import { createServerChannel } from './middlewares/channel';
import { registerIframeMiddleware } from './middlewares/iframe';
import {
  createDepsStorybookMiddleware,
  registerEnvironmentModuleMiddleware,
} from './middlewares/module-router';
import { buildManager, registerManagerMiddleware } from './middlewares/manager';
import { createStaticMiddlewares } from './middlewares/static';
import { registerStoryIndexMiddleware } from './middlewares/story-index';
import type { UserOptions } from './types';

import { fileURLToPath } from 'node:url';

import { join, resolve } from 'pathe';

export async function SbMain(options?: UserOptions): Promise<PluginOption> {
  const finalOptions = {
    storybookScript: undefined,
    configDir: resolve(join(process.cwd(), '.storybook')),
    storybookUrl: 'http://localhost:6006',
    ...options,
  };

  const sb = await experimental_loadStorybook({
    configDir: finalOptions.configDir,
    packageJson: {},
  });

  const sbPlugins = await pluginConfig(sb);
  const finalConfig = (await sb.presets.apply('viteFinal', { plugins: sbPlugins })) as InlineConfig;

  const allPlugins = (await Promise.all(
    (finalConfig.plugins ?? []).flat(3).filter(Boolean)
  )) as Plugin[];

  const iframePath = fileURLToPath(
    import.meta.resolve('@storybook/builder-vite/input/iframe.html')
  );

  let basePath = '/__storybook/';

  return [
    {
      name: 'storybook-env',

      config(_, { command, mode }) {
        sb.configType = command === 'build' ? 'PRODUCTION' : 'DEVELOPMENT';
        if (mode === 'storybook') {
          basePath = '/';
        }
        return {
          envPrefix: ['VITE_', 'STORYBOOK_'],
          server: { fs: { allow: [finalOptions.configDir] } },
          environments: { storybook: { consumer: 'client' } },
        };
      },

      configEnvironment(name) {
        if (name !== 'storybook') {
          return;
        }
        return {
          build: {
            outDir: 'storybook-static',
            emptyOutDir: false,
            [bundlerOptionsKey]: {
              input: iframePath,
              external: [/\.\/sb-common-assets\/.*\.woff2/],
            },
          },
        };
      },

      async configureServer(server) {
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

        registerStoryIndexMiddleware(server, storyIndexGenerator, basePath);

        if (server.httpServer) {
          const channel = createServerChannel(
            server.httpServer as Parameters<typeof createServerChannel>[0],
            '/storybook-server-channel',
            wsToken
          );
          sb.channel = channel;

          await sb.presets.apply('experimental_serverChannel', channel);

          const managerHtml = await buildManager(sb, basePath, '/storybook-server-channel');
          registerManagerMiddleware(server, managerHtml, basePath);
        }

        registerIframeMiddleware(server, sb, basePath);

        // server.middlewares.use(createDepsStorybookMiddleware(server));
        registerEnvironmentModuleMiddleware(server);

        storyIndexGenerator.onInvalidated(() => {
          const virtualStoriesId = '\0virtual:/@storybook/builder-vite/storybook-stories.js';
          server.watcher.emit('change', virtualStoriesId);
        });
      },

      transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
          const expectedIframePath = `${basePath}iframe.html`;
          if (ctx.path !== expectedIframePath && ctx.path !== '/iframe.html') {
            return html;
          }

          return html.replace(
            /window\.CHANNEL_OPTIONS\s*=\s*(\{[^;]*\});/,
            (_match, optionsJson) => {
              try {
                const parsed = JSON.parse(optionsJson);
                parsed.channelPath = '/storybook-server-channel';
                return `window.CHANNEL_OPTIONS = ${JSON.stringify(parsed)};`;
              } catch {
                return `window.CHANNEL_OPTIONS = ${JSON.stringify({ channelPath: '/storybook-server-channel' })};`;
              }
            }
          );
        },
      },
    },
    ...scopeToStorybookEnv(allPlugins, basePath),
    buildStorybookPlugin(sb),
  ];
}

/**
 * Wraps plugins for the storybook environment:
 * - Strips config() to prevent root-level config leakage
 * - Adds applyToEnvironment to scope per-env hooks (resolveId, load, transform)
 * - Wraps transformIndexHtml to only fire on storybook pages
 *
 * The plugins' configEnvironment hooks are preserved and fire naturally
 * since the plugins remain top-level (not inside applyToEnvironment).
 */
function scopeToStorybookEnv(plugins: Plugin[], basePath: string): Plugin[] {
  return plugins.map((plugin) => {
    return {
      ...plugin,
      applyToEnvironment(environment: { name: string }) {
        return environment.name === 'storybook';
      },
      transformIndexHtml: plugin.transformIndexHtml
        ? wrapTransformIndexHtml(plugin.transformIndexHtml, basePath)
        : undefined,
    } as Plugin;
  });
}

function wrapTransformIndexHtml(
  transform: Plugin['transformIndexHtml'],
  basePath: string
): Plugin['transformIndexHtml'] {
  if (typeof transform === 'function') {
    return async (html, ctx) => {
      if (ctx.path.startsWith(basePath)) {
        return transform.apply(this, [html, ctx]);
      }
    };
  }
}
