import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { expect, it } from 'vitest';

import type { Storybook } from '../instance/types.ts';
import { getPreviewSources } from './preview-sources.ts';

const HOOK_VALUES: Record<string, unknown> = {
  'core:config:extend': { channelOptions: { maxDepth: 10 } },
  'core:build:extend': { test: { disableBlocks: true } },
  'core:framework-options:extend': { strictMode: true },
  'preview:log-level:extend': 'info',
  'preview:head:extend': '<link rel="preconnect" href="https://example.com" />',
  'preview:body:extend': '<div id="portal"></div>',
  'core:tags:extend': { autodocs: { excludeFromSidebar: true } },
  'core:env:extend': { STORYBOOK: 'true' },
};

async function createProject(files: Record<string, string>): Promise<string> {
  const workingDir = await mkdtemp(join(tmpdir(), 'preview-sources-'));
  await mkdir(join(workingDir, '.storybook'));
  for (const [file, code] of Object.entries(files)) {
    await writeFile(join(workingDir, file), code);
  }
  return workingDir;
}

function createStorybook(workingDir: string, mode: Storybook['mode']): Storybook {
  return {
    mode,
    configDir: join(workingDir, '.storybook'),
    workingDir,
    options: {
      configType: mode === 'build' ? 'PRODUCTION' : 'DEVELOPMENT',
      stories: ['../src/**/*.stories.ts'],
      previewAnnotations: [
        '/node_modules/@storybook/react/dist/entry-preview.js',
        { bare: '@storybook/addon-docs/preview', absolute: '/node_modules/addon-docs/preview.js' },
        '/node_modules/@storybook/react/dist/entry-preview.js',
      ],
      features: { developmentModeForBuild: true },
      docs: { defaultName: 'Docs' },
    },
    callHook: async (name: string, value: unknown) => HOOK_VALUES[name] ?? value,
  } as unknown as Storybook;
}

it('renders the preview page from the instance configuration', async () => {
  const workingDir = await createProject({ '.storybook/preview.ts': 'export default {};' });
  const preview = await getPreviewSources(createStorybook(workingDir, 'dev'), {
    hmr: 'vite',
    previewRuntimePath: '/storybook/dist/core/preview/runtime.js',
    insecureIframeMessaging: true,
  });
  const html = preview.html({
    head: '<link rel="stylesheet" href="./main.css" />',
    scripts: '<script type="module" src="./entry.js"></script>',
    mockerRuntimeUrl: './mocker-runtime.js',
  });
  expect(html.replaceAll(workingDir, '<project>')).toMatchInlineSnapshot(`
    "<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <script type="module" src="./mocker-runtime.js"></script>
        <title>Storybook</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <style>
          @font-face {
            font-family: 'Nunito Sans';
            font-style: normal;
            font-weight: 400;
            font-display: swap;
            src: url('./sb-common-assets/nunito-sans-regular.woff2') format('woff2');
          }

          @font-face {
            font-family: 'Nunito Sans';
            font-style: italic;
            font-weight: 400;
            font-display: swap;
            src: url('./sb-common-assets/nunito-sans-italic.woff2') format('woff2');
          }

          @font-face {
            font-family: 'Nunito Sans';
            font-style: normal;
            font-weight: 700;
            font-display: swap;
            src: url('./sb-common-assets/nunito-sans-bold.woff2') format('woff2');
          }

          @font-face {
            font-family: 'Nunito Sans';
            font-style: italic;
            font-weight: 700;
            font-display: swap;
            src: url('./sb-common-assets/nunito-sans-bold-italic.woff2') format('woff2');
          }

          #storybook-root[hidden],
          #storybook-docs[hidden] {
            display: none !important;
          }
        </style>

        <script>
          window["CONFIG_TYPE"] = "DEVELOPMENT";
          window["LOGLEVEL"] = "info";
          window["FRAMEWORK_OPTIONS"] = {"strictMode":true};
          window["CHANNEL_OPTIONS"] = {"maxDepth":10};
          window["FEATURES"] = {"developmentModeForBuild":true};
          window["STORIES"] = [{"titlePrefix":"","directory":"./src","files":"**/*.stories.ts","importPathMatcher":"^\\\\.[\\\\\\\\/](?:src(?:\\\\/(?!\\\\.)(?:(?:(?!(?:^|\\\\/)\\\\.).)*?)\\\\/|\\\\/|$)(?!\\\\.)(?=.)[^/]*?\\\\.stories\\\\.ts)$"}];
          window["DOCS_OPTIONS"] = {"defaultName":"Docs"};
          window["TAGS_OPTIONS"] = {"autodocs":{"excludeFromSidebar":true}};
          window["__STORYBOOK_BLOCKS_EMPTY_MODULE__"] = {};
          window["INSECURE_IFRAME_MESSAGING"] = true;

          // Disable "module && module.hot" checks in Storybook source code.
          window.module = undefined;
          window.global = window;
        </script>
        <link rel="preconnect" href="https://example.com" />
        <link rel="stylesheet" href="./main.css" />
      </head>

      <body>
        <div id="portal"></div>
        <div id="storybook-root"></div>
        <div id="storybook-docs"></div>
        <script type="module" src="./entry.js"></script>
      </body>
    </html>
    "
  `);
});

it('collects annotations, externals, and defines for the builder', async () => {
  const workingDir = await createProject({ '.storybook/preview.ts': 'export default {};' });
  const preview = await getPreviewSources(createStorybook(workingDir, 'build'), {
    hmr: 'webpack',
    previewRuntimePath: '/storybook/dist/core/preview/runtime.js',
  });
  expect(
    JSON.parse(
      JSON.stringify({
        virtualModuleIds: preview.virtualModuleIds,
        previewAnnotations: preview.previewAnnotations,
        previewConfigPath: preview.previewConfigPath,
        blocksExternal: preview.externals['@storybook/addon-docs/blocks'],
        define: preview.define({ env: 'import.meta.env' }),
      }).replaceAll(workingDir, '<project>')
    )
  ).toMatchInlineSnapshot(`
    {
      "blocksExternal": "__STORYBOOK_BLOCKS_EMPTY_MODULE__",
      "define": {
        "import.meta.env": "{"STORYBOOK":"\\"true\\""}",
        "import.meta.env.STORYBOOK": ""true"",
        "process.env.NODE_ENV": ""development"",
      },
      "previewAnnotations": [
        "/node_modules/@storybook/react/dist/entry-preview.js",
        "/node_modules/addon-docs/preview.js",
        "<project>/.storybook/preview.ts",
      ],
      "previewConfigPath": "<project>/.storybook/preview.ts",
      "virtualModuleIds": {
        "addonSetup": "<project>/storybook-setup-addons.js",
        "entry": "<project>/storybook-config-entry.js",
        "importFn": "<project>/storybook-stories.js",
        "projectAnnotations": "<project>/storybook-project-annotations.js",
      },
    }
  `);
});

it('omits the mocker runtime without a preview config', async () => {
  const workingDir = await createProject({});
  const preview = await getPreviewSources(createStorybook(workingDir, 'dev'), {
    hmr: 'vite',
    previewRuntimePath: '/storybook/dist/core/preview/runtime.js',
  });
  expect(
    preview.html({ scripts: '', mockerRuntimeUrl: './mocker-runtime.js' }).includes('mocker')
  ).toBe(false);
  expect(preview.previewAnnotations).toEqual([
    '/node_modules/@storybook/react/dist/entry-preview.js',
    '/node_modules/addon-docs/preview.js',
  ]);
});
