import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getAddonNames,
  getFrameworkName,
  loadMainConfig,
  loadPreviewOrConfigFile,
  normalizeStories,
} from 'storybook/internal/common';
import type { PresetProperty } from 'storybook/internal/types';

import type { ViteFinal } from '@storybook/builder-vite';

import type { Plugin } from 'vite';
import { vitestPluginRSC } from 'vitest-plugin-rsc';
import { layerEnvironments, vitestPluginNext } from 'vitest-plugin-rsc/nextjs/plugin';

import type { FrameworkOptions } from './types.ts';

const frameworkDir = path.dirname(
  fileURLToPath(import.meta.resolve('@storybook/nextjs-vite-rsc/package.json'))
);

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
};

// Builds the three layers of the app, as `vite build` does
export const features: PresetProperty<'features'> = async (existing) => ({
  ...existing,
  viteAppBuilder: true,
});

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (input = []) => [
  ...input,
  fileURLToPath(import.meta.resolve('@storybook/nextjs-vite-rsc/entry-preview')),
];

// Storybook's plugins are for the preview, the `client` environment, which is the rsc layer: not
// for the other two layers, but for the MDX plugin, as a docs page is code of the browser layer.
const storybookPlugins = [/^storybook:(?!mdx-plugin$)/, /^vite:storybook-/];

// `@storybook/addon-docs` aliases React to the project's in every environment, which would take
// away the React that Next gives each layer of the app.
const reactAliases = new Set(['react', 'react-dom', 'react-dom/server']);
const withoutReactAliases: Plugin = {
  name: 'nextjs-vite-rsc:without-react-aliases',
  config: {
    order: 'post',
    handler(config) {
      const alias = config.resolve?.alias;
      if (Array.isArray(alias)) {
        config.resolve!.alias = alias.filter(
          ({ find }: { find: unknown }) => typeof find !== 'string' || !reactAliases.has(find)
        );
      } else if (alias) {
        for (const name of reactAliases) delete (alias as Record<string, string>)[name];
      }
    },
  },
};

// The preview, the rsc layer, never loads the docs page and React DOM that addon-docs pre-bundles
// for it: the browser layer pre-bundles them.
const docsDependencies = /^(@storybook\/addon-docs|react-dom\/client)([\s/]|$)/;
const withoutDocsDependencies: Plugin = {
  name: 'nextjs-vite-rsc:without-docs-dependencies',
  config: {
    order: 'post',
    handler(config) {
      const include = config.optimizeDeps?.include;
      if (include)
        config.optimizeDeps!.include = include.filter((name) => !docsDependencies.test(name));
    },
  },
};

// The modules of Storybook that render with React DOM, which the browser layer loads
const docsPackages = [
  '@storybook/addon-docs',
  'storybook/theming',
  'storybook/internal/theming',
  'storybook/internal/components',
  'storybook/manager-api',
  'storybook/internal/manager-api',
  'storybook/internal/router',
];

function docsInTheBrowserLayer(root: string): Plugin {
  const project = createRequire(path.join(root, 'package.json'));
  const files = new Set(
    ['@storybook/addon-docs', '@storybook/addon-docs/preview'].flatMap((name) => {
      try {
        return [normalize(project.resolve(name))];
      } catch {
        return [];
      }
    })
  );
  const standIn = fileURLToPath(
    import.meta.resolve('@storybook/nextjs-vite-rsc/internal/addon-docs')
  );
  return {
    name: 'nextjs-vite-rsc:docs-in-the-browser-layer',
    enforce: 'pre',
    applyToEnvironment: (environment) => environment.name === layerEnvironments.rsc,
    resolveId(source) {
      const isDocs =
        source === '@storybook/addon-docs' ||
        source === '@storybook/addon-docs/preview' ||
        files.has(normalize(source));
      return isDocs ? standIn : undefined;
    },
  };
}

