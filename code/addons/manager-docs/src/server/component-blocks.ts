import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveImport, resolvePathInStorybookCache } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { dirname, join, resolve } from 'pathe';

import {
  COMPONENT_BLOCKS_REQUEST,
  COMPONENT_BLOCKS_SERVER,
  STATIC_COMPONENT_BLOCKS_FILE,
} from '../constants.ts';
import { ManagerDocsError, ManagerDocsParseError } from '../errors.ts';
import { parseManagerDocs } from '../parser/parse-mdx.ts';
import type { Block } from '../parser/types.ts';
import type { IndexedEntry } from '../runtime/docs-page.ts';
import { mdxFileInProject } from './read-mdx.ts';
import { docsMdxFiles } from './watch-mdx.ts';

export const COMPONENT_BLOCKS_ENTRY = '/manager-docs-blocks.js';

// Set in the process that runs the component block server, so its own viteFinal pass does not
// start another one.
export const BLOCK_BUILDER_ENV = 'MANAGER_DOCS_BLOCK_BUILDER';

const RUNTIME_ID = 'virtual:manager-docs-blocks/runtime';
const ENTRY_ID = '\0manager-docs-blocks';
const VITE_STYLE_IMPORT =
  /(import\s*\{\s*updateStyle as __vite__updateStyle,\s*removeStyle as __vite__removeStyle\s*\}\s*from\s*)(["'])\/@vite\/client\2/;

export type ComponentModule = {
  blockId: string;
  specifier: string;
  exportName: string;
};

export type ComponentPage = {
  importPath: string;
  blocks: Block[];
};

type VitePlugin = {
  name: string;
  enforce?: 'pre' | 'post';
  apply?: 'serve' | 'build';
  [hook: string]: unknown;
};

type ViteDevServer = {
  listen: () => Promise<unknown>;
  httpServer: { address: () => AddressInfo | string | null } | null;
};

type ViteConfig = {
  server?: { fs?: { allow?: string[] }; [option: string]: unknown };
  build?: { [option: string]: unknown };
  [option: string]: unknown;
};

type ViteApi = {
  createServer: (config: ViteConfig) => Promise<ViteDevServer>;
  build: (config: ViteConfig) => Promise<unknown>;
};

type IndexGenerator = {
  getIndex: () => Promise<{ entries: Record<string, IndexedEntry> }>;
};

export function componentModules(workingDir: string, pages: ComponentPage[]): ComponentModule[] {
  const modules = new Map<string, ComponentModule>();
  for (const { importPath, blocks } of pages) {
    for (const block of blocks) {
      if (block.type !== 'component' || modules.has(block.blockId)) {
        continue;
      }
      modules.set(block.blockId, {
        blockId: block.blockId,
        specifier: block.importSource.startsWith('.')
          ? join(workingDir, dirname(importPath), block.importSource)
          : block.importSource,
        exportName: block.exportName,
      });
    }
  }
  return [...modules.values()];
}

export function componentBlocksEntry(input: {
  modules: ComponentModule[];
  reactRefresh: boolean;
}): string {
  const components = input.modules.map(
    (module, index) => `    ${JSON.stringify(module.blockId)}: block${index},`
  );
  return [
    ...(input.reactRefresh ? ["import '@vitejs/plugin-react/preamble';"] : []),
    "import { createElement } from 'react';",
    "import { createRoot } from 'react-dom/client';",
    `import { defineManagerDocsBlocks } from ${JSON.stringify(RUNTIME_ID)};`,
    ...input.modules.map(
      (module, index) =>
        `import { ${module.exportName} as block${index} } from ${JSON.stringify(module.specifier)};`
    ),
    '',
    'defineManagerDocsBlocks({',
    '  components: {',
    ...components,
    '  },',
    '  mount(container) {',
    '    const root = createRoot(container);',
    '    return {',
    '      render: (component, props) => root.render(createElement(component, props)),',
    '      unmount: () => root.unmount(),',
    '    };',
    '  },',
    '});',
    '',
    'if (import.meta.hot) {',
    '  import.meta.hot.accept();',
    '}',
    '',
  ].join('\n');
}

// Vite dev CSS modules inject a <style> into the manager's <head>; these send it to the block shadow roots.
export function redirectStylesToShadowRoots(code: string): string | undefined {
  if (!VITE_STYLE_IMPORT.test(code)) {
    return undefined;
  }
  return code.replace(VITE_STYLE_IMPORT, `$1${JSON.stringify(RUNTIME_ID)}`);
}

export function componentBlocksPlugins(input: {
  options: Options;
  workingDir: string;
  runtimePath: string;
}): VitePlugin[] {
  let reactRefresh = false;
  return [
    {
      name: 'storybook:manager-docs-component-blocks',
      configResolved(config: { plugins: readonly { name: string }[] }) {
        reactRefresh = config.plugins.some((plugin) => plugin.name === 'vite:react-refresh');
      },
      resolveId(source: string) {
        if (source === COMPONENT_BLOCKS_ENTRY) {
          return ENTRY_ID;
        }
        if (source === RUNTIME_ID) {
          return input.runtimePath;
        }
        return undefined;
      },
      async load(this: { addWatchFile: (file: string) => void }, id: string) {
        if (id !== ENTRY_ID) {
          return undefined;
        }
        const pages = await readComponentPages(input.options, input.workingDir);
        for (const page of pages) {
          this.addWatchFile(mdxFileInProject(input.workingDir, page.importPath));
        }
        return componentBlocksEntry({
          modules: componentModules(input.workingDir, pages),
          reactRefresh,
        });
      },
    },
    {
      name: 'storybook:manager-docs-component-block-styles',
      enforce: 'post',
      transform: redirectStylesToShadowRoots,
    },
  ];
}

export function componentBlocksLauncher(options: Options): VitePlugin {
  return {
    name: 'storybook:manager-docs-component-blocks-launcher',
    apply: 'serve',
    configureServer() {
      startComponentBlockServer(options).catch((error: unknown) => {
        logger.warn(`Manager docs cannot start the component block server: ${String(error)}`);
      });
    },
  };
}

async function loadProjectVite(projectRoot: string): Promise<ViteApi> {
  return (await import(
    pathToFileURL(resolveImport('vite', { basedir: projectRoot })).href
  )) as ViteApi;
}

async function blocksViteConfig(
  options: Options,
  extra: ViteConfig
): Promise<{ config: ViteConfig; runtimePath: string }> {
  const projectRoot = resolve(options.configDir, '..');
  const workingDir = process.cwd();
  const runtimePath = fileURLToPath(
    import.meta.resolve('@storybook/experimental-addon-manager-docs/blocks-runtime')
  );
  const apply = options.presets.apply as <T>(name: string, config: T, args: Options) => Promise<T>;
  const corePlugins = await apply<unknown[]>('viteCorePlugins', [], options);
  const config = await apply<ViteConfig>(
    'viteFinal',
    {
      configFile: false,
      root: projectRoot,
      cacheDir: resolvePathInStorybookCache('sb-vite-manager-docs-blocks', options.cacheKey),
      appType: 'custom',
      plugins: [...corePlugins, ...componentBlocksPlugins({ options, workingDir, runtimePath })],
      ...extra,
    },
    options
  );
  config.server?.fs?.allow?.push(dirname(runtimePath));
  return { config: withProjectReact(config, projectRoot), runtimePath };
}

const PROJECT_REACT_SPECIFIERS = [
  'react/jsx-dev-runtime',
  'react/jsx-runtime',
  'react-dom/client',
  'react-dom',
  'react',
] as const;

type ViteAlias = { find: string | RegExp; replacement: string };

type ViteResolve = {
  alias?: unknown;
  dedupe?: string[];
};

export function projectReactAliases(
  projectRoot: string,
  resolveFrom: (root: string, specifier: string) => string | undefined = resolveFromProject
): ViteAlias[] {
  return PROJECT_REACT_SPECIFIERS.flatMap((specifier) => {
    const replacement = resolveFrom(projectRoot, specifier);
    if (!replacement) {
      return [];
    }
    const find = specifier.includes('/') ? specifier : new RegExp(`^${specifier}$`);
    return [{ find, replacement }];
  });
}

export function withProjectReact(
  config: ViteConfig,
  projectRoot: string,
  resolveFrom?: (root: string, specifier: string) => string | undefined
): ViteConfig {
  const aliases = projectReactAliases(projectRoot, resolveFrom);
  if (aliases.length === 0) {
    return config;
  }
  const resolveConfig: ViteResolve = { ...(config.resolve as ViteResolve | undefined) };
  resolveConfig.alias = [...aliases, ...normalizeAlias(resolveConfig.alias)];
  resolveConfig.dedupe = [...new Set([...(resolveConfig.dedupe ?? []), 'react', 'react-dom'])];
  return { ...config, resolve: resolveConfig };
}

function resolveFromProject(projectRoot: string, specifier: string): string | undefined {
  try {
    return createRequire(join(projectRoot, 'package.json')).resolve(specifier);
  } catch {
    return undefined;
  }
}

function normalizeAlias(alias: unknown): ViteAlias[] {
  if (Array.isArray(alias)) {
    return alias as ViteAlias[];
  }
  if (alias && typeof alias === 'object') {
    return Object.entries(alias).map(([find, replacement]) => ({
      find,
      replacement: String(replacement),
    }));
  }
  return [];
}

export function runAsBlockBuilder<T>(work: () => Promise<T>): Promise<T> {
  const previous = process.env[BLOCK_BUILDER_ENV];
  process.env[BLOCK_BUILDER_ENV] = 'true';
  return work().finally(() => {
    if (previous === undefined) {
      delete process.env[BLOCK_BUILDER_ENV];
    } else {
      process.env[BLOCK_BUILDER_ENV] = previous;
    }
  });
}

async function startComponentBlockServer(options: Options): Promise<void> {
  const projectRoot = resolve(options.configDir, '..');
  const host = options.host || '127.0.0.1';
  const port = options.port ?? 6006;
  await runAsBlockBuilder(async () => {
    const vite = await loadProjectVite(projectRoot);
    const { config } = await blocksViteConfig(options, {
      base: '/',
      server: {
        host,
        port: port + 1,
        strictPort: false,
        cors: { origin: managerOrigins(port, host) },
        hmr: { overlay: false },
      },
    });
    const server = await vite.createServer(config);
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === 'string') {
      throw new ManagerDocsError('The component block server has no port.');
    }
    const announce = () =>
      options.channel?.emit(COMPONENT_BLOCKS_SERVER, {
        port: address.port,
        entry: COMPONENT_BLOCKS_ENTRY,
      });
    options.channel?.on(COMPONENT_BLOCKS_REQUEST, announce);
    announce();
    logger.info(`Manager docs component blocks: http://${host}:${address.port}`);
  });
}

export async function emitStaticComponentBlocks(
  options: Options,
  buildBlocks?: (config: ViteConfig) => Promise<unknown>
): Promise<string | undefined> {
  if (options.configType !== 'PRODUCTION' || !options.outputDir || process.env[BLOCK_BUILDER_ENV]) {
    return undefined;
  }
  const workingDir = process.cwd();
  const pages = await readComponentPages(options, workingDir);
  if (componentModules(workingDir, pages).length === 0) {
    return undefined;
  }
  const projectRoot = resolve(options.configDir, '..');
  const target = join(options.outputDir, STATIC_COMPONENT_BLOCKS_FILE);
  await runAsBlockBuilder(async () => {
    const { config } = await blocksViteConfig(options, {
      base: './',
      publicDir: false,
      build: {
        copyPublicDir: false,
        emptyOutDir: false,
        outDir: options.outputDir,
        cssCodeSplit: false,
        rollupOptions: {
          input: COMPONENT_BLOCKS_ENTRY,
          output: {
            format: 'es',
            entryFileNames: STATIC_COMPONENT_BLOCKS_FILE,
            inlineDynamicImports: true,
          },
        },
      },
    });
    config.publicDir = false;
    config.build = { ...config.build, copyPublicDir: false };
    const build =
      buildBlocks ??
      ((viteConfig) => loadProjectVite(projectRoot).then((vite) => vite.build(viteConfig)));
    await build(config);
  });
  logger.info(`Manager docs component blocks: ${target}`);
  return target;
}

function managerOrigins(port: number, host: string): string[] {
  return [...new Set([host, '127.0.0.1', 'localhost'])].map((name) => `http://${name}:${port}`);
}

async function readComponentPages(options: Options, workingDir: string): Promise<ComponentPage[]> {
  const generator = await options.presets.apply<IndexGenerator>('storyIndexGenerator');
  const entries = Object.values((await generator.getIndex()).entries);
  return Promise.all(
    docsMdxFiles(entries).map(async (importPath) => {
      const source = await readFile(mdxFileInProject(workingDir, importPath), 'utf8');
      try {
        return { importPath, blocks: parseManagerDocs(source, importPath).blocks };
      } catch (error) {
        if (error instanceof ManagerDocsParseError) {
          return { importPath, blocks: [] };
        }
        throw error;
      }
    })
  );
}
