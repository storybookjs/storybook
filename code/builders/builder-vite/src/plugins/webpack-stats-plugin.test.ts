import type { ModuleInfo } from 'rollup';
import type { Plugin, ResolvedConfig } from 'vite';
import { describe, expect, it, vi } from 'vitest';

import { pluginWebpackStats } from './webpack-stats-plugin.ts';

const workingDir = '/project';

type ParsedModule = Pick<ModuleInfo, 'id' | 'importedIds' | 'dynamicallyImportedIds'>;
type RawGraph = Record<string, string[] | Omit<ParsedModule, 'id'>>;
type BuildConfig = Pick<ResolvedConfig, 'command' | 'plugins'>;

function callHook(hook: unknown, context: object | undefined, ...args: unknown[]) {
  const handler = typeof hook === 'function' ? hook : (hook as { handler?: unknown })?.handler;
  return typeof handler === 'function' ? handler.apply(context, args) : undefined;
}

// Each hook call gets its own context, as in the bundler.
function createContext() {
  return { addWatchFile: vi.fn() };
}

// Runs the hooks of `plugins` the way a build does, then parses each module of `graph`.
function getStats(graph: RawGraph, plugins: Plugin[] = []) {
  const plugin = pluginWebpackStats({ workingDir });
  const moduleParsed = plugin.moduleParsed as unknown as (mod: ParsedModule) => void;
  const config: BuildConfig = { command: 'build', plugins: [...plugins, plugin] };
  callHook(plugin.configResolved, undefined, config);

  for (const hookedPlugin of plugins) {
    callHook(hookedPlugin.buildStart, createContext(), {});
  }

  for (const [id, imports] of Object.entries(graph)) {
    for (const hookedPlugin of plugins) {
      callHook(hookedPlugin.resolveId, createContext(), id, undefined, {});
      callHook(hookedPlugin.load, createContext(), id);
      callHook(hookedPlugin.transform, createContext(), '', id);
    }
    const mod = Array.isArray(imports)
      ? { importedIds: imports, dynamicallyImportedIds: [] }
      : imports;
    moduleParsed({ id, ...mod });
  }

  return plugin.storybookGetStats().toJson();
}

function getModuleNames(graph: RawGraph) {
  return getStats(graph)
    .modules.map((module: { name: string }) => module.name)
    .sort();
}

function getImporters(graph: RawGraph, name: string, plugins: Plugin[] = []) {
  const module = getStats(graph, plugins).modules.find((m: { name: string }) => m.name === name);
  return module?.reasons?.map((reason: { moduleName: string }) => reason.moduleName);
}

