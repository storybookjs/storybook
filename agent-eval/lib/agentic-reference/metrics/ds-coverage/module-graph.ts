// The project's module graph: which files exist, what each imports and
// exports, and how specifiers resolve between them.
//
// This is the substrate the identification layer walks. It is deliberately
// framework-agnostic — plain ESM/TypeScript module structure — so a future
// non-React implementation reuses it unchanged. Declaration *bodies* are not
// interpreted here; they are handed to the framework analyzer as AST nodes.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

import ts from 'typescript';

import { hasParseErrors, scriptKindFor } from '../sloc.ts';
import { isExcludedPath, SCRIPT_EXTENSIONS, SKIP_DIRS } from '../../tree/paths.ts';
import { packageNameOf } from './package-pattern.ts';

/** What a local name in a file is bound to. */
export type LocalBinding =
  | { type: 'import'; from: string; name: string }
  | { type: 'namespaceImport'; from: string }
  | { type: 'declaration'; node: ts.Node; name: string }
  | { type: 'destructured'; node: ts.VariableDeclaration; path: string[] };

/** What an exported name of a file resolves to. */
export type ExportBinding =
  | { type: 'local'; name: string }
  | { type: 'reexport'; from: string; name: string }
  | { type: 'namespaceReexport'; from: string }
  | { type: 'expression'; node: ts.Expression };

export interface ModuleFile {
  /** Workspace-relative path with `/` separators. */
  path: string;
  sourceFile: ts.SourceFile;
  locals: Map<string, LocalBinding>;
  exports: Map<string, ExportBinding>;
  /** Specifiers of `export * from` declarations, in source order. */
  starReexports: string[];
  /** Module-scope `X.Y = Z` assignments (compound components), keyed `X.Y`. */
  propertyAssignments: Map<string, ts.Expression>;
}

export type SpecifierResolution =
  | { type: 'file'; path: string }
  | { type: 'package'; specifier: string }
  | { type: 'missing'; specifier: string };

export interface ModuleGraph {
  root: string;
  files: Map<string, ModuleFile>;
  parseFailures: string[];
  readFailures: string[];
  resolveSpecifier(fromPath: string, specifier: string): SpecifierResolution;
}

// The census measures the app's UI, so files that never render in the app —
// tests, stories, mocks — are left out entirely (they neither contribute JSX
// nodes nor participate in the module graph).
const NOT_APP_SOURCE =
  /(?:\.(?:test|spec|stories)\.[^/]+$|(?:^|\/)(?:__tests__|__mocks__|\.storybook)\/)/;

function isCensusFile(path: string): boolean {
  return SCRIPT_EXTENSIONS.test(path) && !isExcludedPath(path) && !NOT_APP_SOURCE.test(path);
}

function collectFiles(root: string): string[] {
  const found: string[] = [];
  if (!existsSync(root)) return found;

  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(join(current, entry.name));
        continue;
      }
      const path = relative(root, join(current, entry.name)).split(sep).join('/');
      if (isCensusFile(path)) found.push(path);
    }
  };

  walk(root);
  return found.sort();
}

function isTypeOnlyImport(declaration: ts.ImportDeclaration): boolean {
  return declaration.importClause?.isTypeOnly === true;
}

function recordImports(file: ModuleFile, declaration: ts.ImportDeclaration): void {
  const clause = declaration.importClause;
  if (!clause || isTypeOnlyImport(declaration)) return;
  if (!ts.isStringLiteral(declaration.moduleSpecifier)) return;
  const from = declaration.moduleSpecifier.text;

  if (clause.name) {
    file.locals.set(clause.name.text, { type: 'import', from, name: 'default' });
  }
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamespaceImport(bindings)) {
    file.locals.set(bindings.name.text, { type: 'namespaceImport', from });
  }
  if (bindings && ts.isNamedImports(bindings)) {
    for (const specifier of bindings.elements) {
      if (specifier.isTypeOnly) continue;
      file.locals.set(specifier.name.text, {
        type: 'import',
        from,
        name: specifier.propertyName?.text ?? specifier.name.text,
      });
    }
  }
}

