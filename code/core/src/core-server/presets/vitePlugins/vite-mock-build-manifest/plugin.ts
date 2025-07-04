import { readFileSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';

import { automockModule, findMockRedirect } from '@vitest/mocker/node';
import { transformSync } from 'esbuild';
import { walk } from 'estree-walker';
import type { OutputBundle, OutputChunk, PluginContext } from 'rollup';
import type { Plugin, ResolvedConfig } from 'vite';

import { __STORYBOOK_GLOBAL_THIS_ACCESSOR__ } from '../vite-inject-mocker/utils';
import { isModuleDirectory } from './utils';

interface MockBuildManifestPluginOptions {
  /** The absolute path to the preview.tsx file where mocks are defined. */
  previewConfigPath: string;
}

type ChunkData = {
  path: string;
  importee: string;
  mockedChunkRef?: string;
  resolvedIdChunkRef: string;
  options: {
    external: boolean;
    spy: boolean;
  };
};

/**
 * Vite plugin for Storybook module mocking manifest generation.
 *
 * Scans the preview config for sb.mock() calls, processes them, and emits a manifest for runtime
 * use.
 *
 * Responsibilities:
 *
 * - Extract mock calls from preview config
 * - Resolve and emit mock/automock chunks
 * - Generate a manifest mapping original modules to their mocks
 *
 * @see MockBuildManifestPluginOptions
 */
export function viteMockBuildManifestPlugin(options: MockBuildManifestPluginOptions): Plugin {
  // --- Plugin State ---
  let viteConfig: ResolvedConfig;
  let mockCalls: MockCall[] = [];
  /**
   * Holds references to chunks that are redirected to `__mocks__` files. Each entry represents a
   * mapping from an original module to its mock chunk.
   */
  const redirectChunkRefs = new Set<ChunkData>();
  /**
   * Holds references to chunks that are automocked (i.e., generated mocks, not explicit `__mocks__`
   * files). Each entry represents a mapping from an original module to its automocked chunk.
   */
  const automockChunkRefs = new Set<ChunkData>();
  /**
   * Maps resolved external module paths to their corresponding mock redirect paths. Used for
   * handling external (node_modules) mocks.
   */
  const externalMockChunkRefs = new Map<string, string>();

  // --- Types ---
  type MockCall = { path: string; isFactoryMock: boolean; spy: boolean };

  // --- Helpers ---

  /**
   * Extracts all sb.mock() calls from the preview config file.
   *
   * @param this PluginContext
   */
  function extractMockCalls(this: PluginContext): MockCall[] {
    const previewConfigCode = readFileSync(options.previewConfigPath, 'utf-8');
    const { code: jsCode } = transformSync(previewConfigCode, { loader: 'tsx', format: 'esm' });
    const ast = this.parse(jsCode);
    const mocks: MockCall[] = [];

    /** Helper to check if an ObjectExpression node has spy: true */
    function hasSpyTrue(objectExpression: any): boolean {
      if (!objectExpression || !objectExpression.properties) {
        return false;
      }
      for (const prop of objectExpression.properties) {
        if (
          prop.type === 'Property' &&
          ((prop.key.type === 'Identifier' && prop.key.name === 'spy') ||
            (prop.key.type === 'Literal' && prop.key.value === 'spy')) &&
          prop.value.type === 'Literal' &&
          prop.value.value === true
        ) {
          return true;
        }
      }
      return false;
    }

    walk(ast as any, {
      enter(node) {
        if (
          node.type !== 'CallExpression' ||
          node.callee.type !== 'MemberExpression' ||
          node.callee.object.type !== 'Identifier' ||
          node.callee.object.name !== 'sb' ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'mock'
        ) {
          return;
        }

        if (node.arguments.length === 0 || node.arguments[0].type !== 'Literal') {
          return;
        }
        const spy =
          node.arguments.length > 1 &&
          node.arguments[1].type === 'ObjectExpression' &&
          hasSpyTrue(node.arguments[1]);

        mocks.push({
          path: node.arguments[0].value as string,
          isFactoryMock:
            node.arguments.length > 1 && node.arguments[1].type === 'FunctionExpression',
          spy,
        });
      },
    });
    return mocks;
  }

  /**
   * Emits mock/automock chunks for all extracted mock calls.
   *
   * @param this PluginContext
   */
  async function emitMockChunks(this: PluginContext) {
    for (const call of mockCalls) {
      // Factory mocks are not supported yet
      if (call.isFactoryMock) {
        continue;
      }

      // Try to resolve the module path
      const resolved = await this.resolve(call.path, options.previewConfigPath);

      if (!resolved) {
        this.warn(
          `[vitest-mocker] Could not resolve mock path "${call.path}" in ${options.previewConfigPath}`
        );
        continue;
      }

      const resolvedId = resolved.id;
      const isExternal = !isAbsolute(resolvedId) || isModuleDirectory(resolvedId);
      const external = isExternal ? call.path : null;
      const redirectPath = findMockRedirect(viteConfig.root, resolvedId, external);

      // Handle __mocks__ redirect
      if (redirectPath) {
        if (external) {
          // External module mock
          try {
            const resolvedExternal = require.resolve(call.path, { paths: [viteConfig.root] });
            externalMockChunkRefs.set(resolvedExternal, redirectPath!);
          } catch (e) {
            this.warn(`[vitest-mocker] Could not resolve external mock for "${call.path}"`);
          }
        } else {
          // Local __mocks__ file
          const mockedChunkRef = this.emitFile({
            type: 'chunk',
            id: redirectPath!,
            importer: options.previewConfigPath,
            name: `mock-redirect-${basename(resolvedId)}.js`,
            preserveSignature: 'strict',
          });

          const resolvedIdChunkRef = this.emitFile({
            type: 'chunk',
            id: resolvedId,
            importer: options.previewConfigPath,
            preserveSignature: 'strict',
          });

          redirectChunkRefs.add({
            resolvedIdChunkRef,
            mockedChunkRef,
            importee: options.previewConfigPath,
            path: join(options.previewConfigPath, '..', call.path),
            options: { spy: call.spy, external: false },
          });
        }
        continue;
      }

      // Handle automock
      const resolvedIdChunkRef = this.emitFile({
        type: 'chunk',
        id: resolvedId,
        importer: options.previewConfigPath,
        preserveSignature: 'strict',
      });
      automockChunkRefs.add({
        resolvedIdChunkRef,
        importee: options.previewConfigPath,
        path: resolvedId,
        options: { spy: call.spy, external: false },
      });
    }
  }

  /**
   * Loads the mock file for a given module id, if it matches a mock call.
   *
   * @param this PluginContext
   * @param id String
   */
  function tryLoadMock(this: PluginContext, id: string): string | null {
    // Find a matching mock call for the given id
    for (const call of mockCalls) {
      let resolved: string | undefined;
      try {
        resolved = require.resolve(call.path, { paths: [viteConfig.root] });
      } catch {
        continue;
      }
      if (resolved === id) {
        // Try to load the corresponding __mocks__ file
        try {
          const mockedModuleSegments = call.path.split('/');
          const pathMockedModule = join(viteConfig.root, '__mocks__', ...mockedModuleSegments);
          const resolvedMockedModule = require.resolve(pathMockedModule, {
            paths: [viteConfig.root],
          });
          return readFileSync(resolvedMockedModule, 'utf-8');
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Generates and emits the mock manifest asset.
   *
   * @param this PluginContext
   * @param bundle OutputBundle
   */
  function emitManifest(this: PluginContext, bundle: OutputBundle) {
    const manifest = {
      redirects: {} as Record<string, string>,
      automocks: {} as Record<string, string>,
    };

    // Map original modules to their __mocks__ redirects
    for (const [chunkData] of redirectChunkRefs.entries()) {
      const finalMockedFileName = this.getFileName(chunkData.mockedChunkRef!);
      const finalOriginalFileName = this.getFileName(chunkData.resolvedIdChunkRef);
      manifest.redirects[`/${finalOriginalFileName}`] = `/${finalMockedFileName}`;
    }

    // Map original modules to their automocked assets
    for (const [chunkData] of automockChunkRefs.entries()) {
      const chunk = Object.values(bundle).find(
        (chunk): chunk is OutputChunk =>
          (chunk as OutputChunk).type === 'chunk' &&
          (chunk as OutputChunk).facadeModuleId === chunkData.path
      );

      if (!chunk) {
        // Could not find chunk for automock, skip
        continue;
      }

      const mockedModule = automockModule(
        chunk.code,
        chunkData.options.spy ? 'autospy' : 'automock',
        this.parse,
        { globalThisAccessor: JSON.stringify(__STORYBOOK_GLOBAL_THIS_ACCESSOR__) }
      );

      const mockedChunkRef = this.emitFile({
        type: 'asset',
        name: `mock-${basename(chunkData.path)}.js`,
        source: mockedModule.toString(),
      });

      const finalOriginalFileName = this.getFileName(chunkData.resolvedIdChunkRef);
      const finalMockedFileName = this.getFileName(mockedChunkRef);

      manifest.automocks[`/${finalOriginalFileName}`] = `/${finalMockedFileName}`;
    }

    // Emit the manifest as an asset
    this.emitFile({
      type: 'asset',
      fileName: 'mock-manifest.json',
      source: JSON.stringify(manifest, null, 2),
    });
  }

  // --- Plugin Definition ---
  return {
    name: 'storybook:mock-build-manifest',
    apply: 'build',

    configResolved(config) {
      viteConfig = config;
    },

    buildStart() {
      mockCalls = extractMockCalls.bind(this)();
      emitMockChunks.bind(this)();
    },

    async load(id) {
      return tryLoadMock.bind(this)(id);
    },

    generateBundle(_, bundle) {
      emitManifest.bind(this)(bundle);
    },
  };
}