// The packages of Storybook that run in the preview: its own, the framework and the addons of the
// project, which are not all of Storybook's scope. See `host.packages` of vitest-plugin-rsc.
async function storybookPackages(options: Parameters<ViteFinal>[1]): Promise<string[]> {
  const main = await loadMainConfig({ configDir: options.configDir });
  const names = [await getFrameworkName(options), ...getAddonNames(main)].map((name) =>
    // A name can be the path of a package, as `getAbsolutePath()` gives it.
    normalize(name).replace(/^.*\/node_modules\//, '')
  );
  // Not a local addon, which is a file of the project.
  const packages = names.flatMap((name) => /^(@[^/]+\/)?[^./][^/]*/.exec(name)?.[0] ?? []);
  return ['storybook', ...new Set(packages)];
}

const normalize = (name: string) => name.split(path.sep).join('/');

// The files that render around every story, by their path from the root, and the root and the
// working directory of Storybook, which names story files from it, from the directory both are
// in: see `fromRoot()` in render.tsx.
const projectId = 'virtual:@storybook/nextjs-vite-rsc/project';
function project(configDir: string): Plugin {
  let code = '';
  return {
    name: 'nextjs-vite-rsc:project',
    configResolved(config) {
      const preview = loadPreviewOrConfigFile({ configDir });
      const previewFiles = preview ? [`./${normalize(path.relative(config.root, preview))}`] : [];
      const toWorkingDir = normalize(path.relative(config.root, process.cwd()))
        .split('/')
        .filter(Boolean);
      const up = toWorkingDir.filter((part) => part === '..').length;
      const root = normalize(config.root).split('/').filter(Boolean);
      const workingDir = { root: root.slice(root.length - up), cwd: toWorkingDir.slice(up) };
      code =
        `export const previewFiles = ${JSON.stringify(previewFiles)};\n` +
        `export const workingDir = ${JSON.stringify(workingDir)};\n`;
    },
    resolveId: (source) => (source === projectId ? `\0${projectId}` : undefined),
    load: (id) => (id === `\0${projectId}` ? code : undefined),
  };
}

// Docs pages, files of a UI of the host: see docs/addon-docs.ts
async function docsFiles(options: Parameters<ViteFinal>[1]): Promise<string[]> {
  const stories = await options.presets.apply('stories', [], options);
  const workingDir = process.cwd();
  return normalizeStories(stories, { configDir: options.configDir, workingDir }).flatMap(
    ({ directory, files }) =>
      files.includes('mdx')
        ? [path.posix.join(normalize(path.resolve(workingDir, directory)), '**/*.mdx')]
        : []
  );
}

const docsRendererFile = fileURLToPath(
  import.meta.resolve('@storybook/nextjs-vite-rsc/internal/docs-renderer')
);

// The modules of the framework that are code of the browser layer. In dev, Vite gives a module of
// `node_modules` a version query, like `?v=1a2b3c4d`, and the plugin leaves a module with a query
// alone: in the preview, they keep their path.
const browserLayerModules = [
  '@storybook/nextjs-vite-rsc/internal/client-story',
  '@storybook/nextjs-vite-rsc/internal/docs-renderer',
];
const browserLayerModulesByPath: Plugin = {
  name: 'nextjs-vite-rsc:browser-layer-modules-by-path',
  enforce: 'pre',
  applyToEnvironment: (environment) => environment.name === layerEnvironments.rsc,
  resolveId: (source) =>
    browserLayerModules.includes(source) ? fileURLToPath(import.meta.resolve(source)) : undefined,
};

export const viteFinal: ViteFinal = async (config, options) => {
  const root = config.root ?? process.cwd();
  const packages = await storybookPackages(options);
  const docs = packages.includes('@storybook/addon-docs');
  const mdxFiles = docs ? await docsFiles(options) : [];
  return {
    ...config,
    optimizeDeps: {
      ...config.optimizeDeps,
      // Pre-bundled, the framework's module with "use client" would be a chunk of the bundle and no
      // longer a module of the browser layer (vitejs/vite-plugin-react#906).
      exclude: [...(config.optimizeDeps?.exclude ?? []), '@storybook/nextjs-vite-rsc'],
    },
    environments: {
      ...config.environments,
      ...(docs && {
        [layerEnvironments.browser]: {
          optimizeDeps: {
            include: [
              '@storybook/addon-docs',
              '@storybook/addon-docs/blocks',
              '@storybook/addon-docs > @mdx-js/react',
            ],
          },
        },
      }),
    },
    plugins: [
      ...(config.plugins ?? []),
      withoutReactAliases,
      browserLayerModulesByPath,
      ...(docs ? [docsInTheBrowserLayer(root), withoutDocsDependencies] : []),
      project(options.configDir),
      vitestPluginRSC(),
      vitestPluginNext({
        browserModules: ((await options.presets.apply('frameworkOptions')) as FrameworkOptions)
          ?.browserModules,
        host: {
          files: ['**/*.stories.*', `${options.configDir}/**`, `${frameworkDir}/**`],
          packages,
          ui: { packages: docsPackages, files: [...mdxFiles, docsRendererFile] },
          plugins: storybookPlugins,
        },
      }),
    ],
  };
};
