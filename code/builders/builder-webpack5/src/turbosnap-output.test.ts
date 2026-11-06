import * as nodeFs from 'node:fs/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeStories } from 'storybook/internal/common';
import type { Options, TurbosnapOutputDraft } from 'storybook/internal/types';

import { toImportFn } from '@storybook/core-webpack';

import { resolve } from 'pathe';
import { createFsFromVolume, Volume } from 'memfs';
import webpack from 'webpack';
import TerserWebpackPlugin from 'terser-webpack-plugin';

import { trackWebpackChunkSources } from './turbosnap-chunks.ts';
import { productionPreviewChunkFilename } from './preview/preview-filename.ts';
import { canonicalizeWebpackRuntime, createWebpackOutputEvidence } from './turbosnap-output.ts';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, readdir: vi.fn(actual.readdir), readFile: vi.fn(actual.readFile) };
});

function evidence(first = '12345678') {
  return {
    references: new Map([
      [`A.${first}.js`, { identity: 'story-a', contentHash: first }],
      ['B.87654321.js', { identity: 'story-b', contentHash: '87654321' }],
    ]),
    expected: new Map([
      ['10', `A.${first}.js`],
      ['20', 'B.87654321.js'],
    ]),
  };
}

function canonical(source: string, first?: string) {
  const { references, expected } = evidence(first);
  return canonicalizeWebpackRuntime(source, references, expected);
}

describe('Webpack final runtime references', () => {
  it('keeps an unrelated story fingerprint stable when only a generated URL hash changes', () => {
    const before =
      '__webpack_require__.u=id=>10===id?"A.12345678.js":20===id?"B.87654321.js":void 0;';
    const after =
      '__webpack_require__.u=id=>10===id?"A.abcdef12.js":20===id?"B.87654321.js":void 0;';

    expect(canonical(before)).toBe(canonical(after, 'abcdef12'));
  });

  it('preserves application strings even when they contain an emitted filename', () => {
    const source =
      'console.log("A.12345678.js");__webpack_require__.u=id=>10===id?"A.12345678.js":20===id?"B.87654321.js":void 0;';

    expect(canonical(source)).toContain('console.log("A.12345678.js")');
  });

  it('handles the unminified generated function kept in a source map', () => {
    const source =
      '__webpack_require__.u = (id) => { if (id === 10) return "A.12345678.js"; if (id === 20) return "B.87654321.js"; return undefined; };';

    expect(canonical(source)).toContain('"A.__turbosnap_story-a__.js"');
    expect(canonical(source)).toContain('"B.__turbosnap_story-b__.js"');
  });

  it.each([
    ['side effects', '__webpack_require__.u=id=>(console.log(id),"A.12345678.js");'],
    [
      'unbound filename',
      '__webpack_require__.u=id=>10===id?"other.12345678.js":20===id?"B.87654321.js":void 0;',
    ],
    ['missing reference', '__webpack_require__.u=id=>10===id?"A.12345678.js":void 0;'],
    [
      'unknown id',
      '__webpack_require__.u=id=>11===id?"A.12345678.js":20===id?"B.87654321.js":void 0;',
    ],
    [
      'changed default',
      '__webpack_require__.u=id=>10===id?"A.12345678.js":20===id?"B.87654321.js":"fallback.js";',
    ],
    [
      'duplicate assignment',
      '__webpack_require__.u=id=>10===id?"A.12345678.js":20===id?"B.87654321.js":void 0;__webpack_require__.u=()=>"other.js";',
    ],
    ['renamed namespace', 'other.u=id=>10===id?"A.12345678.js":20===id?"B.87654321.js":void 0;'],
  ])('rejects %s instead of waiving global captures', (_name, source) => {
    expect(() => canonical(source)).toThrow();
  });

  it('retains changes in every byte outside the owned generated URL literals', () => {
    const source =
      '__webpack_require__.u=id=>10===id?"A.12345678.js":20===id?"B.87654321.js":void 0;';

    expect(canonical(`${source}globalThis.color="red";`)).not.toBe(
      canonical(`${source}globalThis.color="blue";`)
    );
  });
});

