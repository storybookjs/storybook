import { spawnSync } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { sep } from 'node:path';

import { basename, dirname, join, relative } from 'pathe';
import picocolors from 'picocolors';
import type { Plugin } from 'rolldown';
import { rolldown } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';
import ts from 'typescript';

import type { BuildEntries } from './entry-utils.ts';
import { getExternal } from './entry-utils.ts';

const DIR_CODE = join(import.meta.dirname, '..', '..', '..', 'code');
const DIR_ROOT = join(DIR_CODE, '..');

const DTS_EXCLUDES = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.stories.*',
  '**/*.mockdata.*',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/node_modules/**',
];

/**
 * Resolve a tsconfig chain (following `extends`) and return merged compilerOptions.
 * Strips JSON comments and trailing commas before parsing.
 */
async function resolveTsconfigCompilerOptions(tsconfigPath: string): Promise<Record<string, any>> {
  const raw = await readFile(tsconfigPath, 'utf8');
  const stripped = raw.replace(/\/\/.*$/gm, '').replace(/,\s*([\]}])/g, '$1');
  const parsed = JSON.parse(stripped);

  let base: Record<string, any> = {};
  if (parsed.extends) {
    const parentPath = join(tsconfigPath, '..', parsed.extends);
    base = await resolveTsconfigCompilerOptions(parentPath);
  }

  return { ...base, ...parsed.compilerOptions };
}

const RE_DTS_IMPORTER = /\.d\.[cm]?ts(?:\?|$)/;

/**
 * The plugin's default 'oxc' resolver does not fall back to DefinitelyTyped
 * `@types/*` packages for untyped dependencies and ignores `typesVersions`
 * (see sxzz/rolldown-plugin-dts#130, oxc-project/oxc-resolver#549). Types
 * that must be inlined (e.g. `@babel/*`) would silently stay external or be
 * inlined from the wrong file (`index-legacy.d.ts`). This pre-resolver fixes
 * exactly those cases: bare, non-external specifiers imported from a .d.ts
 * context are resolved with TypeScript's own module resolution, which handles
 * both `@types/*` fallback and `typesVersions`. Everything else falls through
 * to the plugin's fast Rust resolver.
 */
const TEXT_ASSET_STUB_ID = '\0text-asset-stub.d.ts';

/**
 * The JS bundler inlines `.md`/`.html` imports as strings (see the esbuild
 * `loader` option in generate-bundle), so in the type surface such imports
 * collapse to `string`.
 */
function createTextAssetStubPlugin(): Plugin {
  return {
    name: 'text-asset-stub',
    resolveId(source) {
      if (source.endsWith('.md') || source.endsWith('.html')) {
        return TEXT_ASSET_STUB_ID;
      }
      return null;
    },
    load(id) {
      if (id === TEXT_ASSET_STUB_ID) {
        return 'declare const content: string;\nexport default content;\n';
      }
      return null;
    },
  };
}

function createTypesFallbackResolverPlugin(isExternal: (id: string) => boolean): Plugin {
  const cache = new Map<string, string | null>();
  const compilerOptions: ts.CompilerOptions = {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    resolveJsonModule: true,
  };

  return {
    name: 'storybook:dts-types-fallback-resolver',
    resolveId: {
      order: 'pre',
      handler(id, importer) {
        if (!importer || !RE_DTS_IMPORTER.test(importer.split('?')[0])) {
          return undefined;
        }
        if (id.startsWith('.') || id.startsWith('/') || id.startsWith('\0') || isExternal(id)) {
          return undefined;
        }
        const importerPath = importer.split('?')[0];
        const key = `${dirname(importerPath)}\n${id}`;
        let resolved = cache.get(key);
        if (resolved === undefined) {
          const { resolvedModule } = ts.resolveModuleName(
            id,
            importerPath,
            compilerOptions,
            ts.sys
          );
          resolved =
            resolvedModule && /\.d\.[cm]?ts$/.test(resolvedModule.resolvedFileName)
              ? resolvedModule.resolvedFileName
              : null;
          cache.set(key, resolved);
        }
        return resolved ?? undefined;
      },
    },
  };
}

/** Compiler options shared by both declaration emitters (TS 6 API and TS 7 CLI). */
function dtsEmitCompilerOptions(outDir: string) {
  return {
    noEmit: false,
    noCheck: true,
    declaration: true,
    emitDeclarationOnly: true,
    declarationMap: false,
    sourceMap: false,
    composite: false,
    incremental: false,
    skipLibCheck: true,
    noEmitOnError: false,
    stripInternal: true,
    // Source files import with explicit .ts extensions; emitted d.ts must
    // reference .js so that consumers (and the bundling pass) resolve them.
    allowImportingTsExtensions: true,
    rewriteRelativeImportExtensions: true,
    outDir,
    rootDir: DIR_ROOT,
  } satisfies ts.CompilerOptions;
}