function recordExportDeclaration(file: ModuleFile, declaration: ts.ExportDeclaration): void {
  if (declaration.isTypeOnly) return;
  const from =
    declaration.moduleSpecifier && ts.isStringLiteral(declaration.moduleSpecifier)
      ? declaration.moduleSpecifier.text
      : null;

  const clause = declaration.exportClause;
  if (!clause) {
    // `export * from './x'`
    if (from !== null) file.starReexports.push(from);
    return;
  }
  if (ts.isNamespaceExport(clause)) {
    // `export * as NS from './x'`
    if (from !== null) file.exports.set(clause.name.text, { type: 'namespaceReexport', from });
    return;
  }
  for (const specifier of clause.elements) {
    if (specifier.isTypeOnly) continue;
    const exported = specifier.name.text;
    const source = specifier.propertyName?.text ?? exported;
    file.exports.set(
      exported,
      from === null ? { type: 'local', name: source } : { type: 'reexport', from, name: source }
    );
  }
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  const modifiers = (node as { modifiers?: readonly ts.Node[] }).modifiers;
  return modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

/** One name a binding introduces, and where in the bound value it came from. */
export interface BoundName {
  name: string;
  /**
   * Property path from the bound value to this name: `[]` for a plain
   * identifier, `['Root']` for `{ Root }`, `['Checkbox', 'Root']` for
   * `{ Checkbox: { Root } }`. `null` when the pattern binds the name but
   * cannot say where it came from — see {@link patternStep}.
   */
  path: string[] | null;
}

/** The property an object-pattern element reads, or null when unattributable. */
function patternStep(element: ts.BindingElement, pattern: ts.BindingPattern): string | null {
  // A rest element gathers whatever is left, an array position is not a
  // property name, and a default value means the bound value may not be the
  // property at all: none of the three names one attributable source.
  if (element.dotDotDotToken !== undefined) return null;
  if (ts.isArrayBindingPattern(pattern)) return null;
  if (element.initializer !== undefined) return null;

  const property = element.propertyName;
  // No `propertyName` is the shorthand `{ Root }`, whose name is always an
  // identifier — `{ { a } }` is not spellable.
  if (property === undefined) return ts.isIdentifier(element.name) ? element.name.text : null;
  if (ts.isIdentifier(property) || ts.isStringLiteral(property) || ts.isNumericLiteral(property)) {
    return property.text;
  }
  // A computed key names a property only the runtime knows.
  return null;
}

/**
 * Every name a binding introduces. This lets us track that a
 * destructured name was part of a specific path. If upper parts
 * of the path are attributable to the DS or to a local export,
 * we can attribute the destructured name to the same origin.
 */
export function boundNames(binding: ts.BindingName): BoundName[] {
  if (ts.isIdentifier(binding)) {
    return [{ name: binding.text, path: [] }];
  }

  const found: BoundName[] = [];
  for (const element of binding.elements) {
    // Array holes (`const [, second] = xs`) bind nothing.
    if (!ts.isBindingElement(element)) {
      continue;
    }

    const step = patternStep(element, binding);
    for (const bound of boundNames(element.name)) {
      found.push({
        name: bound.name,
        path: step === null || bound.path === null ? null : [step, ...bound.path],
      });
    }
  }
  return found;
}

function recordDeclaration(file: ModuleFile, node: ts.Node): void {
  if (ts.isVariableStatement(node)) {
    const exported = hasModifier(node, ts.SyntaxKind.ExportKeyword);
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) {
        const name = declaration.name.text;
        file.locals.set(name, { type: 'declaration', node: declaration, name });
        if (exported) {
          file.exports.set(name, { type: 'local', name });
        }
        continue;
      }
      // For destructuring patterns, either we know the right-hand side can
      // have an origin attributed, and we can track it, or we don't, and we
      // have to not attribute the destructured names.
      for (const { name, path } of boundNames(declaration.name)) {
        if (exported) {
          file.exports.set(name, { type: 'local', name });
        }
        if (path === null) {
          continue;
        }
        file.locals.set(name, { type: 'destructured', node: declaration, path });
      }
    }
    return;
  }

  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
    // An anonymous `export default function () {}` still needs a local slot
    // for the export table to point at; `default` cannot collide, since it is
    // a keyword no real binding can use.
    const name = node.name?.text ?? 'default';
    file.locals.set(name, { type: 'declaration', node, name });
    if (hasModifier(node, ts.SyntaxKind.DefaultKeyword)) {
      file.exports.set('default', { type: 'local', name });
    } else if (hasModifier(node, ts.SyntaxKind.ExportKeyword)) {
      file.exports.set(name, { type: 'local', name });
    }
    return;
  }

  if (ts.isExportAssignment(node) && !node.isExportEquals) {
    // `export default <expr>`: identifiers follow the local binding so the
    // graph stays framework-agnostic; anything else is analyzed downstream.
    file.exports.set(
      'default',
      ts.isIdentifier(node.expression)
        ? { type: 'local', name: node.expression.text }
        : { type: 'expression', node: node.expression }
    );
    return;
  }

  if (
    ts.isExpressionStatement(node) &&
    ts.isBinaryExpression(node.expression) &&
    node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isPropertyAccessExpression(node.expression.left) &&
    ts.isIdentifier(node.expression.left.expression) &&
    ts.isIdentifier(node.expression.left.name)
  ) {
    // `Card.Header = Header` — the compound-component pattern.
    const key = `${node.expression.left.expression.text}.${node.expression.left.name.text}`;
    file.propertyAssignments.set(key, node.expression.right);
  }
}

