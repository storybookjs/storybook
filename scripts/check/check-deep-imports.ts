import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { glob } from 'tinyglobby';

import type { BuildEntries } from '../build/utils/entry-utils.ts';
import { esMain } from '../utils/esmain.ts';

/** A deep import of a lower package that none of that package's entries builds. */
export interface UnbuiltDeepImport {
  specifier: string;
  /** Source files importing it, relative to the package directory. */
  files: string[];
}

const CODE_DIRECTORY = fileURLToPath(new URL('../../code/', import.meta.url));
/** Directory, relative to `code/`, of each package whose deep entries other packages import. */
const DEEP_ENTRY_PACKAGES: Record<string, string> = {
  '@storybook/core': 'core',
  '@storybook/ui': 'lib/ui',
  '@storybook/manager': 'lib/manager',
};
const SOURCE_GLOB = 'src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}';
const DEEP_SPECIFIER = /['"`](@storybook\/(?:core|ui|manager)\/internal\/deep\/[^'"`]+)['"`]/g;

/**
 * Deep specifiers in `code` that no entry builds. It matches string literals rather than imports, so
 * `vi.mock()` paths and type-only `import()` types count too.
 */
export function findUnbuiltDeepSpecifiers(code: string, builtSpecifiers: Set<string>): string[] {
  return [...code.matchAll(DEEP_SPECIFIER)]
    .map(([, specifier]) => specifier)
    .filter((specifier) => !builtSpecifiers.has(specifier));
}

/** Every `<package>/internal/deep/...` specifier the build configs of the lower packages build. */
export async function getBuiltDeepSpecifiers(): Promise<Set<string>> {
  const specifiers = new Set<string>();
  for (const [name, dir] of Object.entries(DEEP_ENTRY_PACKAGES)) {
    const { default: config }: { default: BuildEntries } = await import(
      pathToFileURL(join(CODE_DIRECTORY, dir, 'build-config.ts')).href
    );
    for (const entry of Object.values(config.entries).flat()) {
      for (const key of entry?.exportEntries ?? []) {
        if (key.startsWith('./internal/deep/')) {
          specifiers.add(`${name}${key.slice(1)}`);
        }
      }
    }
  }
  return specifiers;
}

/**
 * Lists the deep imports in `packageDir`'s source that no entry builds. Core exports its deep
 * entries through a subpath pattern, so such an import resolves to source in the repo but has no
 * built file in the published package.
 */
export async function findUnbuiltDeepImports(
  packageDir: string,
  builtSpecifiers?: Set<string>
): Promise<UnbuiltDeepImport[]> {
  const built = builtSpecifiers ?? (await getBuiltDeepSpecifiers());
  const files = await glob(SOURCE_GLOB, {
    cwd: packageDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**'],
  });
  const found = new Map<string, Set<string>>();
  for (const file of files) {
    for (const specifier of findUnbuiltDeepSpecifiers(await readFile(file, 'utf8'), built)) {
      const importers = found.get(specifier) ?? new Set<string>();
      importers.add(relative(packageDir, file));
      found.set(specifier, importers);
    }
  }
  return [...found]
    .map(([specifier, importers]) => ({ specifier, files: [...importers].sort() }))
    .sort((a, b) => a.specifier.localeCompare(b.specifier));
}

/** Prints unbuilt deep imports in `packageDir`; returns `false` when there are any. */
export async function checkDeepImports(packageDir: string): Promise<boolean> {
  const found = await findUnbuiltDeepImports(packageDir);
  if (found.length === 0) {
    return true;
  }
  console.log(
    `${packageDir}: source imports deep paths that no build entry builds; add the entry to the owning package's build-config.ts, or import a relative path from a test:`
  );
  for (const { specifier, files } of found) {
    console.log(`  ${specifier}  (${files.join(', ')})`);
  }
  return false;
}

if (esMain(import.meta.url)) {
  const { positionals } = parseArgs({ allowPositionals: true });
  const dirs = positionals.length > 0 ? positionals : [process.cwd()];
  let ok = true;
  for (const dir of dirs) {
    ok = (await checkDeepImports(resolve(dir))) && ok;
  }
  process.exit(ok ? 0 : 1);
}