function getDependencies(graph: RawGraph, name: string, plugins: Plugin[] = []) {
  const { modules } = getStats(graph, plugins);
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

// A plugin that reads `file` itself while it loads `moduleId`, like a framework plugin that inlines
// a component template.
function watchInLoad(moduleId: string, file: string): Plugin {
  return {
    name: 'watch-in-load',
    load(id) {
      if (id === moduleId) {
        this.addWatchFile(file);
        return 'export default ""';
      }
    },
  };
}

// A plugin that reads `file` itself while it transforms `moduleId`, like a CSS preprocessor that
// resolves a partial.
function watchInTransform(moduleId: string, file: string): Plugin {
  return {
    name: 'watch-in-transform',
    transform(code, id) {
      if (id === moduleId) {
        this.addWatchFile(file);
        return code;
      }
    },
  };
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
      '/virtual:/@storybook/builder-vite/project-annotations.js',
      '/virtual:/@storybook/builder-vite/storybook-stories.js',
      '/virtual:/@storybook/builder-vite/vite-app.js',
    ]);
  });

  it('records an entry module that nothing imports', () => {
    const stats = getStats({ '/project/iframe.html': [] });

    expect(stats.modules).toEqual([{ id: './iframe.html', name: './iframe.html', reasons: [] }]);
  });

  it('records a dynamic import as an edge', () => {
    const importers = getImporters(
      {
        '\0virtual:/@storybook/builder-vite/storybook-stories.js': {
          importedIds: [],
          dynamicallyImportedIds: ['/project/src/Button.stories.tsx'],
        },
      },
      './src/Button.stories.tsx'
    );

    expect(importers).toEqual(['/virtual:/@storybook/builder-vite/storybook-stories.js']);
  });

  it('lists an importer once when two ids normalize to the same name', () => {
    const importers = getImporters(
      { '/project/src/Button.stories.tsx': ['\0virtual:X', 'virtual:X'] },
      '/virtual:X'
    );

    expect(importers).toEqual(['./src/Button.stories.tsx']);
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
      '\0./node_modules/react/index.js?commonjs-es-import',
      './node_modules/react/index.js',
      './src/Button.tsx',
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

  it('keeps a rooted id that is not a file in the graph', () => {
    const names = getModuleNames({
      '/project/src/Button.tsx': ['\0/@data-uri/data:text/javascript,export default 1'],
    });

    expect(names).toEqual([
      '\0/@data-uri/data:text/javascript,export default 1',
      './src/Button.tsx',
    ]);
  });

  it('names a commonjs proxy of a hoisted dependency relative to the working directory', () => {
    const names = getModuleNames({
      '/project/src/Button.tsx': ['\0/node_modules/react/index.js?commonjs-es-import'],
      '\0/node_modules/react/index.js?commonjs-es-import': ['/node_modules/react/index.js'],
    });

    expect(names).toEqual([
      '\0./../node_modules/react/index.js?commonjs-es-import',
      './../node_modules/react/index.js',
      './src/Button.tsx',
    ]);
  });

  it('keeps ids that have no path of their own', () => {
    const names = getModuleNames({
      '/project/node_modules/react/index.js': ['\0commonjsHelpers.js', '\0vite/preload-helper.js'],
    });

    expect(names).toEqual([
      '\0commonjsHelpers.js',
      '\0vite/preload-helper.js',
      './node_modules/react/index.js',
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

  describe('files registered with addWatchFile', () => {
    it('adds a file watched while a virtual module loads, imported by that module', () => {
      const graph = {
        '/project/src/Button.stories.ts': ['/project/src/Button.ts'],
        '/project/src/Button.ts': ['\0virtual:template'],
        '\0virtual:template': [],
      };
      const plugins = [watchInLoad('\0virtual:template', '/project/src/Button.html')];

      expect(getImporters(graph, './src/Button.html', plugins)).toEqual(['/virtual:template']);
      expect(getDependencies(graph, './src/Button.stories.ts', plugins)).toContain(
        './src/Button.html'
      );
    });

    it('adds a file watched while a stylesheet transforms, imported by that stylesheet', () => {
      const graph = {
        '/project/src/Button.ts': ['/project/src/Button.scss?inline'],
        '/project/src/Button.scss?inline': [],
      };
      const plugins = [
        watchInTransform('/project/src/Button.scss?inline', '/project/src/styles/_tokens.scss'),
      ];

      expect(getImporters(graph, './src/styles/_tokens.scss', plugins)).toEqual([
        './src/Button.scss?inline',
      ]);
    });

    it('still registers the file with the bundler', () => {
      const plugin = watchInLoad('/project/src/Button.ts', '/project/src/Button.html');
      const config: BuildConfig = {
        command: 'build',
        plugins: [plugin, pluginWebpackStats({ workingDir })],
      };
      callHook(config.plugins[1].configResolved, undefined, config);
      const context = createContext();

      const result = callHook(plugin.load, context, '/project/src/Button.ts');

      expect(context.addWatchFile).toHaveBeenCalledWith('/project/src/Button.html');
      expect(result).toBe('export default ""');
    });

    it('keeps the filter and order of an object hook', () => {
      const filter = { id: /^\0virtual:/ };
      const plugin: Plugin = {
        name: 'object-hook',
        load: {
          filter,
          order: 'pre',
          // The test harness does not apply the filter.
          handler(id) {
            if (filter.id.test(id)) {
              this.addWatchFile('/project/src/Button.html');
            }
            return null;
          },
        },
      };
      const graph = { '/project/src/Button.ts': ['\0virtual:template'], '\0virtual:template': [] };

      expect(getImporters(graph, './src/Button.html', [plugin])).toEqual(['/virtual:template']);
      expect(plugin.load).toMatchObject({ filter, order: 'pre' });
    });

    it('wraps a hook once when the config is resolved again', () => {
      const plugin = watchInLoad('\0virtual:template', '/project/src/Button.html');
      const statsPlugin = pluginWebpackStats({ workingDir });
      const config: BuildConfig = { command: 'build', plugins: [plugin, statsPlugin] };

      const load = plugin.load;
      callHook(statsPlugin.configResolved, undefined, config);
      const wrapped = plugin.load;
      callHook(statsPlugin.configResolved, undefined, config);

      expect(wrapped).not.toBe(load);
      expect(plugin.load).toBe(wrapped);
    });

    it('does not wrap hooks for the dev server', () => {
      const plugin = watchInLoad('\0virtual:template', '/project/src/Button.html');
      const load = plugin.load;
      const statsPlugin = pluginWebpackStats({ workingDir });
      const config: BuildConfig = { command: 'serve', plugins: [plugin, statsPlugin] };

      callHook(statsPlugin.configResolved, undefined, config);

      expect(plugin.load).toBe(load);
    });

    it('ignores files watched outside of load and transform', () => {
      const plugin: Plugin = {
        name: 'watch-in-other-hooks',
        buildStart() {
          this.addWatchFile('/project/package.json');
        },
        resolveId(source) {
          this.addWatchFile('/project/tsconfig.json');
          return source;
        },
      };

      const names = getStats({ '/project/src/Button.ts': [] }, [plugin]).modules.map(
        (module: { name: string }) => module.name
      );

      expect(names).toEqual(['./src/Button.ts']);
    });

    it('ignores files watched by a module that is never parsed', () => {
      const plugin = watchInLoad('/project/src/unused.ts', '/project/src/unused.html');
      const statsPlugin = pluginWebpackStats({ workingDir });
      const moduleParsed = statsPlugin.moduleParsed as unknown as (mod: ParsedModule) => void;
      const config: BuildConfig = { command: 'build', plugins: [plugin, statsPlugin] };
      callHook(statsPlugin.configResolved, undefined, config);
      const context = createContext();

      // The module is loaded, so its watch file is recorded, but it never reaches moduleParsed.
      callHook(plugin.load, context, '/project/src/unused.ts');
      moduleParsed({ id: '/project/src/Button.ts', importedIds: [], dynamicallyImportedIds: [] });

      const names = statsPlugin
        .storybookGetStats()
        .toJson()
        .modules.map((module: { name: string }) => module.name);

      expect(context.addWatchFile).toHaveBeenCalledWith('/project/src/unused.html');
      expect(names).toEqual(['./src/Button.ts']);
    });

    it('writes the same stats when no plugin watches a file', () => {
      const graph = {
        '/project/src/Button.stories.ts': ['/project/src/Button.ts'],
        '/project/src/Button.ts': ['/project/src/Button.css?inline'],
        '/project/src/Button.css?inline': [],
      };
      const plugin: Plugin = {
        name: 'no-watch-files',
        load: () => null,
        transform: (code) => code,
      };

      expect(getStats(graph, [plugin])).toEqual(getStats(graph));
    });
  });
});
