import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';

import type { Plugin, PluginOption } from 'vite';

import { buildStorybookEnvironment, getStorybookBuildConfig } from './build-storybook';
import { createServerChannel } from './channel-middleware';
import { loadStorybookConfig } from './config-loader';
import { createEnvironmentModuleRouter } from './environment-module-router';
import { createIframeMiddleware } from './iframe-middleware';
import { buildManager, createManagerMiddlewares } from './manager-middleware';
import { getPreviewPlugins } from './preview-plugins';
import { createStaticMiddlewares } from './static-middleware';
import { createStoryIndexMiddleware } from './story-index-middleware';
import type { StorybookPluginOptions } from './types';

/**
 * Vite plugin that embeds Storybook into the user's Vite dev server.
 *
 * Returns a Promise<PluginOption[]> because loading .storybook/main config
 * and addon presets is async. Vite natively supports async plugin entries.
 *
 * All plugins are returned at the top level (not from config()) because
 * Vite 8 does not register hooks (resolveId, load, transform, transformIndexHtml)
 * for plugins injected via config().
 */
export async function storybookPlugin(
  userOptions: StorybookPluginOptions = {}
): Promise<PluginOption[]> {
  const {
    configDir = '.storybook',
    basePath = '/__storybook/',
    enableManager = true,
    outputDir: userOutputDir,
  } = userOptions;

  const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const channelPath = `${normalizedBasePath}storybook-server-channel`;

  const options = await loadStorybookConfig(configDir);
  const previewPlugins = await getPreviewPlugins(options, normalizedBasePath);

  const addonConfig = await options.presets.apply('viteFinal', {}, options);
  const addonPlugins = addonConfig?.plugins ?? [];

  const mainPlugin: Plugin = {
    name: 'storybook:main',
    enforce: 'pre',

    config() {
      return {
        environments: {
          storybook: {
            resolve: {
              conditions: ['storybook', 'stories', 'test'],
            },
            consumer: 'client',
            optimizeDeps: {
              include: ['storybook/internal/preview/runtime'],
            },
          },
        },
      };
    },

    async configEnvironment(name) {
      if (name !== 'storybook') {
        return;
      }
      const outputDir = userOutputDir ?? options.outputDir ?? 'storybook-static';
      return getStorybookBuildConfig(options, outputDir);
    },

    async configureServer(server) {
      const storyIndexGenerator =
        await options.presets.apply<StoryIndexGenerator>('storyIndexGenerator');

      const coreOptions = await options.presets.apply<{ channelOptions?: { wsToken?: string } }>(
        'core',
        {}
      );
      const wsToken = coreOptions.channelOptions?.wsToken ?? '';

      if (server.httpServer) {
        const channel = createServerChannel(
          server.httpServer as Parameters<typeof createServerChannel>[0],
          channelPath,
          wsToken
        );
        options.channel = channel;

        await options.presets.apply('experimental_serverChannel', channel);
      }

      storyIndexGenerator.onInvalidated(() => {
        const virtualStoriesId = '\0virtual:/@storybook/builder-vite/storybook-stories.js';
        server.watcher.emit('change', virtualStoriesId);
      });

      server.middlewares.use(createEnvironmentModuleRouter(server));
      server.middlewares.use(createStoryIndexMiddleware(storyIndexGenerator, normalizedBasePath));
      server.middlewares.use(createIframeMiddleware(options, server, normalizedBasePath));

      const staticMiddlewares = await createStaticMiddlewares(options, normalizedBasePath);
      for (const middleware of staticMiddlewares) {
        server.middlewares.use(middleware);
      }

      if (enableManager) {
        try {
          const html = await buildManager(options, normalizedBasePath, channelPath);
          const managerMiddlewares = createManagerMiddlewares(html, normalizedBasePath);
          for (const middleware of managerMiddlewares) {
            server.middlewares.use(middleware);
          }
        } catch (error) {
          logger.warn('Failed to build Storybook manager UI:');
          logger.warn(String(error));
        }
      }

      logger.info(`Storybook available at ${normalizedBasePath}`);
    },

    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const iframePath = `${normalizedBasePath}iframe.html`;
        if (ctx.path !== iframePath && ctx.path !== '/iframe.html') {
          return html;
        }

        return html.replace(/window\.CHANNEL_OPTIONS\s*=\s*(\{[^;]*\});/, (_match, optionsJson) => {
          try {
            const parsed = JSON.parse(optionsJson);
            parsed.channelPath = channelPath;
            return `window.CHANNEL_OPTIONS = ${JSON.stringify(parsed)};`;
          } catch {
            return `window.CHANNEL_OPTIONS = ${JSON.stringify({ channelPath })};`;
          }
        });
      },
    },
  };

  const buildPlugin: Plugin = {
    name: 'storybook:build',
    apply: 'build',

    async config() {
      const outputDir = userOutputDir ?? options.outputDir ?? 'storybook-static';

      return {
        builder: {
          async buildApp(builder) {
            if (builder.environments['client']) {
              await builder.build(builder.environments['client']);
            }
            await buildStorybookEnvironment(builder, options, outputDir);
          },
        },
      };
    },
  };

  return [mainPlugin, ...addonPlugins, ...previewPlugins, buildPlugin];
}
