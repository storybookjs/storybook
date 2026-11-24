import path from 'pathe';

import type { ComponentRef } from './getComponentImports.ts';
import { cachedFindUp, cachedReadTextFileSync, cachedResolveImport } from './utils.ts';

type PackageJson = Record<string, unknown> & { name: string };

interface NearestPackage {
  root: string;
  pkg: PackageJson;
}

const ROOT_ENTRY_FIELDS = ['main', 'module', 'types', 'typings', 'browser'];

// The file text is cached by `mtimeMs`; this keeps its parse while the text stays the same.
const parsedPackages = new Map<string, { text: string; pkg: PackageJson | undefined }>();

function parsePackage(pkgPath: string): PackageJson | undefined {
  const text = cachedReadTextFileSync(pkgPath);
  const previous = parsedPackages.get(pkgPath);
  if (previous?.text === text) {
    return previous.pkg;
  }
  let pkg: PackageJson | undefined;
  try {
    const parsed = JSON.parse(text);
    pkg =
      typeof parsed === 'object' && parsed && typeof parsed.name === 'string' ? parsed : undefined;
  } catch {
    pkg = undefined;
  }
  parsedPackages.set(pkgPath, { text, pkg });
  return pkg;
}

// The package.json that owns `fromPath`, when it has a name.
function readNearestPackage(fromPath: string): NearestPackage | undefined {
  const pkgPath = cachedFindUp('package.json', { cwd: path.dirname(fromPath) });
  if (!pkgPath) {
    return undefined;
  }
  try {
    const pkg = parsePackage(pkgPath);
    return pkg ? { root: path.dirname(pkgPath), pkg } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The `exports` map of a package that lists subpaths but no root (no `"."`, or `"."` set to
 * `null`). Consumers cannot import such a package by its bare name.
 */
function getSubpathOnlyExports(pkg: PackageJson): Record<string, unknown> | undefined {
  const { exports } = pkg;
  if (typeof exports !== 'object' || exports === null || Array.isArray(exports)) {
    return undefined;
  }
  const exportsMap = exports as Record<string, unknown>;
  // An object lists either subpaths (`"."`, `"./button"`) or conditions (`"import"`, `"default"`).
  // Conditions describe the root.
  if (!Object.keys(exportsMap).some((key) => key.startsWith('.'))) {
    return undefined;
  }
  return exportsMap['.'] === undefined || exportsMap['.'] === null ? exportsMap : undefined;
}

// Whether the bare package name resolves: `exports` decides when present, the main fields otherwise.
function hasRootEntry(pkg: PackageJson) {
  const { exports } = pkg;
  if (exports === undefined) {
    return ROOT_ENTRY_FIELDS.some((field) => field in pkg);
  }
  if (exports === null) {
    return false;
  }
  return getSubpathOnlyExports(pkg) === undefined;
}

/**
 * The bare name that consumers import the package owning `fromPath` by. A package whose `exports`
 * has no root entry has none, and neither has an app's own package (private, with no root entry):
 * their components keep the import the story wrote.
 */
export function getImportablePackageName(fromPath: string): string | undefined {
  const nearest = readNearestPackage(fromPath);
  if (!nearest || getSubpathOnlyExports(nearest.pkg)) {
    return undefined;
  }
  return nearest.pkg.private !== true || hasRootEntry(nearest.pkg) ? nearest.pkg.name : undefined;
}

function listTargets(target: unknown): string[] {
  if (typeof target === 'string') {
    return [target];
  }
  if (Array.isArray(target)) {
    return target.flatMap(listTargets);
  }
  if (typeof target === 'object' && target !== null) {
    return Object.values(target).flatMap(listTargets);
  }
  return [];
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The subpath `key` gives for `file` when `target` points at it, such as `./button` for
// `"./*": "./src/*.tsx"` and `src/button.tsx`. Every `*` of a target stands for the same text.
function matchTarget(key: string, target: string, root: string, file: string) {
  if (!key.includes('*')) {
    return path.resolve(root, target) === file ? key : undefined;
  }
  const relativeFile = `./${path.relative(root, file)}`;
  const [first, ...rest] = target.split('*').map(escapeRegExp);
  const pattern = new RegExp(`^${first}(.+)${rest.join('\\1')}$`);
  const patternMatch = pattern.exec(relativeFile)?.[1];
  return patternMatch === undefined ? undefined : key.replace('*', patternMatch);
}

function resolvesTo(id: string, root: string, file: string) {
  try {
    return path.resolve(cachedResolveImport(id, { basedir: root })) === file;
  } catch {
    return false;
  }
}

/**
 * The package import of `file` through its package's `exports`, such as `@acme/ui/button`. The
 * reverse lookup proposes each subpath whose target can point at `file`, exact keys first, and a
 * proposal only counts when the module resolver resolves it back to `file`. So excluded subpaths,
 * `require`-only targets and invalid targets are skipped the way the resolver skips them. Both
 * paths are normalized, so a Windows path works too.
 */
export function findExportSubpathImport(
  packageName: string,
  exportsMap: Record<string, unknown>,
  root: string,
  file: string
): string | undefined {
  const normalizedRoot = path.resolve(root);
  const normalizedFile = path.resolve(file);
  const entries = Object.entries(exportsMap).sort(
    ([a], [b]) => Number(a.includes('*')) - Number(b.includes('*'))
  );
  for (const [key, target] of entries) {
    for (const candidate of listTargets(target)) {
      const subpath = matchTarget(key, candidate, normalizedRoot, normalizedFile);
      if (subpath === undefined) {
        continue;
      }
      const id = `${packageName}${subpath.slice(1)}`;
      if (resolvesTo(id, normalizedRoot, normalizedFile)) {
        return id;
      }
    }
  }
  return undefined;
}

// The package import of a component file when its package exports only subpaths and one of them
// resolves to the file.
function getExportSubpathImport(componentPath: string) {
  const nearest = readNearestPackage(componentPath);
  const exportsMap = nearest && getSubpathOnlyExports(nearest.pkg);
  return nearest && exportsMap
    ? findExportSubpathImport(nearest.pkg.name, exportsMap, nearest.root, componentPath)
    : undefined;
}

/**
 * A package that exports only subpaths cannot be imported by its bare name. Each component its
 * `exports` reaches imports from the subpath that resolves to its file instead, keeping the import
 * form (named, default or namespace). An `@import` tag still wins, and a component no subpath
 * reaches keeps the import it had.
 */
export function withExportSubpaths(refs: ComponentRef[]): ComponentRef[] {
  return refs.map((ref) => {
    if (ref.importOverride || ref.isPackage || !ref.path) {
      return ref;
    }
    const importId = getExportSubpathImport(ref.path);
    return importId ? { ...ref, importId, isPackage: true } : ref;
  });
}
