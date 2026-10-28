import { createServer } from 'node:http';

import { Channel } from '@storybook/core/internal/channels';
import type { Storybook } from '@storybook/core';
import {
  VITE_PREVIEW_MODULE_IDS,
  type PreviewSources,
} from '@storybook/core/internal/preview-page';
import type { ServerApp } from '@storybook/core/internal/types';

import type { InlineConfig, Plugin, ResolvedConfig, ViteDevServer } from 'vite';
import { build as viteBuild, createServer as createViteServer } from 'vite';
import { describe, expect, it, vi } from 'vitest';

import { vite } from './index.ts';

vi.mock(import('vite'), async (importOriginal) => ({
  ...(await importOriginal()),
  build: vi.fn(async () => []),
  createServer: vi.fn(async (config?: InlineConfig | ResolvedConfig) =>
    fakeViteServer(config as InlineConfig)
  ),
  loadConfigFromFile: vi.fn(async () => null),
}));

const PREVIEW: PreviewSources = {
  html: ({ head, scripts, mockerRuntimeUrl }) =>
    [
      `<core-page mocker="${mockerRuntimeUrl}">`,
      `<head-slot>${head}</head-slot>`,
      // The loading error handler body is Vite-specific markup the page only carries along.
      scripts.replace(/<script>[\s\S]*?<\/script>/, '<script>/* loading error handler */</script>'),
      '</core-page>',
    ].join('\n'),
  modules: { entry: '// entry', projectAnnotations: '// annotations', addonSetup: '// setup' },
  virtualModuleIds: VITE_PREVIEW_MODULE_IDS,
  externals: { 'storybook/preview-api': '__STORYBOOK_MODULE_PREVIEW_API__' },
  define: (target) => ({ [`${target.env}.STORYBOOK`]: '"true"' }),
  env: { STORYBOOK: 'true' },
  stories: [],
  previewAnnotations: ['/project/.storybook/preview.ts'],
  previewConfigPath: '/project/.storybook/preview.ts',
  previewRuntimePath: '/storybook/dist/core/preview/runtime.js',
};

function fakeStorybook(mode: Storybook['mode']): Storybook {
  return {
    mode,
    configDir: '/project/.storybook',
    workingDir: '/project',
    channel: new Channel({}),
    options: { configType: mode === 'build' ? 'PRODUCTION' : 'DEVELOPMENT', port: 6006 },
    callHook: vi.fn(async (name: string, value: unknown, ctx?: Record<string, unknown>) => {
      if (name === 'core:config:extend') {
        return { allowedHosts: ['example.com'] };
      }
      if (name === 'builder:vite:extend') {
        return { ...(value as InlineConfig), define: { EXTENDED_IN: ctx?.configType } };
      }
      return value;
    }),
    getStoryIndexGenerator: async () => ({
      getIndex: async () => ({ v: 5, entries: {} }),
      onInvalidated: vi.fn(),
    }),
  } as unknown as Storybook;
}

function fakeViteServer(config: InlineConfig): ViteDevServer {
  return {
    config: { root: '/project', resolve: {} },
    middlewares: 'vite-middlewares',
    watcher: { on: vi.fn(), off: vi.fn() },
    close: vi.fn(),
    transformIndexHtml: (path: string, html: string) =>
      runHook(findPlugin(config, 'storybook:code-generator-plugin').transformIndexHtml, html, {
        path,
        server: {},
      }),
  } as unknown as ViteDevServer;
}

function findPlugin(config: InlineConfig, name: string): Plugin {
  return (config.plugins as Plugin[]).find((plugin) => plugin.name === name)!;
}

type HookFn = (...args: unknown[]) => any;

function runHook(hook: unknown, ...args: unknown[]): ReturnType<HookFn> {
  const fn = typeof hook === 'function' ? (hook as HookFn) : (hook as { handler: HookFn }).handler;
  return fn.call({}, ...args);
}

