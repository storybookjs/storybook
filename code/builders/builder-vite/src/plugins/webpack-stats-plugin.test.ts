import { statSync } from 'node:fs';

import { fs, vol } from 'memfs';
import type { ModuleInfo } from 'rollup';
import { build, type Plugin, type ResolvedConfig } from 'vite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pluginWebpackStats } from './webpack-stats-plugin.ts';

vi.mock('node:fs', { spy: true });

const workingDir = '/project';

type ParsedModule = Pick<ModuleInfo, 'id' | 'importedIds' | 'dynamicallyImportedIds'>;
type RawGraph = Record<string, string[] | Omit<ParsedModule, 'id'>>;

function getStats(graph: RawGraph) {
  const plugin = pluginWebpackStats({ workingDir });
  const moduleParsed = plugin.moduleParsed as unknown as (mod: ParsedModule) => void;

  for (const [id, imports] of Object.entries(graph)) {
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
    const template = '/project/src/Button.html';
    const partial = '/project/src/_tokens.scss';
    const component = '/project/src/Button.tsx';
    const stylesheet = '/project/src/Button.scss?inline';
    const virtual = '\0virtual:template';
    type Context = { addWatchFile: (file: string) => void };

    beforeEach(() => {
      vol.reset();
      vol.fromJSON({ [template]: '', [partial]: '', [component]: '' });
      vi.mocked(statSync).mockImplementation(fs.statSync as typeof statSync);
      vi.mocked(statSync).mockClear();
    });

    function setup(plugin: Plugin, recordWatchFiles = true, command: 'build' | 'serve' = 'build') {
      const stats = pluginWebpackStats({ workingDir, recordWatchFiles });
      const configResolved = stats.configResolved as (
        config: Pick<ResolvedConfig, 'command' | 'plugins'>
      ) => void;
      configResolved({ command, plugins: [plugin, stats] });
      const moduleParsed = stats.moduleParsed as (mod: ParsedModule) => void;
      return {
        stats,
        parse: (id: string) => moduleParsed({ id, importedIds: [], dynamicallyImportedIds: [] }),
      };
    }

    function invoke(
      hook: Plugin['load'] | Plugin['transform'],
      context: Context,
      ...args: string[]
    ) {
      return Reflect.apply(typeof hook === 'function' ? hook : hook!.handler, context, args);
    }

    function dependencies(stats: ReturnType<typeof pluginWebpackStats>) {
      const modules: { name: string; reasons?: { moduleName: string }[] }[] = stats
        .storybookGetStats()
        .toJson().modules;
      const graph = Object.fromEntries(
        modules.map(({ name, reasons }) => [
          name,
          reasons?.map(({ moduleName }) => moduleName) ?? [],
        ])
      );
      expect(Object.keys(graph)).toHaveLength(modules.length);
      return graph;
    }

    it.each([
      ['load', virtual, template, '/virtual:template', './src/Button.html'],
      ['transform', stylesheet, partial, './src/Button.scss?inline', './src/_tokens.scss'],
    ] as const)('connects a file watched in %s of %s', (hook, id, file, moduleName, fileName) => {
      const reader: Plugin = {
        name: 'resource-reader',
        [hook]: function (this: Context) {
          this.addWatchFile(file);
          this.addWatchFile(file);
          return 'export default ""';
        },
      };
      const { stats, parse } = setup(reader);
      const context = { addWatchFile: vi.fn() };
      expect(invoke(reader[hook], context, ...(hook === 'load' ? [id] : ['', id]))).toBe(
        'export default ""'
      );
      parse(id);
      expect(context.addWatchFile).toHaveBeenCalledWith(file);
      expect(stats.storybookGetStats().toJson().modules).toEqual([
        { id: moduleName, name: moduleName, reasons: [] },
        { id: fileName, name: fileName, reasons: [{ moduleName }] },
      ]);
    });

    it('connects watched resources through an actual Vite build', async () => {
      const stats = pluginWebpackStats({ workingDir, recordWatchFiles: true });
      const resources: Plugin = {
        name: 'resource-fixture',
        resolveId(id) {
          if (id.startsWith('virtual:')) {
            return `\0${id}`;
          }
        },
        load(id) {
          if (id === '\0virtual:entry') {
            return 'import template from "virtual:template"; import css from "virtual:Button.css?inline"; export default [template, css];';
          }
          if (id === virtual) {
            this.addWatchFile(template);
            return 'export default "template"';
          }
          if (id === '\0virtual:Button.css?inline') {
            return 'button { color: red; }';
          }
        },
        transform(code, id) {
          if (id === '\0virtual:Button.css?inline') {
            this.addWatchFile(partial);
            this.addWatchFile(component);
          }
        },
      };
      await build({
        configFile: false,
        envFile: false,
        root: workingDir,
        logLevel: 'silent',
        plugins: [resources, stats],
        build: { write: false, minify: false, rollupOptions: { input: 'virtual:entry' } },
      });
      const graph = dependencies(stats);
      expect(graph).toMatchObject({
        './src/Button.html': ['/virtual:template'],
        './src/_tokens.scss': ['/virtual:Button.css?inline'],
      });
      expect(graph['./src/Button.tsx']).toBeUndefined();
    });

    it.each([
      [stylesheet, './src/Button.scss?inline'],
      ['/project/src/Foo.vue?vue&type=style&lang.scss', './src/Foo.vue?vue&type=style&lang.scss'],
    ])('filters content watches of %s before checking the filesystem', (id, moduleName) => {
      const reader: Plugin = {
        name: 'content-scanner',
        transform() {
          for (const file of [component, template, partial]) {
            this.addWatchFile(file);
          }
        },
      };
      const { stats, parse } = setup(reader);
      invoke(reader.transform, { addWatchFile: vi.fn() }, '', id);
      parse(id);
      expect(dependencies(stats)).toEqual({
        [moduleName]: [],
        './src/_tokens.scss': [moduleName],
      });
      expect(statSync).toHaveBeenCalledTimes(1);
    });

    it('keeps object hook metadata and binds context methods to their receiver', () => {
      const filter = { id: /^\0virtual:/ };
      const reader: Plugin = {
        name: 'object-hook',
        load: {
          filter,
          order: 'pre',
          handler() {
            this.addWatchFile(template);
            this.warn('warning');
            return null;
          },
        },
      };
      const { stats, parse } = setup(reader);
      const context = {
        addWatchFile: vi.fn(),
        warn() {
          expect(this).toBe(context);
        },
      };
      expect(invoke(reader.load, context, virtual)).toBeNull();
      parse(virtual);
      expect(reader.load).toMatchObject({ filter, order: 'pre' });
      expect(stats.storybookGetStats().toJson().modules).toHaveLength(2);
    });

    it.each([
      [false, 'build'],
      [true, 'serve'],
    ] as const)(
      'leaves hooks unchanged with recordWatchFiles=%s and command=%s',
      (enabled, command) => {
        const reader: Plugin = { name: 'reader', load: () => null };
        const original = reader.load;
        setup(reader, enabled, command);
        expect(reader.load).toBe(original);
      }
    );

    it('leaves non-writable hooks unchanged', () => {
      const reader = Object.freeze({ name: 'frozen', load: () => null });
      expect(() => setup(reader)).not.toThrow();
    });

    it('ignores invalid files and unparsed modules, deduplicates importers, and omits self edges', () => {
      const reader: Plugin = {
        name: 'reader',
        load() {
          for (const file of [
            template,
            template,
            component,
            'src/Button.html',
            '/project/src',
            '/project/src/*.html',
            '/project/missing.html',
          ]) {
            this.addWatchFile(file);
          }
        },
      };
      const { stats, parse } = setup(reader);
      for (const id of [component, virtual, '/project/unused.ts']) {
        invoke(reader.load, { addWatchFile: vi.fn() }, id);
      }
      parse(component);
      parse(virtual);
      expect(dependencies(stats)).toEqual({
        './src/Button.tsx': ['/virtual:template'],
        './src/Button.html': ['./src/Button.tsx', '/virtual:template'],
        '/virtual:template': [],
      });
      expect(statSync).toHaveBeenCalledTimes(5);
    });

    it('keeps watch files attributed to their module when asynchronous hooks interleave', async () => {
      const resolvers = Promise.withResolvers<void>();
      const reader: Plugin = {
        name: 'async-reader',
        async load(id) {
          if (id === component) {
            await resolvers.promise;
          }
          this.addWatchFile(id === component ? template : partial);
          return null;
        },
      };
      const { stats, parse } = setup(reader);
      const first = invoke(reader.load, { addWatchFile: vi.fn() }, component);
      await invoke(reader.load, { addWatchFile: vi.fn() }, virtual);
      resolvers.resolve();
      await first;
      parse(component);
      parse(virtual);
      expect(dependencies(stats)).toEqual({
        './src/Button.tsx': [],
        './src/Button.html': ['./src/Button.tsx'],
        '/virtual:template': [],
        './src/_tokens.scss': ['/virtual:template'],
      });
    });
  });
});
