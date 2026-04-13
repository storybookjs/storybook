import {
  experimental_loadStorybook,
  type StoryIndexGenerator,
} from 'storybook/internal/core-server';

import { resolveConfig, type InlineConfig, type Plugin, type PluginOption } from 'vite';

import { pluginConfig } from '../../builder-vite/src/vite-config';
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
  const finalConfig = (await sb.presets.apply(
    'viteFinal',
    { plugins: sbPlugins }
  )) as InlineConfig;

  const allPlugins = (finalConfig.plugins ?? [])
    .flat(3)
    .filter(Boolean) as Plugin[];

  const resolved = await resolveConfig(
    { plugins: allPlugins, configFile: false },
    'serve'
  );

  const aliases = resolved.resolve.alias;
  const envConfig: Record<string, any> = {
    resolve: { conditions: resolved.resolve.conditions },
    define: resolved.define,
    optimizeDeps: {
      entries: resolved.optimizeDeps.entries,
      include: resolved.optimizeDeps.include,
    },
  };

  return [
    {
      name: 'storybook-env',

      config(_, { command }) {
        sb.configType = command === 'build' ? 'PRODUCTION' : 'DEVELOPMENT';
        return {
          envPrefix: ['VITE_', 'STORYBOOK_'],
          server: { fs: { allow: [finalOptions.configDir] } },
          environments: { storybook: { consumer: 'client' } },
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

        const staticMiddlewares = await createStaticMiddlewares(sb, '/__storybook/');
        for (const middleware of staticMiddlewares) {
          server.middlewares.use(middleware);
        }

        registerStoryIndexMiddleware(server, storyIndexGenerator, '/__storybook/');

        if (server.httpServer) {
          const channel = createServerChannel(
            server.httpServer as Parameters<typeof createServerChannel>[0],
            '/storybook-server-channel',
            wsToken
          );
          sb.channel = channel;

          await sb.presets.apply('experimental_serverChannel', channel);

          const managerHtml = await buildManager(sb, '/__storybook/', '/storybook-server-channel');
          registerManagerMiddleware(server, managerHtml, '/__storybook/');
        }

        registerIframeMiddleware(server, sb, '/__storybook/');

        server.middlewares.use(createDepsStorybookMiddleware(server));
        registerEnvironmentModuleMiddleware(server);

        storyIndexGenerator.onInvalidated(() => {
          const virtualStoriesId = '\0virtual:/@storybook/builder-vite/storybook-stories.js';
          server.watcher.emit('change', virtualStoriesId);
        });
      },

      transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
          const iframePath = '/__storybook/iframe.html';
          if (ctx.path !== iframePath && ctx.path !== '/iframe.html') {
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
    {
      name: 'storybook:env-config',
      configEnvironment(name) {
        if (name !== 'storybook') {
          return;
        }
        return envConfig;
      },
    },
    {
      name: 'storybook:env-aliases',
      enforce: 'pre' as const,
      apply: 'serve' as const,
      applyToEnvironment(env: { name: string }) {
        return env.name === 'storybook';
      },
      resolveId(source) {
        for (const alias of aliases) {
          if (alias.find instanceof RegExp) {
            if (alias.find.test(source)) {
              return source.replace(alias.find, alias.replacement);
            }
          } else if (source === alias.find) {
            return alias.replacement;
          } else if (source.startsWith(alias.find + '/')) {
            return alias.replacement + source.slice(String(alias.find).length);
          }
        }
      },
    },
    {
      name: 'storybook:scoped-plugins',
      applyToEnvironment(environment: { name: string }) {
        if (environment.name !== 'storybook') {
          return false;
        }
        return allPlugins as Plugin[];
      },
    },
    buildStorybookPlugin(sb),
  ];
}

