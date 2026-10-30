import { fileURLToPath } from 'node:url';

import { Channel } from '@storybook/core/internal/channels';
import { createStorybook, defineFramework, type Storybook } from 'storybook/internal/instance';
import type { PreviewSources } from '@storybook/core/internal/preview-page';

import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpackModule, { type Configuration } from 'webpack';
import { expect, it, vi } from 'vitest';

import { getWebpackConfig } from '../builder.ts';
import { webpack } from './index.ts';

vi.mock('@storybook/core/internal/node-logger', { spy: true });

const PREVIEW: PreviewSources = {
  html: ({ head, scripts, mockerRuntimeUrl }) =>
    `head: ${head}\nmocker: ${mockerRuntimeUrl}\nscripts: ${scripts}`,
  modules: { entry: 'entry', addonSetup: 'addon-setup', projectAnnotations: 'annotations' },
  virtualModuleIds: {
    entry: '/project/storybook-config-entry.js',
    addonSetup: '/project/storybook-setup-addons.js',
    projectAnnotations: '/project/storybook-project-annotations.js',
    importFn: '/project/storybook-stories.js',
  },
  externals: { 'storybook/preview-api': '__STORYBOOK_MODULE_PREVIEW_API__' },
  define: (target) => ({ 'process.env': `"${target.env}"` }),
  env: {},
  stories: [],
  previewAnnotations: [],
  previewConfigPath: undefined,
  previewRuntimePath: '/storybook/dist/core/preview/runtime.js',
};

function fakeStorybook(mode: Storybook['mode']): Storybook {
  const hooks: Record<string, (value: never) => unknown> = {
    'preview:entries:collect': (entries: string[]) => [...entries, '/addon-entry.js'],
    'builder:webpack-config:extend': (config: Configuration) => ({
      ...config,
      resolve: { ...config.resolve, alias: { addon: '/addon.js' } },
    }),
    'builder:webpack:extend': (config: Configuration) => ({ ...config, context: '/final' }),
  };
  return {
    mode,
    configDir: '/project/.storybook',
    workingDir: '/project',
    options: { quiet: true },
    addons: [],
    channel: new Channel({}),
    callHook: vi.fn(async (name: string, value: unknown) => hooks[name]?.(value as never) ?? value),
  } as unknown as Storybook;
}

it('builds the dev and build configs from the instance and preview sources', async () => {
  const configs = await Promise.all(
    (['dev', 'build'] as const).map(async (mode) => {
      const { config, webpack: instance } = await getWebpackConfig(fakeStorybook(mode), PREVIEW, {
        outputDir: '/project/storybook-static',
        builderOptions: undefined,
      });
      const html = config.plugins!.find((plugin) => plugin instanceof HtmlWebpackPlugin)!;
      const define = config.plugins!.find(
        (plugin) => plugin instanceof webpackModule.DefinePlugin
      ) as InstanceType<typeof webpackModule.DefinePlugin>;
      const templateContent = html.userOptions.templateContent as (input: unknown) => string;
      return [
        mode,
        {
          instance: instance === webpackModule ? 'webpack' : instance,
          mode: config.mode,
          context: config.context,
          entry: (config.entry as string[]).map((entry) =>
            entry.includes('webpack-hot-middleware') ? '<hot-client>' : entry
          ),
          outputPath: config.output?.path,
          externals: config.externals,
          alias: config.resolve?.alias,
          define: define.definitions,
          html: templateContent({
            htmlWebpackPlugin: { files: { js: ['main.iframe.bundle.js'], css: ['main.css'] } },
          }),
        },
      ];
    })
  );
  expect(Object.fromEntries(configs)).toMatchInlineSnapshot(`
    {
      "build": {
        "alias": {
          "addon": "/addon.js",
        },
        "context": "/final",
        "define": {
          "process.env": ""process.env"",
        },
        "entry": [
          "/addon-entry.js",
          "/project/storybook-config-entry.js",
        ],
        "externals": {
          "storybook/preview-api": "__STORYBOOK_MODULE_PREVIEW_API__",
        },
        "html": "head: <link href="main.css" rel="stylesheet" />
    mocker: mocker-runtime-injected.js
    scripts: <script type="module">
          import './sb-preview/runtime.js';
          import './main.iframe.bundle.js';
        </script>",
        "instance": "webpack",
        "mode": "production",
        "outputPath": "/project/storybook-static",
      },
      "dev": {
        "alias": {
          "addon": "/addon.js",
        },
        "context": "/final",
        "define": {
          "process.env": ""process.env"",
        },
        "entry": [
          "<hot-client>",
          "/addon-entry.js",
          "/project/storybook-config-entry.js",
        ],
        "externals": {
          "storybook/preview-api": "__STORYBOOK_MODULE_PREVIEW_API__",
        },
        "html": "head: <link href="main.css" rel="stylesheet" />
    mocker: mocker-runtime-injected.js
    scripts: <script type="module">
          import './sb-preview/runtime.js';
          import './main.iframe.bundle.js';
        </script>",
        "instance": "webpack",
        "mode": "development",
        "outputPath": "/project/storybook-static",
      },
    }
  `);
});

it.each([
  { previewConfigPath: undefined, expected: [] },
  {
    previewConfigPath: '/project/.storybook/preview.ts',
    expected: ['WebpackMockPlugin', 'WebpackInjectMockerRuntimePlugin'],
  },
])(
  'adds module mocking for preview config $previewConfigPath',
  async ({ previewConfigPath, expected }) => {
    const { config } = await getWebpackConfig(
      fakeStorybook('dev'),
      { ...PREVIEW, previewConfigPath },
      { outputDir: '/project/storybook-static', builderOptions: undefined }
    );
    expect(
      config.plugins!.map((plugin) => plugin?.constructor.name).filter((name) => /Mock/.test(name!))
    ).toEqual(expected);
  }
);

it('keeps custom Webpack overrides after user config hooks', async () => {
  const framework = defineFramework(() => ({
    meta: { name: 'test-framework' },
    builder: webpack(),
    renderer: { meta: { name: 'test-renderer', kind: 'renderer' }, setup(): void {} },
    setup(): void {},
  }))();
  const main = {
    framework,
    stories: ['./*.stories.ts'],
    webpack: (config: Configuration) => ({ ...config, context: '/user' }),
    webpackFinal: (config: Configuration) => ({
      ...config,
      context: `${config.context}/user-final`,
    }),
  };
  const storybook = createStorybook({
    configDir: fileURLToPath(new URL('./__fixtures__/first', import.meta.url)),
    mode: 'headless',
    main,
  });
  await storybook.ready();
  try {
    const adapter = storybook.builder!.changeDetectionAdapter(storybook);
    await expect(adapter.getResolveConfig()).resolves.toMatchObject({
      projectRoot: '/user/user-final',
      conditions: ['storybook', 'stories', 'test', '...'],
    });
  } finally {
    await storybook.close();
  }
});
