import { readFile, rm, writeFile } from 'node:fs/promises';
import { sep } from 'node:path';

import { basename, dirname, join, relative } from 'pathe';
import picocolors from 'picocolors';
import type { Plugin } from 'rolldown';
import { rolldown } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';
import ts from 'typescript';

import type { BuildEntries } from './entry-utils';
import { getExternal } from './entry-utils';

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

  // rolldown-plugin-dts derives rootDir from path.dirname(tsconfig).
  // When rootDir is the package dir, tsgo emits stray .d.ts files next to
  // source files for cross-package imports that fall outside rootDir.
  // Fix: create a temporary tsconfig at the repo root so rootDir covers
  // the entire monorepo. Use a per-package filename to avoid races when
  // NX compiles multiple packages in parallel.
  const wrapperTsconfig = join(DIR_ROOT, `tsconfig.dts-tmp-${basename(cwd)}.json`);
  const packageTsconfig = join(cwd, 'tsconfig.json');

  const useTsgo = options?.tsgo ?? true;

  if (useTsgo) {
    // tsgo removed support for `baseUrl`. Resolve the tsconfig chain,
    // strip `baseUrl`, and write a flat config so tsgo doesn't error.
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
  } else {
    await writeFile(
      wrapperTsconfig,
      JSON.stringify({
        extends: `./${relative(DIR_ROOT, packageTsconfig)}`,
        exclude: DTS_EXCLUDES,
      })
    );
  }

  const resolver = options?.resolver ?? 'hybrid';

  try {
    const out = await rolldown({
      input: entryMap,
      external: externalFn,
      plugins: [
        ...(resolver === 'hybrid' ? [createTypesFallbackResolverPlugin(externalFn)] : []),
        dts({
          cwd,
          tsconfig: wrapperTsconfig,
          tsgo: useTsgo,
          emitDtsOnly: true,
          resolver: resolver === 'tsc' ? 'tsc' : 'oxc',
        }),
      ],
      logLevel: 'warn',
    });

    await out.write({ dir: join(cwd, 'dist'), format: 'es' });
  } finally {
    await rm(wrapperTsconfig, { force: true });
  }

  if (!process.env.CI) {
    for (const entry of dtsEntries) {
      console.log('Generated types for', picocolors.cyan(join(DIR_REL, entry)));
    }
  }
}