/**
 * Handwritten declaration files (e.g. `typings.d.ts`) are program inputs, not
 * outputs, so tsc does not place them in outDir; copy them so that
 * side-effect imports like `import './typings.d.ts'` resolve in the tree.
 */
function copyHandwrittenDeclarations(fileNames: readonly string[], outDir: string): void {
  for (const fileName of fileNames) {
    if (/\.d\.[cm]?ts$/.test(fileName)) {
      const target = join(outDir, relative(DIR_ROOT, fileName));
      ts.sys.writeFile(target, ts.sys.readFile(fileName) ?? '');
    }
  }
}

function parseWrapperTsconfig(wrapperTsconfig: string): ts.ParsedCommandLine {
  const parsed = ts.getParsedCommandLineOfConfigFile(wrapperTsconfig, undefined, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
  });
  if (!parsed) {
    throw new Error(`Unable to parse ${wrapperTsconfig}`);
  }
  return parsed;
}

/**
 * Emit declarations for the whole package (plus any cross-package sources it
 * imports) with a single `program.emit()` call into `outDir`, mirroring the
 * repo structure (`rootDir` is the repo root).
 *
 * Doing the emit ourselves, up front, is what makes the output deterministic:
 * TypeScript's declaration emit is check-order-dependent (type aliases flap
 * between the alias and its expansion depending on which files were checked
 * first), so letting the dts plugin emit per module in rolldown's concurrent
 * load order produces byte-different output across runs.
 */
function emitPackageDeclarations(wrapperTsconfig: string, outDir: string): void {
  const parsed = parseWrapperTsconfig(wrapperTsconfig);

  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: {
      ...parsed.options,
      ...dtsEmitCompilerOptions(outDir),
    },
  });

  let written = 0;
  const result = program.emit(undefined, (fileName, text, writeByteOrderMark) => {
    written++;
    ts.sys.writeFile(fileName, text, writeByteOrderMark);
  });
  const errors = result.diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errors.length > 0) {
    console.error(
      ts.formatDiagnosticsWithColorAndContext(errors, {
        getCurrentDirectory: () => DIR_ROOT,
        getCanonicalFileName: (fileName) => fileName,
        getNewLine: () => ts.sys.newLine,
      })
    );
  }
  // `emitSkipped` is unreliable with `noCheck` (it reports true even though
  // every file was written), so gate on actual output instead.
  if (written === 0) {
    throw new Error(`Declaration emit produced no output for ${wrapperTsconfig}`);
  }

  copyHandwrittenDeclarations(parsed.fileNames, outDir);
}

/**
 * Same contract as `emitPackageDeclarations`, but the emit runs on the
 * TypeScript 7 native compiler (the `typescript-native` npm alias). TS 7
 * ships no JS compiler API, so the emit options are written into a dedicated
 * tsconfig and the emit is one `tsc -p` child process — still a single
 * whole-program pass over the package, like the TS 6 path.
 */
