import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';

import { type Plugin, type PluginOption, mergeConfig } from 'vite';

import { buildStorybookEnvironment, getStorybookBuildConfig } from './build-storybook';
import { createServerChannel } from './channel-middleware';
import { loadStorybookConfig } from './config-loader';
import { createEnvironmentModuleRouter } from './environment-module-router';
import { createIframeMiddleware } from './iframe-middleware';
import { buildManager, createManagerMiddlewares } from './manager-middleware';
import { getPreviewPlugins } from './preview-plugins';
import { createStaticMiddlewares } from './static-middleware';
import { createStoryIndexMiddleware } from './story-index-middleware';
import { computeStorybookEnvOptions } from './storybook-env-options';
import type { StorybookPluginOptions } from './types';

/**
 * Env vars with these prefixes are exposed through `import.meta.env` inside the storybook
 * environment. `VITE_` is Vite's own default; `STORYBOOK_` matches what the legacy
 * `storybookConfigPlugin` injected globally. This must live at the root `UserConfig` level
 * because `envPrefix` is not a per-environment option in Vite.
 */
const STORYBOOK_ENV_PREFIX: readonly string[] = ['VITE_', 'STORYBOOK_'];

function scopeToStorybookEnv(plugins: PluginOption[]): PluginOption[] {
  return plugins
    .flat()
    .filter(Boolean)
    .map((plugin) => {
      if (!plugin || typeof plugin !== 'object' || !('name' in plugin)) {
        return plugin;
      }
      return {
        ...plugin,
        applyToEnvironment(environment: { name: string }) {
          return environment.name === 'storybook';
        },
      } as Plugin;
    });
}

function wrapInStorybookEnv(name: string, plugins: PluginOption[]): Plugin {
  return {
    name,
    applyToEnvironment(environment) {
      if (environment.name !== 'storybook') {
        return false;
      }
      return plugins as Plugin[];
    },
  };
}

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
  if (process.env.STORYBOOK === 'true') {
    // This is Storybook CLI mode.
    // don't run the plugin
    return [];
  }

  const {
    configDir = '.storybook',
    basePath = '/__storybook/',
    enableManager = true,
  } = userOptions;

  const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const channelPath = `${normalizedBasePath}storybook-server-channel`;

  const options = await loadStorybookConfig(configDir);
  const previewPlugins = scopeToStorybookEnv(await getPreviewPlugins(options, normalizedBasePath));

  const addonConfig = await options.presets.apply('viteFinal', {}, options);
  const addonEnvPlugin = wrapInStorybookEnv('storybook:addon-plugins', addonConfig?.plugins ?? []);

  // Precompute the storybook environment slice once at plugin creation time. Each piece
  // (aliases for external globals, optimizeDeps entries, define map, resolve conditions,
  // preserveSymlinks) was previously contributed by a separate preview plugin via a top-level
  // `config` hook — which meant it leaked into the user's own environment. Moving the
  // computation here and returning the result from `configEnvironment('storybook')` scopes
  // the configuration strictly to the storybook environment.
  const storybookEnvOptions = await computeStorybookEnvOptions({
    options,
    configDir,
    envPrefix: STORYBOOK_ENV_PREFIX,
  });

  const mainPlugin: Plugin = {
    name: 'storybook:main',
    enforce: 'pre',

    config(_, { command }) {
      options.configType = command === 'build' ? 'PRODUCTION' : 'DEVELOPMENT';

      return {
        // `envPrefix` is a root-level option in Vite (not per-environment), so it is set here
        // rather than in `configEnvironment`. This exposes STORYBOOK_-prefixed env vars to the
        // client source code globally — acceptable because build-time env vars are not secrets.
        envPrefix: [...STORYBOOK_ENV_PREFIX],
        server: {
          fs: {
            // Allow the Storybook config directory to be served — required when the user's
            // `server.fs.allow` is already restricted. Additive and safe.
            allow: [configDir],
          },
        },
        // Environment consumer / shape must be declared here because `environments` is not
        // returnable from `configEnvironment`. Everything *inside* the storybook env is
        // returned from `configEnvironment('storybook')` below so it can be computed async
        // and mergeConfig'd with the build-time options.
        environments: {
          storybook: {
            consumer: 'client',
          },
        },
      };
    },

    async configEnvironment(name) {
      if (name !== 'storybook') {
        return;
      }
      return mergeConfig(
        storybookEnvOptions,
        getStorybookBuildConfig(options, 'storybook-static')
      );
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

    async config(_, { mode }) {
      if (mode !== 'storybook') {
        return;
      }

      return {
        builder: {
          async buildApp(builder) {
            await buildStorybookEnvironment(builder, options, 'storybook-static');
          },
        },
      };
    },
  };

  return [mainPlugin, addonEnvPlugin, ...previewPlugins, buildPlugin];
}
