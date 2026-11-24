import { readFile } from 'node:fs/promises';

import type { BuildOptions, BuildResult, OutputFile } from 'esbuild';
import { dirname, join, relative } from 'pathe';
import type { InputOptions, ModuleTypes, OutputOptions, Plugin } from 'rolldown';

import { globalsModuleInfoMap } from '../manager/globals/globals-module-info.ts';

type ManagerBuildOptions = BuildOptions & { entryPoints: string[]; outdir: string };

/** Measurement variants, selected with `STORYBOOK_MANAGER_ROLLDOWN_VARIANT` (comma-separated). */
export const variants = {
  /** Map global packages with `external` + `output.globals` instead of the plugin port. */
  nativeExternals: () => hasVariant('native-externals'),
  /** Use Rolldown's default `dce-only` minification where esbuild only sets `minifySyntax`. */
  dceOnly: () => hasVariant('dce-only'),
  /** Include every module in full instead of mirroring esbuild's `ignoreAnnotations`. */
  noTreeshake: () => hasVariant('no-treeshake'),
};

const hasVariant = (name: string) =>
  (process.env.STORYBOOK_MANAGER_ROLLDOWN_VARIANT ?? '').split(',').includes(name);

const GLOBALS_PREFIX = '\0global-externals:';

/** Rolldown port of `@fal-works/esbuild-plugin-global-externals`, generating the same modules. */
const globalExternalsPlugin = (): Plugin => ({
  name: 'global-externals',
  resolveId: {
    filter: { id: new RegExp(`^(?:${Object.keys(globalsModuleInfoMap).join('|')})$`) },
    handler: (id) => `${GLOBALS_PREFIX}${id}`,
  },
  load: {
    filter: { id: new RegExp(`^${GLOBALS_PREFIX}`) },
    handler: (id) => {
      const key = id.slice(GLOBALS_PREFIX.length) as keyof typeof globalsModuleInfoMap;
      const { varName, namedExports, defaultExport } = globalsModuleInfoMap[key];
      const lines = defaultExport ? [`export default ${varName};`] : [];
      if (namedExports?.length) {
        const names = [...new Set(namedExports)].join(', ');
        lines.push(`const { ${names} } = ${varName};`, `export { ${names} };`);
      }
      return { code: lines.join('\n'), moduleType: 'js' };
    },
  },
});

/** Collects imported CSS files, which Rolldown refuses to bundle itself. */
const cssPlugin = (collected: string[]): Plugin => ({
  name: 'storybook-manager-css',
  load: {
    filter: { id: /\.css$/ },
    handler: async (id) => {
      collected.push(await readFile(id, 'utf8'));
      return { code: '', moduleType: 'js', moduleSideEffects: false };
    },
  },
});

const ESBUILD_LOADER_TO_MODULE_TYPE: Record<string, ModuleTypes[string] | undefined> = {
  js: 'js',
  jsx: 'jsx',
  ts: 'ts',
  tsx: 'tsx',
  json: 'json',
  text: 'text',
  base64: 'base64',
  dataurl: 'dataurl',
  binary: 'binary',
  empty: 'empty',
  file: 'asset',
  copy: 'copy',
};

const toModuleTypes = (loader: BuildOptions['loader'] = {}): ModuleTypes =>
  Object.fromEntries(
    Object.entries(loader).flatMap(([ext, name]) => {
      const moduleType = ESBUILD_LOADER_TO_MODULE_TYPE[name];
      return moduleType ? [[ext, moduleType]] : [];
    })
  );

const toMinify = (config: ManagerBuildOptions): OutputOptions['minify'] => {
  if (config.minify) {
    return true;
  }
  const compress = config.minifySyntax ?? false;
  const mangle = config.minifyIdentifiers ?? false;
  const removeWhitespace = config.minifyWhitespace ?? false;
  if (!compress && !mangle && !removeWhitespace) {
    return false;
  }
  if (variants.dceOnly() && !mangle && !removeWhitespace) {
    return 'dce-only';
  }
  return { compress, mangle, codegen: { removeWhitespace } };
};

/** Mirrors esbuild's default `outbase`: the lowest common ancestor directory of all entries. */
const getOutbase = (entryPoints: string[]) => {
  const [first, ...rest] = entryPoints.map((entry) => dirname(entry).split('/'));
  let length = first.length;
  for (const parts of rest) {
    let shared = 0;
    while (shared < length && shared < parts.length && parts[shared] === first[shared]) {
      shared++;
    }
    length = shared;
  }
  return first.slice(0, length).join('/') || '/';
};

