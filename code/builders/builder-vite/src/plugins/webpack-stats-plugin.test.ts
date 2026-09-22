import type { ModuleInfo } from 'rollup';
import { describe, expect, it } from 'vitest';

import { pluginWebpackStats } from './webpack-stats-plugin.ts';

const workingDir = '/project';

type RawGraph = Record<string, string[]>;
type ParsedModule = Pick<ModuleInfo, 'id' | 'importedIds' | 'dynamicallyImportedIds'>;

function getStats(graph: RawGraph) {
  const plugin = pluginWebpackStats({ workingDir });
  const moduleParsed = plugin.moduleParsed as unknown as (mod: ParsedModule) => void;

  for (const [id, importedIds] of Object.entries(graph)) {
    moduleParsed({ id, importedIds, dynamicallyImportedIds: [] });
  }

  return plugin.storybookGetStats().toJson();
}

function getModuleNames(graph: RawGraph) {
  return getStats(graph).modules.map((module: { name: string }) => module.name);
}

function getImporters(graph: RawGraph, name: string) {
  const module = getStats(graph).modules.find((m: { name: string }) => m.name === name);
  return module?.reasons?.map((reason: { moduleName: string }) => reason.moduleName);
}

function getDependencies(graph: RawGraph, name: string) {
  const { modules } = getStats(graph);
  const found = new Set<string>();
  const queue = [name];

  while (queue.length > 0) {
    const current = queue.pop();
    for (const module of modules) {
      const isImported = module.reasons?.some(
        (reason: { moduleName: string }) => reason.moduleName === current
      );
      if (isImported && !found.has(module.name)) {
        found.add(module.name);
        queue.push(module.name);
      }
    }
  }

  return [...found];
}

describe('pluginWebpackStats', () => {
  it('names project files relative to the working directory', () => {
    const importers = getImporters(
      { '/project/src/Button.tsx': ['/project/src/theme.ts'] },
      './src/theme.ts'
    );

    expect(importers).toEqual(['./src/Button.tsx']);
  });

  it('keeps the virtual module names that turbosnap matches on', () => {
    const names = getModuleNames({
      '\0virtual:/@storybook/builder-vite/vite-app.js': [
        '\0virtual:/@storybook/builder-vite/storybook-stories.js',
        '\0virtual:/@storybook/builder-vite/project-annotations.js',
      ],
    });

    expect(names).toEqual([
      '/virtual:/@storybook/builder-vite/vite-app.js',
      '/virtual:/@storybook/builder-vite/storybook-stories.js',
      '/virtual:/@storybook/builder-vite/project-annotations.js',
    ]);
  });

  it('records an entry module that nothing imports', () => {
    const stats = getStats({ '/project/iframe.html': [] });

    expect(stats.modules).toEqual([{ id: './iframe.html', name: './iframe.html', reasons: [] }]);
  });

  it('keeps the importers of a module that is parsed after its importer', () => {
    const importers = getImporters(
      {
        '/project/src/Button.stories.tsx': ['/project/src/Button.tsx'],
        '/project/src/Button.tsx': [],
      },
      './src/Button.tsx'
    );

    expect(importers).toEqual(['./src/Button.stories.tsx']);
  });

  it('keeps a commonjs proxy as a node of its own', () => {
    const names = getModuleNames({
      '/project/src/Button.tsx': ['\0/project/node_modules/react/index.js?commonjs-es-import'],
      '\0/project/node_modules/react/index.js?commonjs-es-import': [
        '/project/node_modules/react/index.js',
      ],
    });

    expect(names).toEqual([
      './src/Button.tsx',
      '\0./node_modules/react/index.js?commonjs-es-import',
      './node_modules/react/index.js',
    ]);
  });

  // The bundler graph has two nodes here, so the stats do too. The consumer decides how to merge
  // them.
  it('keeps a real file and its sub-module as separate nodes', () => {
    const names = getModuleNames({
      '/project/src/Foo.stories.ts': ['/project/src/Foo.vue'],
      '/project/src/Foo.vue': ['/project/src/Foo.vue?vue&type=style&index=0&lang.css'],
    });

    expect(names).toEqual([
      './src/Foo.stories.ts',
      './src/Foo.vue',
      './src/Foo.vue?vue&type=style&index=0&lang.css',
    ]);
  });

  it('keeps ids that have no path of their own', () => {
    const names = getModuleNames({
      '/project/node_modules/react/index.js': ['\0commonjsHelpers.js', '\0vite/preload-helper.js'],
    });

    expect(names).toEqual([
      './node_modules/react/index.js',
      '\0commonjsHelpers.js',
      '\0vite/preload-helper.js',
    ]);
  });

  it('connects a story to react through the proxy modules that vite inserts', () => {
    // Module ids captured from a vite 7 production build of a react component.
    const dependencies = getDependencies(
      {
        '/project/src/Button.stories.tsx': ['/project/src/Button.tsx'],
        '/project/src/Button.tsx': [
          '\0/project/node_modules/react/jsx-runtime.js?commonjs-es-import',
          '\0/project/node_modules/react/index.js?commonjs-es-import',
        ],
        '\0/project/node_modules/react/jsx-runtime.js?commonjs-es-import': [
          '/project/node_modules/react/jsx-runtime.js',
        ],
        '\0/project/node_modules/react/index.js?commonjs-es-import': [
          '/project/node_modules/react/index.js',
        ],
        '/project/node_modules/react/jsx-runtime.js': [
          '/project/node_modules/react/cjs/react-jsx-runtime.production.min.js',
        ],
        '/project/node_modules/react/cjs/react-jsx-runtime.production.min.js': [
          '/project/node_modules/react/index.js',
        ],
        '/project/node_modules/react/index.js': [
          '/project/node_modules/react/cjs/react.production.min.js',
        ],
      },
      './src/Button.stories.tsx'
    );

    expect(dependencies).toContain('./node_modules/react/index.js');
    expect(dependencies).toContain('./node_modules/react/cjs/react.production.min.js');
  });
});