function parseModuleFile(root: string, path: string): ModuleFile | 'unparseable' | 'unreadable' {
  let source: string;
  try {
    source = readFileSync(join(root, path), 'utf8');
  } catch {
    return 'unreadable';
  }
  if (hasParseErrors(path, source)) {
    return 'unparseable';
  }

  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKindFor(path)
  );

  const file: ModuleFile = {
    path,
    sourceFile,
    locals: new Map(),
    exports: new Map(),
    starReexports: [],
    propertyAssignments: new Map(),
  };

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) recordImports(file, statement);
    else if (ts.isExportDeclaration(statement)) recordExportDeclaration(file, statement);
    else recordDeclaration(file, statement);
  }

  return file;
}

// Vite's default resolve.extensions order (minus .mts/.cts).
// When we wanna handle e.g. Vue or Svelte, we'll need to switch to Vite transforms
// rather than merely add extensions. This only works for syntaxes TypeScript can parse.
const EXTENSIONS = ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.cjs'];

/** ESM-style specifiers name the *emitted* file; map them back to sources. */
const EMITTED_TO_SOURCE: Record<string, string[]> = {
  '.js': ['.ts', '.tsx'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
};

function candidatePaths(resolved: string): string[] {
  const candidates = [resolved, ...EXTENSIONS.map((extension) => resolved + extension)];
  const extension = posix.extname(resolved);
  for (const sourceExtension of EMITTED_TO_SOURCE[extension] ?? []) {
    candidates.push(resolved.slice(0, -extension.length) + sourceExtension);
  }
  for (const indexExtension of EXTENSIONS) {
    candidates.push(posix.join(resolved, `index${indexExtension}`));
  }
  return candidates;
}

/**
 * A mapping key split around its `*` glob pattern.
 */
interface SpecifierPattern {
  prefix: string;
  suffix: string;
  targets: string[];
}

function splitPattern(pattern: string, targets: string[]): SpecifierPattern | null {
  const [prefix, suffix, excess] = pattern.split('*');
  // More than one `*` is invalid. Tested against `undefined` rather than for
  // truthiness because a *trailing* second star (`lib/*.svg*`) splits to an
  // empty third part, which would otherwise read as one well-formed wildcard.
  if (excess !== undefined) {
    return null;
  }

  return { prefix: prefix ?? pattern, suffix: suffix ?? '', targets };
}

/** The patterns whose key matches `specifier`, in declaration order. */
function matchPatterns(patterns: SpecifierPattern[], specifier: string): SpecifierPattern[] {
  return patterns
    .filter((pattern) => specifier.startsWith(pattern.prefix))
    .filter((pattern) => pattern.suffix === '' || specifier.endsWith(pattern.suffix));
}

/** Every target `specifier` expands to, in declaration order across all patterns. */
function substitute(patterns: SpecifierPattern[], specifier: string): string[] {
  return matchPatterns(patterns, specifier).flatMap((pattern) => {
    const captured = specifier.slice(
      pattern.prefix.length,
      pattern.suffix === '' ? undefined : -pattern.suffix.length
    );
    return pattern.targets.map((target) => target.replace('*', captured));
  });
}

/**
 * The tree's tsconfig path aliases (`@/*` → `src/*`), read from the root
 * tsconfig.json. `extends` chains are not followed.
 */
function readPathAliases(root: string): { aliases: SpecifierPattern[]; baseUrl: string | null } {
  const configPath = join(root, 'tsconfig.json');
  if (!existsSync(configPath)) {
    return { aliases: [], baseUrl: null };
  }

  const { config } = ts.readConfigFile(configPath, (path) => readFileSync(path, 'utf8')) as {
    config?: { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } };
  };
  const options = config?.compilerOptions;
  const baseUrl = typeof options?.baseUrl === 'string' ? posix.normalize(options.baseUrl) : null;
  const aliases: SpecifierPattern[] = [];
  for (const [pattern, targets] of Object.entries(options?.paths ?? {})) {
    if (!Array.isArray(targets)) {
      continue;
    }
    const split = splitPattern(
      pattern,
      targets.filter((target): target is string => typeof target === 'string')
    );
    if (split) {
      aliases.push(split);
    }
  }
  return { aliases, baseUrl };
}