const toOutputFile = (path: string, text: string): OutputFile => ({
  path,
  text,
  contents: Buffer.from(text),
  hash: '',
});

/**
 * Experimental Rolldown stand-in for esbuild's `build`, for the manager builder only.
 *
 * It accepts the esbuild config produced by `getConfig` and returns an esbuild-shaped result, so
 * the rest of the manager builder is unaware of which bundler ran.
 *
 * Known differences from the esbuild path:
 *
 * - Rolldown cannot emit `iife` for several entries in one build, so every manager entry is its own
 *   build. Modules shared between entries are parsed once per entry instead of once overall.
 * - `supported: { 'class-static-blocks': false }` has no Rolldown equivalent; static blocks are
 *   emitted as written.
 * - `legalComments: 'external'` is not available; legal comments are dropped and no `.LEGAL.txt`
 *   files are produced.
 * - Rolldown does not bundle CSS. CSS imports are concatenated as-is, so `@import` and `url()` are
 *   not rewritten.
 * - A bare specifier that cannot be resolved is a warning in Rolldown and an error in esbuild.
 */
export const buildWithRolldown = async (config: ManagerBuildOptions): Promise<BuildResult> => {
  const { build } = await import('rolldown');

  // esbuild leaves `module` alone in CommonJS files and replaces it elsewhere. Rolldown's `define`
  // would replace it everywhere and break `module.exports`, so the replacement becomes a variable
  // in the bundle scope, which the CommonJS wrapper's own `module` parameter shadows.
  const { module: moduleDefine, ...define } = config.define ?? {};

  const nativeExternals = variants.nativeExternals();
  const globalNames = Object.fromEntries(
    Object.entries(globalsModuleInfoMap).map(([id, info]) => [id, info.varName])
  );

  const inputOptions: InputOptions = {
    platform: config.platform,
    tsconfig: config.tsconfig,
    external: nativeExternals ? Object.keys(globalNames) : undefined,
    resolve: {
      extensions: config.resolveExtensions,
      conditionNames: config.conditions,
    },
    moduleTypes: toModuleTypes(config.loader),
    // `ignoreAnnotations` ignores both pure annotations and the `sideEffects` package field
    treeshake: variants.noTreeshake()
      ? false
      : config.ignoreAnnotations
        ? { annotations: false, moduleSideEffects: [{ test: /.*/, sideEffects: true }] }
        : true,
    transform: {
      target: config.target,
      jsx:
        config.jsx === 'automatic'
          ? { runtime: 'automatic', importSource: config.jsxImportSource }
          : { runtime: 'classic', pragma: config.jsxFactory, pragmaFrag: config.jsxFragment },
      define,
    },
  };

  const outputOptions: OutputOptions = {
    format: config.format,
    globals: nativeExternals ? globalNames : undefined,
    banner: config.banner?.js,
    footer: config.footer?.js,
    intro: moduleDefine ? `var module = ${moduleDefine};` : undefined,
    minify: toMinify(config),
    sourcemap: Boolean(config.sourcemap),
    comments: { legal: false, annotation: true, jsdoc: false },
  };

  const outbase = getOutbase(config.entryPoints);

  const outputs = await Promise.all(
    config.entryPoints.map(async (entry) => {
      const css: string[] = [];
      const name = relative(outbase, entry).replace(/\.[^./]+$/, '');
      const url = `./sb-addons/${name.split('/').map(encodeURIComponent).join('/')}.js`;
      const { output } = await build({
        ...inputOptions,
        input: entry,
        plugins: [!nativeExternals && globalExternalsPlugin(), cssPlugin(css)],
        output: {
          ...outputOptions,
          // Rolldown minifies the footer with the chunk and parses an `iife` chunk as a script,
          // where `import.meta` is a syntax error
          footer: outputOptions.footer
            ?.toString()
            .replaceAll('import.meta.url', JSON.stringify(url)),
        },
        write: false,
      });

      const base = join(config.outdir, name);
      const files = output.flatMap((item) =>
        item.type === 'chunk' ? [toOutputFile(`${base}.js`, item.code)] : []
      );
      if (css.length > 0) {
        files.push(toOutputFile(`${base}.css`, css.join('\n')));
      }
      return files;
    })
  );

  return {
    errors: [],
    warnings: [],
    outputFiles: outputs.flat(),
    metafile: undefined,
    mangleCache: undefined,
  } as unknown as BuildResult;
};
