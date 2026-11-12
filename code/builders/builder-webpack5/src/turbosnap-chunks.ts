import { createRequire } from 'node:module';

import TerserWebpackPlugin from 'terser-webpack-plugin';
import type { Chunk, Compilation, Compiler, Module } from 'webpack';

type RenderedChunk = { source: string; filename: string; contentHash: string };
const renderedChunks = new WeakMap<Compilation, Map<Chunk, RenderedChunk>>();
const require = createRequire(import.meta.url);
const amdRuntimeModules: unknown = require('webpack/lib/dependencies/AMDRuntimeModules.js');
const runtimePrototypes = new Set<unknown>([
  ...[
    'AsyncModule',
    'AutoPublicPath',
    'BaseUri',
    'CompatGetDefaultExport',
    'CreateFakeNamespaceObject',
    'DefinePropertyGetters',
    'EnsureChunk',
    'GetChunkFilename',
    'Global',
    'HasOwnProperty',
    'LoadScript',
    'MakeNamespaceObject',
    'Nonce',
    'OnChunksLoaded',
    'PublicPath',
    'RelativeUrl',
  ].map((name) => {
    const constructor: unknown = require(`webpack/lib/runtime/${name}RuntimeModule.js`);
    return typeof constructor === 'function' ? constructor.prototype : undefined;
  }),
  require('webpack/lib/web/JsonpChunkLoadingRuntimeModule.js').prototype,
  ...(typeof amdRuntimeModules === 'object' && amdRuntimeModules !== null
    ? Object.values(amdRuntimeModules).map((constructor: unknown) =>
        typeof constructor === 'function' ? constructor.prototype : undefined
      )
    : []),
]);

class UnsupportedWebpackOutput extends Error {}

function isKnownCommonJsRuntime(compilation: Compilation, module: Module) {
  const { runtimeTemplate } = compilation;
  const { Template } = compilation.compiler.webpack;
  const generated = compilation.codeGenerationResults
    ?.get(module, undefined)
    .sources.get('runtime')
    ?.source()
    .toString();
  // Webpack keeps these two constructors private to CommonJsPlugin.
  return [
    `__webpack_require__.nmd = ${runtimeTemplate.basicFunction('module', [
      'module.paths = [];',
      'if (!module.children) module.children = [];',
      'return module;',
    ])};`,
    `__webpack_require__.hmd = ${runtimeTemplate.basicFunction('module', [
      'module = Object.create(module);',
      'if (!module.children) module.children = [];',
      "Object.defineProperty(module, 'exports', {",
      Template.indent([
        'enumerable: true,',
        `set: ${runtimeTemplate.basicFunction('', [
          "throw new Error('ES Modules may not assign module.exports or exports.*, Use ESM export syntax, instead: ' + module.id);",
        ])}`,
      ]),
      '});',
      'return module;',
    ])};`,
  ].includes(generated ?? '');
}

export function trackWebpackChunkSources(compiler: Compiler) {
  compiler.hooks.thisCompilation.tap('StorybookTurbosnapOutput', (compilation) => {
    const chunks = new Map<Chunk, RenderedChunk>();
    renderedChunks.set(compilation, chunks);
    compilation.hooks.unseal.tap('StorybookTurbosnapOutput', () => chunks.clear());
    compilation.hooks.chunkAsset.tap(
      { name: 'StorybookTurbosnapOutput', stage: Number.MIN_SAFE_INTEGER },
      (chunk, filename) => {
        if (!/\.[cm]?js$/.test(filename)) return;
        const asset = compilation.getAsset(filename);
        const contentHash = asset?.info.contenthash;
        if (!asset || typeof contentHash !== 'string' || chunks.has(chunk)) {
          chunks.set(chunk, { source: '', filename, contentHash: '' });
          return;
        }
        chunks.set(chunk, { source: asset.source.source().toString(), filename, contentHash });
      }
    );
  });
}

export function getRenderedWebpackChunks(compilation: Compilation) {
  const hooks =
    compilation.compiler.webpack.javascript.JavascriptModulesPlugin.getCompilationHooks(
      compilation
    );
  const supportedHooks: Record<string, string[]> = {
    renderModuleContent: ['APIPlugin'],
    renderChunk: ['ArrayPushCallbackChunkFormatPlugin'],
  };
  if (
    (
      [
        'renderModuleContent',
        'renderModuleContainer',
        'renderModulePackage',
        'render',
        'renderContent',
        'renderStartup',
        'renderChunk',
        'renderMain',
        'renderRequire',
      ] as const
    ).some(
      (name) =>
        hooks[name].interceptors.length > 0 ||
        hooks[name].taps.some((tap) => !supportedHooks[name]?.includes(tap.name))
    ) ||
    [
      compilation.hooks.renderManifest,
      compilation.hooks.runtimeModule,
      compilation.hooks.chunkAsset,
    ].some((hook) => hook.interceptors.length > 0) ||
    compilation.hooks.renderManifest.taps.some(
      (tap) =>
        !['JavascriptModulesPlugin', 'AssetModulesPlugin', 'CssModulesPlugin'].includes(tap.name)
    ) ||
    compilation.hooks.runtimeModule.taps.some(
      (tap) => tap.name !== 'SourceMapDevToolModuleOptionsPlugin'
    ) ||
    compilation.hooks.chunkAsset.taps.some((tap) => tap.name !== 'StorybookTurbosnapOutput') ||
    [...compilation.modules].some(
      (module) =>
        module.type === 'runtime' &&
        !(
          runtimePrototypes.has(Object.getPrototypeOf(module)) &&
          !['generate', 'codeGeneration', 'constructor'].some((name) => Object.hasOwn(module, name))
        ) &&
        !isKnownCommonJsRuntime(compilation, module)
    )
  ) {
    throw new UnsupportedWebpackOutput('unsupported-webpack-output-renderer');
  }
  const chunks = renderedChunks.get(compilation);
  if (!chunks || [...chunks.values()].some(({ source }) => !source)) {
    throw new UnsupportedWebpackOutput('missing-webpack-rendered-output');
  }
  return chunks;
}

function ecmaVersion(compilation: Compilation): 5 | 2015 | 2017 | 2020 {
  const environment = compilation.outputOptions.environment;
  if (
    environment.bigIntLiteral ||
    environment.dynamicImport ||
    environment.dynamicImportInWorker ||
    environment.globalThis ||
    environment.optionalChaining
  )
    return 2020;
  if (environment.asyncFunction) return 2017;
  if (
    environment.arrowFunction ||
    environment.const ||
    environment.destructuring ||
    environment.forOf ||
    environment.methodShorthand ||
    environment.module ||
    environment.templateLiteral
  )
    return 2015;
  return 5;
}

export async function matchesRenderedWebpackChunk(
  compilation: Compilation,
  rendered: string,
  emitted: string
) {
  if (rendered === emitted) return true;
  const options = {
    ecma: ecmaVersion(compilation),
    mangle: false,
    keep_fnames: true,
    format: { comments: false, preserve_annotations: false },
  };
  // Never optimize emitted code: late PURE annotations cannot erase calls the browser will execute.
  const final = await TerserWebpackPlugin.terserMinify({ 'chunk.js': emitted }, undefined, {
    ...options,
    compress: false,
  });
  if (!final.code) return false;
  const original = await TerserWebpackPlugin.terserMinify({ 'chunk.js': rendered }, undefined, {
    ...options,
    compress: false,
  });
  if (original.code === final.code) return true;
  const minified = await TerserWebpackPlugin.terserMinify(
    { 'chunk.js': rendered },
    undefined,
    options
  );
  return minified.code === final.code;
}