function emitPackageDeclarationsNative(
  emitTsconfig: string,
  wrapperTsconfig: string,
  outDir: string
): void {
  const require = createRequire(import.meta.url);
  // The package's `exports` map only exposes the new API entry points, so
  // resolve the package root via package.json and spawn its tsc launcher.
  const tscPath = join(dirname(require.resolve('typescript-native/package.json')), 'bin', 'tsc');

  const result = spawnSync(
    process.execPath,
    [tscPath, '--project', emitTsconfig, '--pretty', 'false'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.error) {
    throw result.error;
  }
  // With `noCheck` + `noEmitOnError: false`, diagnostics are advisory (the
  // JS-API path behaves the same); only fail when nothing was emitted.
  if (result.status !== 0) {
    console.error(`${result.stdout ?? ''}${result.stderr ?? ''}`);
  }
  const emitted = ts.sys.readDirectory(outDir, ['.d.ts', '.d.mts', '.d.cts']);
  if (emitted.length === 0) {
    console.error(`${result.stdout ?? ''}${result.stderr ?? ''}`);
    throw new Error(
      `Native declaration emit produced no output for ${emitTsconfig} (exit code ${result.status})`
    );
  }

  copyHandwrittenDeclarations(parseWrapperTsconfig(wrapperTsconfig).fileNames, outDir);
}

export async function generateTypesFiles(
  cwd: string,
  data: BuildEntries,
  options?: { tsgo?: boolean; resolver?: 'oxc' | 'tsc' | 'hybrid' }
) {
  const DIR_REL = relative(DIR_CODE, cwd);

  const dtsEntries = Object.values(data.entries)
    .flat()
    .filter((entry) => entry.dts !== false)
    .map((e) => e.entryPoint);

  if (dtsEntries.length === 0) {
    return;
  }

  const { typesExternal: external } = await getExternal(cwd);

  const externalFn = (id: string) =>
    external.some(
      (dep: string) =>
        id === dep ||
        id.startsWith(`${dep}/`) ||
        id.includes(`${sep}node_modules${sep}${dep}${sep}`)
    );

  // Build entry map: { 'client-logger/index': '/absolute/path/src/client-logger/index.ts', ... }
  const entryMap: Record<string, string> = {};
  for (const entry of dtsEntries) {
    // ./src/client-logger/index.ts -> client-logger/index
    const name = entry.replace(/^\.\/src\//, '').replace(/\.tsx?$/, '');
    entryMap[name] = join(cwd, entry);
  }

  // The dts plugin and tsgo derive rootDir from path.dirname(tsconfig).
  // When rootDir is the package dir, declarations for cross-package imports
  // would be emitted next to their source files. Fix: create a temporary
  // tsconfig at the repo root so rootDir covers the entire monorepo. Use a
  // per-package filename to avoid races when NX compiles packages in parallel.
  const wrapperTsconfig = join(DIR_ROOT, `tsconfig.dts-tmp-${basename(cwd)}.json`);
  const packageTsconfig = join(cwd, 'tsconfig.json');

  const useTsgo = options?.tsgo ?? false;
  const resolver = options?.resolver ?? 'hybrid';

  // tsgo removed support for `baseUrl`, and ts.getParsedCommandLineOfConfigFile
  // needs concrete options anyway: resolve the tsconfig chain and write a flat
  // config.
  const compilerOptions = await resolveTsconfigCompilerOptions(packageTsconfig);
  delete compilerOptions.baseUrl;
  await writeFile(
    wrapperTsconfig,
    JSON.stringify({
      compilerOptions,
      include: [`${relative(DIR_ROOT, cwd)}/src/**/*`],
      exclude: DTS_EXCLUDES,
    })
  );

  // Pre-emitted declarations land here and are bundled from there; the
  // directory never ships (removed in `finally`).
  const emitDir = join(cwd, '.dts-emit');

  // TS 7 has no JS compiler API, so its emit options cannot be passed
  // programmatically; write them into a second temporary tsconfig instead.
  const emitTsconfig = join(DIR_ROOT, `tsconfig.dts-tmp-${basename(cwd)}-emit.json`);

  try {
    if (useTsgo) {
      await writeFile(
        emitTsconfig,
        JSON.stringify({
          compilerOptions: { ...compilerOptions, ...dtsEmitCompilerOptions(emitDir) },
          include: [`${relative(DIR_ROOT, cwd)}/src/**/*`],
          exclude: DTS_EXCLUDES,
        })
      );
      emitPackageDeclarationsNative(emitTsconfig, wrapperTsconfig, emitDir);
    } else {
      emitPackageDeclarations(wrapperTsconfig, emitDir);
    }

    const input: Record<string, string> = Object.fromEntries(
      Object.entries(entryMap).map(([name, sourcePath]) => [
        name,
        join(emitDir, relative(DIR_ROOT, sourcePath)).replace(/\.tsx?$/, '.d.ts'),
      ])
    );

    const out = await rolldown({
      input,
      external: externalFn,
      plugins: [
        createTextAssetStubPlugin(),
        ...(resolver === 'hybrid' ? [createTypesFallbackResolverPlugin(externalFn)] : []),
        dts({
          cwd,
          tsconfig: wrapperTsconfig,
          dtsInput: true,
          emitDtsOnly: true,
          resolver: resolver === 'tsc' ? 'tsc' : 'oxc',
        }),
      ],
      logLevel: 'warn',
    });

    const { output } = await out.write({
      dir: join(cwd, 'dist'),
      format: 'es',
      // Name shared chunks purely by content hash: the default `[name]-[hash]`
      // inherits a base name from whichever module rolldown happens to pick,
      // which varies across runs and would make the output non-deterministic.
      chunkFileNames: 'chunk-[hash].js',
    });

    // Everything meaningful in this build is a .d.ts file; rolldown still
    // emits its runtime helper chunk as plain JS, which nothing references.
    // Only touch our own chunk namespace: the JS bundle writes real entry
    // files into the same dist directory in parallel.
    await Promise.all(
      output
        .filter((chunk) => /^chunk-[^/]+\.js$/.test(chunk.fileName))
        .map((chunk) => rm(join(cwd, 'dist', chunk.fileName), { force: true }))
    );
  } finally {
    await Promise.all([
      rm(wrapperTsconfig, { force: true }),
      rm(emitTsconfig, { force: true }),
      rm(emitDir, { recursive: true, force: true }),
    ]);
  }

  if (!process.env.CI) {
    for (const entry of dtsEntries) {
      console.log('Generated types for', picocolors.cyan(join(DIR_REL, entry)));
    }
  }
}