async function summarize(config: InlineConfig, command: 'serve' | 'build') {
  const external = await runHook(
    findPlugin(config, 'storybook:external-globals-plugin').transform,
    `import { useArgs } from 'storybook/preview-api';`,
    '/project/src/Button.stories.ts'
  );
  const { define } = await runHook(findPlugin(config, 'storybook:env-plugin').config, {});
  const codeGenerator = findPlugin(config, 'storybook:code-generator-plugin');
  await runHook(codeGenerator.config, config, { command });
  runHook(codeGenerator.configResolved, { root: '/project' });
  return {
    root: config.root,
    base: config.base,
    configFile: config.configFile,
    server: config.server,
    build: config.build,
    extendedDefine: config.define,
    envDefine: define,
    externalGlobals: external.code,
    plugins: (config.plugins as Plugin[]).flat().map((plugin) => plugin.name),
    modules: Object.fromEntries(
      await Promise.all(
        [
          VITE_PREVIEW_MODULE_IDS.entry,
          VITE_PREVIEW_MODULE_IDS.addonSetup,
          VITE_PREVIEW_MODULE_IDS.importFn,
        ].map(async (id) => [
          id,
          await runHook(findPlugin(config, 'storybook:code-generator-plugin').load, `\0${id}`),
        ])
      )
    ),
    projectAnnotations: await runHook(
      findPlugin(config, 'storybook:project-annotations-plugin').load,
      `\0${VITE_PREVIEW_MODULE_IDS.projectAnnotations}`
    ),
  };
}

