import { readFile } from 'node:fs/promises';
import { isBuiltin } from 'node:module';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { parseSync, Visitor } from 'oxc-parser';
import { glob } from 'tinyglobby';

import { esMain } from '../utils/esmain.ts';

/** How a module specifier found in a built file relates to the package that imports it. */
export type SpecifierClass =
  | { kind: 'local' }
  | { kind: 'builtin' }
  | { kind: 'self' }
  | { kind: 'host'; packageName: string }
  | { kind: 'declared'; packageName: string }
  | { kind: 'missing'; packageName: string };

/** The subset of package.json fields that decide which bare imports are allowed at runtime. */
export interface PackageManifest {
  name: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/** A package imported by the built output but not declared by the manifest. */
export interface MissingRuntimeDep {
  packageName: string;
  /** Built files importing it, relative to the package directory. */
  files: string[];
}

const DIST_GLOB = 'dist/**/*.{js,mjs,cjs}';
/** The packages behind `storybook`; only they and `storybook` itself may import them at runtime. */
export const LOWER_PACKAGES = ['@storybook/core', '@storybook/ui', '@storybook/manager'];
/**
 * Always external in the build (`getExternal` in `scripts/build/utils/entry-utils.ts`) and supplied
 * by the host: the user's renderer in the preview, globals in the manager bundle.
 */
const HOST_PROVIDED_PACKAGES = ['react', 'react-dom'];

/**
 * Package name of a bare specifier, or `undefined` for relative, absolute, URL and `#imports`
 * specifiers.
 */
export function getPackageName(specifier: string): string | undefined {
  if (
    specifier.startsWith('.') ||
    specifier.startsWith('#') ||
    isAbsolute(specifier) ||
    /^[a-z][a-z0-9+.-]*:/i.test(specifier)
  ) {
    return undefined;
  }
  const [first, second] = specifier.split('/');
  return first.startsWith('@') ? `${first}/${second}` : first;
}

/** Classifies one specifier against the manifest of the package whose dist contains it. */
export function classifySpecifier(specifier: string, manifest: PackageManifest): SpecifierClass {
  if (isBuiltin(specifier)) {
    return { kind: 'builtin' };
  }
  const packageName = getPackageName(specifier);
  if (packageName === undefined) {
    return { kind: 'local' };
  }
  if (packageName === manifest.name) {
    return { kind: 'self' };
  }
  if (HOST_PROVIDED_PACKAGES.includes(packageName)) {
    return { kind: 'host', packageName };
  }
  const declared =
    manifest.dependencies?.[packageName] ??
    manifest.peerDependencies?.[packageName] ??
    manifest.optionalDependencies?.[packageName];
  return declared === undefined
    ? { kind: 'missing', packageName }
    : { kind: 'declared', packageName };
}

/**
 * Collects the specifiers of static imports and re-exports, dynamic `import()` and `require()`
 * calls with a string literal argument. A `require()` inside a `try` statement is an optional probe by
 * bundled CommonJS code and is skipped.
 */
export function collectSpecifiers(filename: string, code: string): string[] {
  const { program } = parseSync(filename, code);
  const specifiers: string[] = [];
  const addSource = (source: { type: string; value?: unknown } | null | undefined): void => {
    if (source?.type === 'Literal' && typeof source.value === 'string') {
      specifiers.push(source.value);
    }
  };
  let tryDepth = 0;
  new Visitor({
    TryStatement: () => {
      tryDepth++;
    },
    'TryStatement:exit': () => {
      tryDepth--;
    },
    ImportDeclaration: (node) => addSource(node.source),
    ExportAllDeclaration: (node) => addSource(node.source),
    ExportNamedDeclaration: (node) => addSource(node.source),
    ImportExpression: (node) => addSource(node.source),
    CallExpression: (node) => {
      // esbuild rewrites `require` in ESM output to `__require`.
      if (
        tryDepth === 0 &&
        node.callee.type === 'Identifier' &&
        (node.callee.name === 'require' || node.callee.name === '__require')
      ) {
        addSource(node.arguments[0] as { type: string; value?: unknown });
      }
    },
  }).visit(program);
  return specifiers;
}

/** Scans the built files of `packageDir` for bare imports its manifest does not declare. */
export async function findMissingRuntimeDeps(packageDir: string): Promise<MissingRuntimeDep[]> {
  const manifest: PackageManifest = JSON.parse(
    await readFile(join(packageDir, 'package.json'), 'utf8')
  );
  const files = await glob(DIST_GLOB, { cwd: packageDir, absolute: true });
  const missing = new Map<string, Set<string>>();

  for (const file of files) {
    for (const specifier of collectSpecifiers(file, await readFile(file, 'utf8'))) {
      const result = classifySpecifier(specifier, manifest);
      if (result.kind === 'missing') {
        const importers = missing.get(result.packageName) ?? new Set<string>();
        importers.add(relative(packageDir, file));
        missing.set(result.packageName, importers);
      }
    }
  }

  return [...missing]
    .map(([packageName, importers]) => ({ packageName, files: [...importers].sort() }))
    .sort((a, b) => a.packageName.localeCompare(b.packageName));
}

/**
 * Lists the built files of `packageDir` that import a lower package. Other packages reach them
 * through `storybook/*`, which keeps one copy of core per install. A package that declares
 * `@storybook/core` (frameworks, renderers and builders, for their Node side) may import it.
 */
export async function findLowerPackageImports(packageDir: string): Promise<MissingRuntimeDep[]> {
  const manifest: PackageManifest = JSON.parse(
    await readFile(join(packageDir, 'package.json'), 'utf8')
  );
  const declaresCore = classifySpecifier('@storybook/core', manifest).kind === 'declared';
  const forbidden = LOWER_PACKAGES.filter((name) => !(declaresCore && name === '@storybook/core'));
  const files = await glob(DIST_GLOB, { cwd: packageDir, absolute: true });
  const found = new Map<string, Set<string>>();
  for (const file of files) {
    for (const specifier of collectSpecifiers(file, await readFile(file, 'utf8'))) {
      const packageName = getPackageName(specifier);
      if (packageName && forbidden.includes(packageName)) {
        const importers = found.get(packageName) ?? new Set<string>();
        importers.add(relative(packageDir, file));
        found.set(packageName, importers);
      }
    }
  }
  return [...found]
    .map(([packageName, importers]) => ({ packageName, files: [...importers].sort() }))
    .sort((a, b) => a.packageName.localeCompare(b.packageName));
}

/** Prints lower-package imports in `packageDir`'s dist; returns `false` when there are any. */
export async function checkNoLowerPackageImports(packageDir: string): Promise<boolean> {
  const found = await findLowerPackageImports(packageDir);
  if (found.length === 0) {
    return true;
  }
  console.log(
    `${packageDir}: dist imports packages behind \`storybook\`; import \`storybook/*\` instead:`
  );
  for (const { packageName, files } of found) {
    console.log(`  ${packageName}  (${files.join(', ')})`);
  }
  return false;
}

/** Prints missing runtime deps for `packageDir`; returns `false` when there are any. */
export async function checkRuntimeDeps(packageDir: string): Promise<boolean> {
  const missing = await findMissingRuntimeDeps(packageDir);
  if (missing.length === 0) {
    return true;
  }
  console.log(
    `${packageDir}: dist imports packages missing from dependencies/peerDependencies/optionalDependencies:`
  );
  for (const { packageName, files } of missing) {
    console.log(`  ${packageName}  (${files.join(', ')})`);
  }
  return false;
}

if (esMain(import.meta.url)) {
  const { positionals } = parseArgs({ allowPositionals: true });
  const dirs = positionals.length > 0 ? positionals : [process.cwd()];
  let ok = true;
  for (const dir of dirs) {
    ok = (await checkRuntimeDeps(resolve(dir))) && ok;
  }
  process.exit(ok ? 0 : 1);
}