/**
 * Whether a specifier *cannot* be an npm package name.
 *
 * `packageNameOf` decomposes a string already known to be a bare specifier, so
 * asking it first and validating only what it returns would assume the answer:
 * it reduces `~/components/Button` to `~`, and npm considers `~` a perfectly
 * legal name even though it rejects `~/components`. Hence the alphanumeric
 * requirement below — it is what holds the discarded remainder to account,
 * without needing to know that `~/` in particular is a root-alias convention.
 */
function isInvalidPackageName(specifier: string): boolean {
  const name = packageNameOf(specifier);
  if (name === '' || name !== name.trim()) {
    return true;
  }

  if (name.startsWith('.') || name.startsWith('_')) {
    return true;
  }

  // A name segment made only of punctuation (`~`, `-`, `.`) is a sigil, and a
  // sigil followed by a path is how every bundler spells "project root". Real
  // package names all carry at least one alphanumeric.
  if (!/[a-z0-9]/i.test(name)) {
    return true;
  }

  if (name.startsWith('@')) {
    const [scope, unscoped] = name.split('/');
    return (scope?.length ?? 0) < 2 || (unscoped?.length ?? 0) === 0;
  }

  return false;
}

/** Targets of one `imports` entry: a string, a fallback array, or conditions. */
function flattenImportTargets(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenImportTargets(entry));
  }
  // Conditions (`node`, `browser`, `default`, …) cannot be evaluated
  // statically, so every branch is kept in declaration order and the caller's
  // file-before-package preference picks.
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap((entry) => flattenImportTargets(entry));
  }
  return [];
}

interface Manifest {
  /** Every bare name the tree declares as a dependency. */
  dependencies: Set<string>;
  /** `imports` entries, keyed by their `#`-prefixed pattern. */
  subpathImports: SpecifierPattern[];
}

function readManifest(root: string): Manifest {
  const dependencies = new Set<string>();
  const subpathImports: SpecifierPattern[] = [];
  const manifestPath = join(root, 'package.json');
  if (!existsSync(manifestPath)) {
    return { dependencies, subpathImports };
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  } catch {
    return { dependencies, subpathImports };
  }

  for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
    const entry = manifest[field];
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    for (const name of Object.keys(entry)) {
      dependencies.add(name);
    }
  }

  const imports = manifest.imports;
  if (typeof imports === 'object' && imports !== null && !Array.isArray(imports)) {
    for (const [pattern, value] of Object.entries(imports)) {
      const split = splitPattern(pattern, flattenImportTargets(value));
      if (split) {
        subpathImports.push(split);
      }
    }
  }

  return { dependencies, subpathImports };
}

/**
 * Checks if a file exists in a previously computed file tree.
 */
function fileAt(files: Map<string, ModuleFile>, resolved: string): SpecifierResolution | null {
  for (const candidate of candidatePaths(posix.normalize(resolved))) {
    if (files.has(candidate)) {
      return { type: 'file', path: candidate };
    }
  }
  return null;
}

/**
 * Checks if a specifier matches an `import` field in a package.json.
 * Unlike tsconfig `paths`, a target starting with `./` is a path within
 * a package, and anything else is a package specifier.
 */
function resolveSubpathImport(
  files: Map<string, ModuleFile>,
  subpathImports: SpecifierPattern[],
  specifier: string
): SpecifierResolution | null {
  const substitutions = substitute(subpathImports, specifier);

  for (const substituted of substitutions.filter((s) => s.startsWith('.'))) {
    const hit = fileAt(files, substituted);
    if (hit) {
      return hit;
    }
  }

  const packageMatch = substitutions.find((s) => !s.startsWith('.') && !isInvalidPackageName(s));
  return packageMatch ? { type: 'package', specifier: packageMatch } : null;
}

