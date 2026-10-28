import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { getPreviewModuleIds } from './constants.ts';
import { generatePreviewModules } from './modules.ts';

const RUNTIME = '/storybook/dist/core/preview/runtime.js';

describe('generatePreviewModules', () => {
  it('generates the entry for each HMR dialect', () => {
    const entries = Object.fromEntries(
      (
        [
          { name: 'vite', hmr: 'vite', declineHmr: false },
          { name: 'webpack', hmr: 'webpack', declineHmr: false },
          { name: 'vite, declined', hmr: 'vite', declineHmr: true },
          { name: 'webpack, declined', hmr: 'webpack', declineHmr: true },
        ] as const
      ).map(({ name, hmr, declineHmr }) => [
        name,
        generatePreviewModules({
          hmr,
          ids: getPreviewModuleIds(hmr, '/project'),
          previewAnnotations: [],
          previewRuntimePath: RUNTIME,
          declineHmr,
        }).entry,
      ])
    );
    expect(entries).toMatchInlineSnapshot(`
      {
        "vite": "import { setup } from "/storybook/dist/core/preview/runtime.js";
      import "virtual:/@storybook/builder-vite/setup-addons.js";

      setup();

      import { PreviewWeb } from 'storybook/preview-api';
      import { importFn } from "virtual:/@storybook/builder-vite/storybook-stories.js";
      import { getProjectAnnotations } from "virtual:/@storybook/builder-vite/project-annotations.js";

      window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);
      window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;

      if (import.meta.hot) {
        import.meta.hot.on('vite:afterUpdate', () => {
          window.__STORYBOOK_PREVIEW__.channel.emit('storyHotUpdated');
        });

        import.meta.hot.accept("virtual:/@storybook/builder-vite/storybook-stories.js", (newModule) => {
          window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn: newModule.importFn });
        });
      }
      ",
        "vite, declined": "import { setup } from "/storybook/dist/core/preview/runtime.js";
      import "virtual:/@storybook/builder-vite/setup-addons.js";

      setup();

      import { PreviewWeb } from 'storybook/preview-api';
      import { importFn } from "virtual:/@storybook/builder-vite/storybook-stories.js";
      import { getProjectAnnotations } from "virtual:/@storybook/builder-vite/project-annotations.js";

      window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);
      window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;

      if (import.meta.hot) {
        import.meta.hot.decline();
      }
      ",
        "webpack": "import "/project/storybook-setup-addons.js";
      import { PreviewWeb } from 'storybook/preview-api';
      import { importFn } from "/project/storybook-stories.js";
      import { getProjectAnnotations } from "/project/storybook-project-annotations.js";

      window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);
      window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;

      if (import.meta.webpackHot) {
        import.meta.webpackHot.addStatusHandler((status) => {
          if (status === 'idle') {
            window.__STORYBOOK_PREVIEW__.channel.emit('storyHotUpdated');
          }
        });

        import.meta.webpackHot.accept("/project/storybook-stories.js", () => {
          window.__STORYBOOK_PREVIEW__.onStoriesChanged({ importFn });
        });
      }
      ",
        "webpack, declined": "import "/project/storybook-setup-addons.js";
      import { PreviewWeb } from 'storybook/preview-api';
      import { importFn } from "/project/storybook-stories.js";
      import { getProjectAnnotations } from "/project/storybook-project-annotations.js";

      window.__STORYBOOK_PREVIEW__ = window.__STORYBOOK_PREVIEW__ || new PreviewWeb(importFn, getProjectAnnotations);
      window.__STORYBOOK_STORY_STORE__ = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_PREVIEW__.storyStore;

      if (import.meta.webpackHot) {
        import.meta.webpackHot.decline();
      }
      ",
      }
    `);
  });

  it('composes the annotations, user preview last, for each HMR dialect', () => {
    const modules = Object.fromEntries(
      (
        [
          { name: 'vite', hmr: 'vite', previewAnnotations: ['/renderer.js', '/preview.ts'] },
          { name: 'webpack', hmr: 'webpack', previewAnnotations: ['/renderer.js', '/preview.ts'] },
          { name: 'no annotations', hmr: 'vite', previewAnnotations: [] },
        ] as const
      ).map(({ name, hmr, previewAnnotations }) => [
        name,
        generatePreviewModules({
          hmr,
          ids: getPreviewModuleIds(hmr, '/project'),
          previewAnnotations: [...previewAnnotations],
          previewRuntimePath: RUNTIME,
          declineHmr: false,
        }).projectAnnotations,
      ])
    );
    expect(modules).toMatchInlineSnapshot(`
      {
        "no annotations": "import { composeConfigs } from 'storybook/preview-api';

      const hmrModules = [];

      export function getProjectAnnotations() {
        const modules = [].map((module, index) => hmrModules[index] ?? module);
        const preview = modules[modules.length - 1]?.default;
        // A CSF factories preview composes the other annotations itself.
        if (preview?._tag === 'Preview') {
          return preview.composeWith(modules.slice(0, -1));
        }
        return composeConfigs(modules);
      }

      if (import.meta.hot) {
        import.meta.hot.accept([], (modules) => {
          modules.forEach((module, index) => {
            if (module) hmrModules[index] = module;
          });
          window.__STORYBOOK_PREVIEW__?.onGetProjectAnnotationsChanged({ getProjectAnnotations });
        });
      }
      ",
        "vite": "import { composeConfigs } from 'storybook/preview-api';

      import * as previewAnnotations0 from "/renderer.js";
      import * as previewAnnotations1 from "/preview.ts";

      const hmrModules = [];

      export function getProjectAnnotations() {
        const modules = [previewAnnotations0, previewAnnotations1].map((module, index) => hmrModules[index] ?? module);
        const preview = modules[modules.length - 1]?.default;
        // A CSF factories preview composes the other annotations itself.
        if (preview?._tag === 'Preview') {
          return preview.composeWith(modules.slice(0, -1));
        }
        return composeConfigs(modules);
      }

      if (import.meta.hot) {
        import.meta.hot.accept(["/renderer.js","/preview.ts"], (modules) => {
          modules.forEach((module, index) => {
            if (module) hmrModules[index] = module;
          });
          window.__STORYBOOK_PREVIEW__?.onGetProjectAnnotationsChanged({ getProjectAnnotations });
        });
      }
      ",
        "webpack": "import { composeConfigs } from 'storybook/preview-api';

      import * as previewAnnotations0 from "/renderer.js";
      import * as previewAnnotations1 from "/preview.ts";

      const hmrModules = [];

      export function getProjectAnnotations() {
        const modules = [previewAnnotations0, previewAnnotations1].map((module, index) => hmrModules[index] ?? module);
        const preview = modules[modules.length - 1]?.default;
        // A CSF factories preview composes the other annotations itself.
        if (preview?._tag === 'Preview') {
          return preview.composeWith(modules.slice(0, -1));
        }
        return composeConfigs(modules);
      }

      if (import.meta.webpackHot) {
        import.meta.webpackHot.accept(["/renderer.js","/preview.ts"], () => {
          window.__STORYBOOK_PREVIEW__?.onGetProjectAnnotationsChanged({ getProjectAnnotations });
        });
      }
      ",
      }
    `);
  });

  it('sets up the preview channel', () => {
    expect(
      generatePreviewModules({
        hmr: 'vite',
        ids: getPreviewModuleIds('vite', '/project'),
        previewAnnotations: [],
        previewRuntimePath: RUNTIME,
        declineHmr: false,
      }).addonSetup
    ).toMatchInlineSnapshot(`
      "import { createBrowserChannel } from 'storybook/internal/channels';
      import { addons } from 'storybook/preview-api';

      const channel = createBrowserChannel({ page: 'preview' });
      addons.setChannel(channel);

      if (window.CONFIG_TYPE === 'DEVELOPMENT') {
        window.__STORYBOOK_SERVER_CHANNEL__ = channel;
      }"
    `);
  });

  it.each([
    {
      name: 'a CSF factories preview composes the other annotations',
      files: {
        'addon.js': 'export const parameters = { addon: true };',
        'preview.js':
          "export default { _tag: 'Preview', composeWith: (modules) => ['composeWith', modules.length] };",
      },
      expected: ['composeWith', 1],
    },
    {
      name: 'a plain preview is composed with composeConfigs',
      files: {
        'addon.js': 'export const parameters = { addon: true };',
        'preview.js': 'export const parameters = { preview: true };',
      },
      expected: ['composeConfigs', 2],
    },
    {
      name: 'annotations without a user preview are composed with composeConfigs',
      files: {
        'addon.js': 'export default { addon: true };',
      },
      expected: ['composeConfigs', 1],
    },
  ])('$name', async ({ files, expected }) => {
    const dir = await mkdtemp(join(tmpdir(), 'preview-modules-'));
    await writeFile(
      join(dir, 'preview-api.js'),
      "export const composeConfigs = (modules) => ['composeConfigs', modules.length];"
    );
    for (const [file, code] of Object.entries(files)) {
      await writeFile(join(dir, file), code);
    }
    const { projectAnnotations } = generatePreviewModules({
      hmr: 'vite',
      ids: getPreviewModuleIds('vite', dir),
      previewAnnotations: Object.keys(files).map((file) => join(dir, file)),
      previewRuntimePath: RUNTIME,
      declineHmr: false,
    });
    const modulePath = join(dir, 'project-annotations.js');
    // The temporary directory cannot resolve `storybook`, so the stub stands in for it.
    await writeFile(
      modulePath,
      projectAnnotations.replace(`'storybook/preview-api'`, `'./preview-api.js'`)
    );
    const { getProjectAnnotations } = await import(
      /* @vite-ignore */ pathToFileURL(modulePath).href
    );
    expect(getProjectAnnotations()).toEqual(expected);
  });
});
