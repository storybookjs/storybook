import { mergeConfig, type InlineConfig, type Plugin, type PluginOption } from 'vite';
import { createViteConfig } from '@storybook/builder-vite';
import {
  experimental_loadStorybook,
  type StoryIndexGenerator,
} from 'storybook/internal/core-server';
import type { Options, PreviewAnnotation } from 'storybook/internal/types';
import type { UserOptions } from './types';
import { join, resolve } from 'pathe';
import { createServerChannel } from './middlewares/channel';
import {
  createDepsStorybookMiddleware,
  registerEnvironmentModuleMiddleware,
} from './middlewares/module-router';
import { buildManager, registerManagerMiddleware } from './middlewares/manager';
import { registerIframeMiddleware } from './middlewares/iframe';
import { getPreviewPlugins } from './plugins/preview-plugins';
import { createStaticMiddlewares } from './middlewares/static';
import { registerStoryIndexMiddleware } from './middlewares/story-index';
import { buildStorybookPlugin } from './build';
import {
  escapeGlobPath,
  getMockRedirectIncludeEntries,
} from '../../builder-vite/src/plugins/storybook-optimize-deps-plugin';
import { processPreviewAnnotation } from '../../builder-vite/src/utils/process-preview-annotation';
import { getUniqueImportPaths } from '../../builder-vite/src/utils/unique-import-paths';

export async function SbMain(options?: UserOptions): Promise<PluginOption> {
  const finalOptions = {
    storybookScript: undefined,
    configDir: resolve(join(process.cwd(), '.storybook')),
    storybookUrl: 'http://localhost:6006',
    ...options,
  };

  // we should watch over main changes
  const sb = await experimental_loadStorybook({
    configDir: finalOptions.configDir,
    packageJson: {},
  });

  const finalConfig = (await sb.presets.apply('viteFinal', finalOptions)) as InlineConfig;

  const pluginConfigs = extractPluginConfigs(finalConfig.plugins ?? []);

  // This is VERYY hacky
  // environment scopedc plugins doesn't run config hooks by vite
  const resolveConfig = mergeConfig(
    finalConfig.resolve ?? {},
    pluginConfigs.resolve ?? {}
  ) as InlineConfig['resolve'];

  const storybookOptimizeDeps = await computeStorybookOptimizeDeps(sb);

  return [
    {
      name: 'storybook-env',

      config(_, { command }) {
        sb.configType = command === 'build' ? 'PRODUCTION' : 'DEVELOPMENT';
        return {
          resolve: resolveConfig,
          environments: {
            storybook: {
              consumer: 'client',
              resolve: resolveConfig,
              define: finalConfig.define,
            },
          },
          envPrefix: ['VITE_', 'STORYBOOK_'],
        };
      },
      configEnvironment(name) {
        if (name === 'storybook') {
          return {
            optimizeDeps: storybookOptimizeDeps,
          };
        }
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
            // hard coded - check code\core\src\channels\index.ts
            // should be customizable in the future if needed
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
          // risk of leaking into user app code
          const iframePath = `/__storybook/iframe.html`;
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
    ...scopeToStorybookEnv(await getPreviewPlugins(sb, '/__storybook/')),
    {
      name: 'storybook-preview',
      async applyToEnvironment(environment) {
        if (environment.name !== 'storybook') {
          return false;
        }
        const addonConfig = await sb.presets.apply('viteFinal', {}, options);
        return addonConfig.plugins || [];
      },
    },
    buildStorybookPlugin(sb),
  ];
}

function scopeToStorybookEnv(plugins: PluginOption[]): PluginOption[] {
  return plugins
    .flat(3)
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
        transformIndexHtml: plugin.transformIndexHtml
          ? wrapTransformIndexHtml(plugin.transformIndexHtml)
          : undefined,
      } as Plugin;
    });
}

const wrapTransformIndexHtml: (
  transform: Plugin['transformIndexHtml']
) => Plugin['transformIndexHtml'] = (transform) => {
  if (typeof transform === 'function') {
    return async (html, ctx) => {
      if (ctx.path.startsWith('/__storybook/')) {
        return transform.apply(this, [html, ctx]);
      }
    };
  }
};

async function computeStorybookOptimizeDeps(options: Options) {
  const { loadPreviewOrConfigFile } = await import('storybook/internal/common');
  const { babelParser, extractMockCalls, findMockRedirect } =
    await import('storybook/internal/mocking-utils');

  const projectRoot = resolve(options.configDir, '..');

  const [extraOptimizeDeps, storyIndexGenerator, previewAnnotations] = await Promise.all([
    options.presets.apply<string[]>('optimizeViteDeps', []),
    options.presets.apply<StoryIndexGenerator>('storyIndexGenerator'),
    options.presets.apply<PreviewAnnotation[]>('previewAnnotations', [], options),
  ]);

  const index = await storyIndexGenerator.getIndex();
  const previewOrConfigFile = loadPreviewOrConfigFile({ configDir: options.configDir });

  const mockRedirectIncludeEntries = previewOrConfigFile
    ? getMockRedirectIncludeEntries(
        extractMockCalls(
          {
            previewConfigPath: previewOrConfigFile,
            coreOptions: { disableTelemetry: true },
            configDir: options.configDir,
          },
          babelParser,
          projectRoot,
          findMockRedirect
        )
      )
    : [];

  const previewAnnotationEntries = [...previewAnnotations, previewOrConfigFile]
    .filter((path): path is PreviewAnnotation => path !== undefined)
    .map((path) => processPreviewAnnotation(path, projectRoot));

  return {
    entries: [
      ...mockRedirectIncludeEntries,
      ...getUniqueImportPaths(index).map(escapeGlobPath),
      ...previewAnnotationEntries.map(escapeGlobPath),
    ],
    include: [...extraOptimizeDeps, 'storybook/internal/preview/runtime'],
  };
}

function extractPluginConfigs(plugins: PluginOption[]): InlineConfig {
  let merged: InlineConfig = {};
  for (const plugin of (plugins as Plugin[]).flat().filter(Boolean)) {
    if (
      plugin &&
      typeof plugin === 'object' &&
      'config' in plugin &&
      typeof plugin.config === 'function'
    ) {
      const result = plugin.config({} as any, {
        command: 'serve',
        mode: 'development',
        isSsrBuild: false,
      });
      if (result && typeof result === 'object') {
        merged = mergeConfig(merged, result);
      }
    }
  }
  return merged;
}