/**
 * Checks whether a tsconfig alias target names a dependency package. Removes
 * node_modules prefix and normalizes the package name before comparing.
 */
function packageTarget(target: string, dependencies: Set<string>): string | null {
  const normalized = posix.normalize(target);
  if (normalized.startsWith(NODE_MODULES_PREFIX)) {
    const specifier = normalized.slice(NODE_MODULES_PREFIX.length);
    return isInvalidPackageName(specifier) ? null : specifier;
  }
  return dependencies.has(packageNameOf(normalized)) ? normalized : null;
}

/**
 * Resolve a bare specifier against tsconfig `paths` aliases, the manifest's
 * `dependencies`, and the `baseUrl`. Follows TS logic.
 */
function resolveAliased(
  files: Map<string, ModuleFile>,
  aliases: SpecifierPattern[],
  dependencies: Set<string>,
  baseUrl: string | null,
  specifier: string
): SpecifierResolution | null {
  const substitutions = substitute(aliases, specifier);

  // First see if alias resolves to a local file without baseUrl substitutions.
  for (const substituted of substitutions) {
    const hit = fileAt(files, posix.join(baseUrl ?? '.', substituted));
    if (hit) {
      return hit;
    }
  }

  // Next, package matches. A package target is not baseUrl-relative, and
  // joining `baseUrl` would turn it `@scope/name` into `src/@scope/name`.
  for (const substituted of substitutions) {
    const packageSpecifier = packageTarget(substituted, dependencies);
    if (packageSpecifier !== null) {
      return { type: 'package', specifier: packageSpecifier };
    }
  }

  // Finally, check for matches with the `baseUrl` prefix.
  if (baseUrl !== null) {
    const hit = fileAt(files, posix.join(baseUrl, specifier));
    if (hit) {
      return hit;
    }
  }

  // Nothing resolved. An alias whose prefix actually names something (`~/`,
  // `lib/`) is the tree declaring that prefix local, so a specifier under it
  // that maps nowhere is a broken local import rather than a package. A
  // catch-all (`"*"`, prefix `''`) matches every specifier and therefore
  // declares nothing — `react` must still reach the package branch.
  if (matchPatterns(aliases, specifier).some((pattern) => pattern.prefix !== '')) {
    return { type: 'missing', specifier };
  }
  return null;
}

const NODE_MODULES_PREFIX = 'node_modules/';

/** Parse every source file under `root` and index its module structure. */
export function buildModuleGraph(root: string): ModuleGraph {
  const files = new Map<string, ModuleFile>();
  const parseFailures: string[] = [];
  const readFailures: string[] = [];

  for (const path of collectFiles(root)) {
    const file = parseModuleFile(root, path);
    if (file === 'unparseable') {
      parseFailures.push(path);
      continue;
    }
    if (file === 'unreadable') {
      readFailures.push(path);
      continue;
    }
    files.set(path, file);
  }

  const { aliases, baseUrl } = readPathAliases(root);
  const { dependencies, subpathImports } = readManifest(root);

  const resolveSpecifier = (fromPath: string, specifier: string): SpecifierResolution => {
    // First resolve relative path imports, matching tsc behavior.
    if (specifier.startsWith('.')) {
      return (
        fileAt(files, posix.join(posix.dirname(fromPath), specifier)) ?? {
          type: 'missing',
          specifier,
        }
      );
    }

    // `#` is Node's subpath-import prefix and can mean nothing else, so the
    // `imports` field is the only thing that can resolve it.
    if (specifier.startsWith('#')) {
      return (
        resolveSubpathImport(files, subpathImports, specifier) ?? { type: 'missing', specifier }
      );
    }

    // Then check for aliases.
    const aliased = resolveAliased(files, aliases, dependencies, baseUrl, specifier);
    if (aliased) {
      return aliased;
    }

    // Strip out non-found but invalid names like `@/` or `/*`.
    if (isInvalidPackageName(specifier)) {
      return { type: 'missing', specifier };
    }

    return { type: 'package', specifier };
  };

  return { root, files, parseFailures, readFailures, resolveSpecifier };
}