describe('Webpack compiled story coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(nodeFs.readdir).mockReset();
    vi.mocked(nodeFs.readFile).mockReset();
  });

  async function build(
    label: string,
    settings: {
      hiddenEffect?: 'story' | 'global';
      previewImportsStory?: boolean;
      htmlStory?: boolean;
      modifiedStoryLoader?: boolean;
      finalLoaderCall?:
        | 'importFn'
        | 'context'
        | 'chunk'
        | 'computed-chunk'
        | 'aliased-chunk'
        | 'aliased-runtime'
        | 'handler'
        | 'context-startup'
        | 'valueof-runtime'
        | 'computed-context'
        | 'annotated-chunk'
        | 'annotated-context'
        | 'eval'
        | 'factory-arguments'
        | 'chunk-registration';
      producerMutation?:
        | 'render'
        | 'chunk-asset'
        | 'runtime-module'
        | 'interceptor'
        | 'spoofed-runtime';
      finalLoaderTarget?: 'main' | 'story' | 'runtime';
      minimize?: boolean;
      repeatBuild?: boolean;
      filenameObservation?: boolean;
      duplicatedDependency?: boolean;
      htmlExtra?: 'present' | 'missing' | 'disk' | 'symlink';
      groupedStories?: boolean;
      sharedObserver?: 'used-by-a' | 'unrelated';
      concatenatedObserver?: boolean;
    } = {}
  ) {
    const {
      hiddenEffect,
      previewImportsStory,
      htmlStory,
      modifiedStoryLoader,
      finalLoaderCall,
      producerMutation,
      finalLoaderTarget = 'main',
      minimize = false,
      repeatBuild,
      filenameObservation,
      duplicatedDependency,
      htmlExtra,
      groupedStories,
      sharedObserver,
      concatenatedObserver,
    } = settings;
    const root = resolve('virtual-webpack-output');
    const generatedStoryLoader = toImportFn(
      normalizeStories(['../src/*.stories.js'], {
        configDir: `${root}/.storybook`,
        workingDir: root,
      }),
      { needPipelinedImport: false }
    );
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    const volume = Volume.fromJSON({
      [`${root}/package.json`]: '{"name":"webpack-output-test"}',
      [`${root}/entry.js`]:
        'import "./preview.js"; import {importFn} from "./storybook-stories.js"; new globalThis.PreviewWeb(importFn, () => ({}));',
      [`${root}/storybook-stories.js`]:
        generatedStoryLoader + (modifiedStoryLoader ? ';importFn("./src/A.stories.js");' : ''),
      [`${root}/preview.js`]: `import {shared} from './shared.js'; globalThis.base=shared;${previewImportsStory ? 'import "./src/A.stories.js";' : ''}`,
      [`${root}/shared.js`]: `${concatenatedObserver ? 'export { currentUrl } from "./observer.js";' : ''}/** @license fixture */ export const shared = "shared";${sharedObserver && !concatenatedObserver ? 'export function currentUrl(){return document.currentScript?.src;}' : ''}`,
      [`${root}/observer.js`]: 'export function currentUrl(){return document.currentScript?.src;}',
      [`${root}/src/A.stories.js`]: `${sharedObserver === 'used-by-a' ? 'import {currentUrl} from "../shared.js"; globalThis.observed=currentUrl();' : ''}${duplicatedDependency ? 'import {duplicate} from "../duplicate.js"; console.log(duplicate);' : ''}import data from "../.storybook/fixture.json"; export const Basic = data.label;`,
      [`${root}/src/B.stories.js`]: `${sharedObserver === 'unrelated' ? 'import {currentUrl} from "../shared.js"; globalThis.observed=currentUrl();' : ''}${duplicatedDependency ? 'import {duplicate} from "../duplicate.js"; console.log(duplicate);' : ''}import {shared} from "../shared.js"; export const Basic = shared;`,
      [`${root}/duplicate.js`]: 'export const duplicate = Math.random();',
      [`${root}/.storybook/fixture.json`]: JSON.stringify({ label }),
    });
    const filesystem = createFsFromVolume(volume);
    if (htmlExtra === 'disk' || htmlExtra === 'symlink') {
      volume.mkdirSync(`${root}/dist`);
      const source = `globalThis.extra=${JSON.stringify(label)};`;
      if (htmlExtra === 'disk') volume.writeFileSync(`${root}/dist/extra-runtime.js`, source);
      else {
        volume.writeFileSync(`${root}/outside.js`, source);
        volume.symlinkSync(`${root}/outside.js`, `${root}/dist/extra-runtime.js`);
      }
      vi.mocked(nodeFs.readdir).mockImplementation(
        filesystem.promises.readdir as typeof nodeFs.readdir
      );
      vi.mocked(nodeFs.readFile).mockImplementation(
        filesystem.promises.readFile as typeof nodeFs.readFile
      );
    }
    let evidence: TurbosnapOutputDraft | undefined;
    const compiler = webpack({
      context: root,
      mode: 'production',
      cache: repeatBuild ? { type: 'memory' } : false,
      devtool: false,
      entry: './entry.js',
      output: {
        path: `${root}/dist`,
        filename: '[name].[contenthash:8].js',
        chunkFilename: productionPreviewChunkFilename,
        publicPath: '',
        hashSalt: filenameObservation ? label : undefined,
      },
      optimization: {
        runtimeChunk: true,
        moduleIds: 'named',
        minimize,
        minimizer: [
          new TerserWebpackPlugin({
            parallel: false,
            terserOptions: { mangle: false, keep_fnames: true },
          }),
        ],
        splitChunks: groupedStories
          ? {
              cacheGroups: {
                stories: {
                  test: /(?:stories\.js|fixture\.json)$/,
                  chunks: 'async',
                  name: 'stories',
                  enforce: true,
                },
              },
            }
          : undefined,
      },
      plugins: [
        ...(filenameObservation
          ? [
              new webpack.BannerPlugin({
                banner: 'globalThis.lastChunkUrl = document.currentScript?.src;',
                raw: true,
              }),
            ]
          : []),
        {
          apply(compiler) {
            compiler.hooks.thisCompilation.tap('HiddenInput', (compilation) => {
              if (producerMutation === 'interceptor') {
                compiler.webpack.javascript.JavascriptModulesPlugin.getCompilationHooks(
                  compilation
                ).renderChunk.intercept({
                  register(tap) {
                    const original = tap.fn;
                    return {
                      ...tap,
                      fn: (...args: unknown[]) =>
                        new compiler.webpack.sources.ConcatSource(
                          original(...args),
                          ';globalThis.untracked = true;'
                        ),
                    };
                  },
                });
              }
              if (producerMutation === 'render') {
                compiler.webpack.javascript.JavascriptModulesPlugin.getCompilationHooks(
                  compilation
                ).renderModuleContent.tap(
                  'UntrackedRenderer',
                  (source) =>
                    new compiler.webpack.sources.ConcatSource(
                      source,
                      ';globalThis.untracked = true;'
                    )
                );
              }
              if (producerMutation === 'chunk-asset') {
                compilation.hooks.chunkAsset.tap('UntrackedRenderer', (_chunk, file) => {
                  compilation.updateAsset(
                    file,
                    (source) =>
                      new compiler.webpack.sources.ConcatSource(
                        source,
                        ';globalThis.untracked = true;'
                      )
                  );
                });
              }
              if (producerMutation === 'runtime-module' || producerMutation === 'spoofed-runtime') {
                compilation.hooks.additionalChunkRuntimeRequirements.tap(
                  'UntrackedRenderer',
                  (chunk) => {
                    if (!chunk.hasRuntime()) return;
                    const runtime = new (class extends compiler.webpack.RuntimeModule {
                      constructor() {
                        super('untracked eager loading');
                      }
                      generate() {
                        const story = [...compilation.chunks].find((candidate) =>
                          candidate.name?.startsWith('A-stories')
                        )!;
                        return `__webpack_require__.e(${JSON.stringify(story.id)}).then(__webpack_require__.bind(__webpack_require__, "./src/A.stories.js"));`;
                      }
                    })();
                    if (producerMutation === 'spoofed-runtime')
                      Object.defineProperty(runtime, 'constructor', {
                        value: compiler.webpack.runtime.LoadScriptRuntimeModule,
                      });
                    compilation.addRuntimeModule(chunk, runtime);
                  }
                );
              }
              compilation.hooks.processAssets.tap(
                { name: 'Html', stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT },
                () => {
                  const imports = [...compilation.chunks]
                    .filter((chunk) => chunk.canBeInitial())
                    .flatMap((chunk) => [...chunk.files])
                    .filter((file) => file.endsWith('.js'))
                    .map((file) => `import './${file}';`)
                    .join('');
                  const story = [...compilation.chunks].find((chunk) =>
                    chunk.name?.startsWith('A-stories')
                  );
                  if (finalLoaderCall) {
                    const target = [...compilation.chunks].find((chunk) =>
                      finalLoaderTarget === 'runtime'
                        ? chunk.hasRuntime()
                        : finalLoaderTarget === 'story'
                          ? chunk.name?.startsWith('B-stories')
                          : chunk.name === 'main'
                    )!;
                    const loader = [...compilation.modules].find((module) =>
                      module.nameForCondition()?.endsWith('/storybook-stories.js')
                    )!;
                    const context = [
                      ...compilation.moduleGraph.getOutgoingConnections(loader),
                    ].find(
                      (connection) => connection.dependency?.type === 'import() context lazy'
                    )!.resolvedModule!;
                    const calls = {
                      importFn: 'importFn("./src/A.stories.js")',
                      context: `__webpack_require__(${JSON.stringify(compilation.chunkGraph.getModuleId(context))})("./A.stories.js")`,
                      chunk: `__webpack_require__.e(${JSON.stringify(story!.id)}).then(__webpack_require__.bind(__webpack_require__, "./src/A.stories.js"))`,
                      'computed-chunk': `__webpack_require__["e"](${JSON.stringify(story!.id)})`,
                      'aliased-chunk': `const load = __webpack_require__.e; load(${JSON.stringify(story!.id)})`,
                      'aliased-runtime': `const runtime = __webpack_require__; runtime.e(${JSON.stringify(story!.id)}).then(runtime.bind(runtime, "./src/A.stories.js"))`,
                      handler: `const promises=[]; __webpack_require__.f.j(${JSON.stringify(story!.id)},promises); Promise.all(promises).then(__webpack_require__.bind(__webpack_require__, "./src/A.stories.js"))`,
                      'context-startup': 'webpackAsyncContext("./A.stories.js")',
                      'valueof-runtime': `const runtime = __webpack_require__.valueOf(); runtime.e(${JSON.stringify(story!.id)}).then(runtime.bind(runtime, "./src/A.stories.js"))`,
                      'computed-context': `__webpack_require__(${JSON.stringify(String(compilation.chunkGraph.getModuleId(context)).slice(0, 1))} + ${JSON.stringify(String(compilation.chunkGraph.getModuleId(context)).slice(1))})("./A.stories.js")`,
                      'annotated-chunk': `/*#__PURE__*/(/*#__PURE__*/__webpack_require__.e(${JSON.stringify(story!.id)})).then(() => __webpack_require__("./src/A.stories.js"))`,
                      'annotated-context': '/*#__PURE__*/webpackAsyncContext("./A.stories.js")',
                      eval: `eval(${JSON.stringify(`__webpack_require__.e(${JSON.stringify(story!.id)}).then(__webpack_require__.bind(__webpack_require__, "./src/A.stories.js"))`)})`,
                      'factory-arguments': `arguments[2].e(${JSON.stringify(story!.id)}).then(arguments[2].bind(arguments[2], "./src/A.stories.js"))`,
                      'chunk-registration': `self[${JSON.stringify(compiler.options.output.chunkLoadingGlobal)}].push([["late-chunk"], {}, runtime => runtime.e(${JSON.stringify(story!.id)}).then(runtime.bind(runtime, "./src/A.stories.js"))])`,
                    };
                    compilation.updateAsset([...target.files][0], (source) => {
                      const previous = source.source().toString();
                      const marker = ['context-startup', 'annotated-context'].includes(
                        finalLoaderCall
                      )
                        ? 'module.exports = webpackAsyncContext;'
                        : finalLoaderTarget === 'runtime'
                          ? '__webpack_require__.O ='
                          : finalLoaderTarget === 'story'
                            ? '__webpack_require__.r(__webpack_exports__);'
                            : 'new globalThis.PreviewWeb(';
                      const next = previous.replace(marker, `${calls[finalLoaderCall]}; ${marker}`);
                      expect(next).not.toBe(previous);
                      return new compiler.webpack.sources.RawSource(next);
                    });
                  }
                  compilation.emitAsset(
                    'iframe.html',
                    new compiler.webpack.sources.RawSource(
                      `<script type="module">${imports}${htmlExtra ? "import './extra-runtime.js';" : ''}</script>${htmlStory ? `<script src="./${[...story!.files][0]}"></script>` : ''}`
                    )
                  );
                  if (htmlExtra === 'present')
                    compilation.emitAsset(
                      'extra-runtime.js',
                      new compiler.webpack.sources.RawSource(
                        `globalThis.extra=${JSON.stringify(label)};`
                      )
                    );
                }
              );
              compilation.hooks.processAssets.tap({ name: 'HiddenInput', stage: 100 }, () => {
                if (!hiddenEffect) return;
                const target = [...compilation.chunks].find((chunk) =>
                  hiddenEffect === 'global'
                    ? chunk.name === 'main'
                    : chunk.name?.startsWith('B-stories')
                );
                if (!target) throw new Error('missing hidden-effect target');
                const file = [...target.files][0];
                const data = filesystem.readFileSync(`${root}/.storybook/fixture.json`, 'utf8');
                compilation.updateAsset(
                  file,
                  (source) =>
                    new compiler.webpack.sources.RawSource(
                      `${source.source()};globalThis.hidden=${data};`
                    )
                );
              });
            });
          },
        },
      ],
    });
    if (!compiler) throw new Error('missing test compiler');
    trackWebpackChunkSources(compiler);
    compiler.inputFileSystem = filesystem as unknown as NonNullable<
      typeof compiler.inputFileSystem
    >;
    compiler.outputFileSystem = filesystem as unknown as NonNullable<
      typeof compiler.outputFileSystem
    >;
    compiler.hooks.emit.tapPromise('Evidence', async (compilation) => {
      if (concatenatedObserver) {
        expect(
          [...compilation.modules].some(
            (module) =>
              'modules' in module &&
              Array.isArray(module.modules) &&
              module.modules.some((member) => member.nameForCondition()?.endsWith('/observer.js'))
          )
        ).toBe(true);
      }
      evidence = await createWebpackOutputEvidence(compilation, {
        configDir: `${root}/.storybook`,
        outputDir: htmlExtra === 'disk' || htmlExtra === 'symlink' ? `${root}/dist` : undefined,
        presets: { apply: async () => ['../src/*.stories.js'] },
      } as unknown as Options);
    });
    const run = () =>
      new Promise<webpack.Stats>((succeed, fail) =>
        compiler.run((error, stats) => {
          if (error || !stats || stats.hasErrors()) fail(error ?? new Error(stats?.toString()));
          else succeed(stats);
        })
      );
    await run();
    if (repeatBuild) {
      const cached = await run();
      expect(
        [...cached.compilation.modules].filter((module) =>
          cached.compilation.builtModules.has(module)
        ).length
      ).toBe(0);
    }
    await new Promise<void>((succeed, fail) =>
      compiler.close((error) => (error ? fail(error) : succeed()))
    );
    expect(evidence?.status, evidence?.reason).toBe(
      finalLoaderCall ||
        producerMutation ||
        hiddenEffect ||
        filenameObservation ||
        htmlExtra === 'missing' ||
        htmlExtra === 'symlink'
        ? 'incomplete'
        : 'complete'
    );
    return evidence!;
  }

  it('keeps B stable when A changes even when B shares a concatenated preview module', async () => {
    const before = await build('before');
    const after = await build('after');

    expect(after.globalOutputHash).toBe(before.globalOutputHash);
    expect(after.storyOutputHashes['./src/A.stories.js']).not.toBe(
      before.storyOutputHashes['./src/A.stories.js']
    );
    expect(after.storyOutputHashes['./src/B.stories.js']).toBe(
      before.storyOutputHashes['./src/B.stories.js']
    );
  });

  it('uses the dependency copy in the active chunk when Webpack duplicates a module', async () => {
    const before = await build('before', { duplicatedDependency: true });
    const after = await build('after', { duplicatedDependency: true });

    expect(after.globalOutputHash).toBe(before.globalOutputHash);
    expect(after.storyOutputHashes['./src/B.stories.js']).toBe(
      before.storyOutputHashes['./src/B.stories.js']
    );
    expect(after.storyOutputHashes['./src/A.stories.js']).not.toBe(
      before.storyOutputHashes['./src/A.stories.js']
    );
  });

  it('keeps normal minified story loading selective', async () => {
    const before = await build('before', { minimize: true });
    const after = await build('after', { minimize: true });

    expect(after.globalOutputHash).toBe(before.globalOutputHash);
    expect(after.storyOutputHashes['./src/B.stories.js']).toBe(
      before.storyOutputHashes['./src/B.stories.js']
    );
    expect(after.storyOutputHashes['./src/A.stories.js']).not.toBe(
      before.storyOutputHashes['./src/A.stories.js']
    );
  });

  it('validates cached compiler output on a repeated build', async () => {
    const evidence = await build('before', { minimize: true, repeatBuild: true });

    expect(evidence.status).toBe('complete');
  });

  it('widens coverage when Webpack places both stories in the same output chunk', async () => {
    const before = await build('before', { groupedStories: true });
    const after = await build('after', { groupedStories: true });

    expect(after.storyOutputHashes['./src/B.stories.js']).not.toBe(
      before.storyOutputHashes['./src/B.stories.js']
    );
  });

  it('rejects a banner added after the graph-producing render', async () => {
    const evidence = await build('before', { filenameObservation: true });

    expect(evidence.reason).toBe('unrecognized-webpack-final-output');
  });

  it('binds the filenames of callers of an exported script URL observer', async () => {
    const before = await build('before', { sharedObserver: 'used-by-a' });
    const after = await build('after', { sharedObserver: 'used-by-a' });

    expect(after.globalOutputHash).not.toBe(before.globalOutputHash);
  });

  it('follows transitive observer callers through Webpack concatenated wrappers', async () => {
    const before = await build('before', {
      sharedObserver: 'used-by-a',
      concatenatedObserver: true,
    });
    const after = await build('after', { sharedObserver: 'used-by-a', concatenatedObserver: true });

    expect(after.globalOutputHash).not.toBe(before.globalOutputHash);
  });

  it('keeps unrelated story changes selective with a shared observer in another branch', async () => {
    const before = await build('before', { sharedObserver: 'unrelated' });
    const after = await build('after', { sharedObserver: 'unrelated' });

    expect(after.globalOutputHash).toBe(before.globalOutputHash);
  });

  it('binds a non-chunk HTML script as global output', async () => {
    const before = await build('before', { htmlExtra: 'present' });
    const after = await build('after', { htmlExtra: 'present' });

    expect(after.outputFiles['extra-runtime.js']).toBeDefined();
    expect(after.globalOutputHash).not.toBe(before.globalOutputHash);
  });

  it('rejects an HTML import with no known output file', async () => {
    const evidence = await build('before', { htmlExtra: 'missing' });

    expect(evidence.reason).toBe('unresolved-inline-output-reference');
  });

  it('binds a runtime copied to disk outside the Webpack compilation', async () => {
    const before = await build('before', { htmlExtra: 'disk' });
    const after = await build('after', { htmlExtra: 'disk' });

    expect(after.outputFiles['extra-runtime.js']).toBeDefined();
    expect(after.globalOutputHash).not.toBe(before.globalOutputHash);
  });

  it('does not resolve a copied runtime through a symlink', async () => {
    const evidence = await build('before', { htmlExtra: 'symlink' });

    expect(evidence.reason).toBe('unresolved-inline-output-reference');
    expect(nodeFs.readFile).not.toHaveBeenCalled();
  });

  it.each(['story', 'global'] as const)(
    'rejects post-render plugin changes to a %s chunk',
    async (hiddenEffect) => {
      const evidence = await build('before', { hiddenEffect });

      expect(evidence.reason).toBe('unrecognized-webpack-final-output');
    }
  );

  it('keeps a story imported by HTML globally covered', async () => {
    const before = await build('before', { htmlStory: true });
    const after = await build('after', { htmlStory: true });

    expect(after.globalOutputHash).not.toBe(before.globalOutputHash);
  });

  it.each(['importFn', 'context'] as const)(
    'rejects eager %s calls injected after module graph creation',
    async (finalLoaderCall) => {
      const evidence = await build('before', { finalLoaderCall });

      expect(evidence.reason).toBe('unrecognized-webpack-final-story-loader');
    }
  );

  it.each([
    'chunk',
    'computed-chunk',
    'aliased-chunk',
    'aliased-runtime',
    'handler',
    'valueof-runtime',
    'computed-context',
    'context-startup',
    'annotated-context',
  ] as const)(
    'rejects eager %s loads injected after module graph creation',
    async (finalLoaderCall) => {
      const evidence = await build('before', { finalLoaderCall });

      expect(evidence.reason).toBe('unrecognized-webpack-final-output');
    }
  );

  it.each(['story', 'runtime'] as const)(
    'rejects a chunk load injected into a %s output',
    async (finalLoaderTarget) => {
      const evidence = await build('before', { finalLoaderCall: 'chunk', finalLoaderTarget });

      expect(evidence.reason).toBe('unrecognized-webpack-final-output');
    }
  );

  it('rejects annotated chunk loads in the emitted runtime', async () => {
    const evidence = await build('before', {
      finalLoaderCall: 'annotated-chunk',
      finalLoaderTarget: 'runtime',
    });

    expect(evidence.reason).toBe('unrecognized-webpack-final-output');
  });

  it.each(['main', 'story', 'runtime'] as const)(
    'rejects dynamic evaluation injected into %s',
    async (finalLoaderTarget) => {
      const evidence = await build('before', { finalLoaderCall: 'eval', finalLoaderTarget });

      expect(evidence.reason).toBe('unrecognized-webpack-final-output');
    }
  );

  it('rejects an eager load through a factory runtime argument', async () => {
    const evidence = await build('before', {
      finalLoaderCall: 'factory-arguments',
      finalLoaderTarget: 'story',
    });

    expect(evidence.reason).toBe('unrecognized-webpack-final-output');
  });

  it('rejects an extra chunk-registration callback', async () => {
    const evidence = await build('before', { finalLoaderCall: 'chunk-registration' });

    expect(evidence.reason).toBe('unrecognized-webpack-final-output');
  });

  it.each(['render', 'chunk-asset', 'runtime-module', 'interceptor', 'spoofed-runtime'] as const)(
    'rejects an unsupported %s producer',
    async (producerMutation) => {
      const evidence = await build('before', { producerMutation });

      expect(evidence.reason).toBe('unsupported-webpack-output-renderer');
    }
  );

  it('keeps transformed generated story loaders conservative', async () => {
    const before = await build('before', { modifiedStoryLoader: true });
    const after = await build('after', { modifiedStoryLoader: true });

    expect(after.globalOutputHash).not.toBe(before.globalOutputHash);
  });

  it('keeps a direct preview import of a story global', async () => {
    const before = await build('before', { previewImportsStory: true });
    const after = await build('after', { previewImportsStory: true });

    expect(after.globalOutputHash).not.toBe(before.globalOutputHash);
  });
});