describe('vite', () => {
  it('serves a dev server configured from the instance and the preview sources', async () => {
    const router = { get: vi.fn(), use: vi.fn() } as unknown as ServerApp;
    const result = await vite().dev(fakeStorybook('dev'), {
      router,
      server: createServer(),
      startTime: process.hrtime(),
      preview: PREVIEW,
    });
    const config = vi.mocked(createViteServer).mock.lastCall![0] as InlineConfig;
    const res = { setHeader: vi.fn(), write: vi.fn(), end: vi.fn() };
    const [[, iframeHandler]] = vi.mocked(router.get).mock.calls as unknown as [
      [string, (req: unknown, res: unknown) => Promise<void>],
    ];
    await iframeHandler({}, res);

    expect({
      ...(await summarize(config, 'serve')),
      server: { ...config.server, hmr: { port: (config.server!.hmr as { port: number }).port } },
      routes: vi.mocked(router.get).mock.calls.map(([path]) => path),
      middlewares: vi.mocked(router.use).mock.calls.map(([middleware]) => middleware),
      iframe: res.write.mock.calls[0][0],
    }).toMatchInlineSnapshot(`
      {
        "base": "./",
        "build": {
          "target": undefined,
        },
        "configFile": false,
        "envDefine": {
          "import.meta.env.STORYBOOK": ""true"",
        },
        "extendedDefine": {
          "EXTENDED_IN": "DEVELOPMENT",
        },
        "externalGlobals": "import { setup as __sbInitializePreviewGlobals } from "/storybook/dist/core/preview/runtime.js";
      __sbInitializePreviewGlobals();
      const { useArgs } = __STORYBOOK_MODULE_PREVIEW_API__;",
        "iframe": "<core-page mocker="/vite-inject-mocker-entry.js">
      <head-slot></head-slot>

          <script>/* loading error handler */</script>
          <script
            type="module"
            src="/@id/__x00__virtual:/@storybook/builder-vite/vite-app.js"
            onerror="__onViteAppLoadingError(event)"
          ></script>
        
      </core-page>",
        "middlewares": [
          "vite-middlewares",
        ],
        "modules": {
          "virtual:/@storybook/builder-vite/setup-addons.js": "// setup",
          "virtual:/@storybook/builder-vite/storybook-stories.js": "const importers = {};

      export async function importFn(path) {
        return await importers[path]();
      }",
          "virtual:/@storybook/builder-vite/vite-app.js": "// entry",
        },
        "plugins": [
          "storybook:project-annotations-plugin",
          "storybook:config-plugin",
          "storybook:allow-storybook-dir",
          "storybook:optimize-deps-plugin",
          "storybook:env-plugin",
          "vite:storybook-inject-mocker-runtime",
          "storybook:mock-loader",
          "storybook:mock-loader-preview",
          "storybook:external-globals-plugin",
          "storybook:code-generator-plugin",
          "storybook:inject-export-order-plugin",
          "storybook:strip-hmr-boundary-plugin",
          "storybook:rollup-plugin-webpack-stats",
        ],
        "projectAnnotations": "// annotations",
        "root": "/project",
        "routes": [
          "/iframe.html",
        ],
        "server": {
          "allowedHosts": [
            "example.com",
          ],
          "fs": {
            "strict": true,
          },
          "hmr": {
            "port": 6006,
          },
          "middlewareMode": true,
        },
      }
    `);
    await result.bail();
  });

  it.each([
    {
      name: 'host server',
      server: createServer(),
      expected: { hmr: 'host server', ws: undefined },
    },
    { name: 'no host server', server: undefined, expected: { hmr: false, ws: false } },
  ])('configures HMR for a $name', async ({ server, expected }) => {
    const router = { get: vi.fn(), use: vi.fn() } as unknown as ServerApp;
    const result = await vite().dev(fakeStorybook('dev'), {
      router,
      server,
      startTime: process.hrtime(),
      preview: PREVIEW,
    });
    const { hmr, ws } = vi.mocked(createViteServer).mock.lastCall![0]!.server!;
    expect({
      hmr: typeof hmr === 'object' && hmr.server === server ? 'host server' : hmr,
      ws,
    }).toEqual(expected);
    await result.bail();
  });

  it('builds the preview configured from the instance and the preview sources', async () => {
    await vite().build(fakeStorybook('build'), {
      startTime: process.hrtime(),
      outDir: '/output',
      preview: PREVIEW,
    });
    const config = vi.mocked(viteBuild).mock.lastCall![0]!;
    const codeGenerator = findPlugin(config, 'storybook:code-generator-plugin');
    const summary = await summarize(config, 'build');
    const iframeId = await runHook(codeGenerator.resolveId, config.build?.rollupOptions?.input);

    expect({
      ...summary,
      iframeId,
      iframe: runHook(
        codeGenerator.transformIndexHtml,
        await runHook(codeGenerator.load, iframeId),
        { path: '/iframe.html' }
      ),
    }).toMatchInlineSnapshot(`
      {
        "base": "./",
        "build": {
          "copyPublicDir": false,
          "emptyOutDir": false,
          "outDir": "/output",
          "rollupOptions": {
            "external": [
              /\\\\\\.\\\\/sb-common-assets\\\\/\\.\\*\\\\\\.woff2/,
            ],
            "input": "virtual:/@storybook/builder-vite/iframe.html",
          },
          "target": undefined,
        },
        "configFile": false,
        "envDefine": {
          "import.meta.env.STORYBOOK": ""true"",
        },
        "extendedDefine": {
          "EXTENDED_IN": "PRODUCTION",
        },
        "externalGlobals": "import { setup as __sbInitializePreviewGlobals } from "/storybook/dist/core/preview/runtime.js";
      __sbInitializePreviewGlobals();
      const { useArgs } = __STORYBOOK_MODULE_PREVIEW_API__;",
        "iframe": "<core-page mocker="./vite-inject-mocker-entry.js">
      <head-slot></head-slot>

          <script>/* loading error handler */</script>
          <script
            type="module"
            src="virtual:/@storybook/builder-vite/vite-app.js"
            onerror="__onViteAppLoadingError(event)"
          ></script>
        
      </core-page>",
        "iframeId": "/project/iframe.html",
        "modules": {
          "virtual:/@storybook/builder-vite/setup-addons.js": "// setup",
          "virtual:/@storybook/builder-vite/storybook-stories.js": "const importers = {};

      export async function importFn(path) {
        return await importers[path]();
      }",
          "virtual:/@storybook/builder-vite/vite-app.js": "// entry",
        },
        "plugins": [
          "storybook:project-annotations-plugin",
          "storybook:config-plugin",
          "storybook:allow-storybook-dir",
          "storybook:optimize-deps-plugin",
          "storybook:env-plugin",
          "vite:storybook-inject-mocker-runtime",
          "storybook:mock-loader",
          "storybook:mock-loader-preview",
          "storybook:external-globals-plugin",
          "storybook:code-generator-plugin",
          "storybook:inject-export-order-plugin",
          "storybook:strip-hmr-boundary-plugin",
          "storybook:rollup-plugin-webpack-stats",
          "storybook:enforce-build-options",
        ],
        "projectAnnotations": "// annotations",
        "root": "/project",
        "server": undefined,
      }
    `);
  });

  it('owns each dev server and change detection adapter independently', async () => {
    const storybook = fakeStorybook('dev');
    const first = vite();
    const second = vite();
    const host = {
      router: { get: vi.fn(), use: vi.fn() } as unknown as ServerApp,
      server: createServer(),
      startTime: process.hrtime(),
      preview: PREVIEW,
    };
    const firstDev = await first.dev(storybook, host);
    const firstServer = await vi.mocked(createViteServer).mock.results.at(-1)!.value;
    const secondDev = await second.dev(storybook, host);
    const secondServer = await vi.mocked(createViteServer).mock.results.at(-1)!.value;

    first.changeDetectionAdapter(storybook).onFileChange(vi.fn());
    expect(firstServer.watcher.on).toHaveBeenCalled();
    expect(secondServer.watcher.on).not.toHaveBeenCalled();
    await firstDev.bail();
    expect(firstServer.close).toHaveBeenCalledOnce();
    expect(secondServer.close).not.toHaveBeenCalled();
    await secondDev.bail();
    expect(secondServer.close).toHaveBeenCalledOnce();
  });
});
