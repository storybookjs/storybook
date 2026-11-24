import { parseModule } from 'storybook/internal/csf-tools';

import { dirname, resolve } from 'pathe';

import { cachedReadTextFileSync } from './utils.ts';

const parsedEntries = new Map<
  string,
  { content: string; program: ReturnType<typeof parseModule>['program'] }
>();

function entryTarget(entry: unknown): string | undefined {
  if (typeof entry === 'string') {
    return entry;
  }
  if (Array.isArray(entry)) {
    return entry.map(entryTarget).find(Boolean);
  }
  if (entry && typeof entry === 'object') {
    const conditions = entry as Record<string, unknown>;
    return entryTarget(conditions.types ?? conditions.import ?? conditions.default);
  }
  return undefined;
}

function hasRuntimeTarget(entry: unknown): boolean {
  if (typeof entry === 'string') {
    return entry.startsWith('./') && !/\.d\.[cm]?ts$/.test(entry);
  }
  if (Array.isArray(entry)) {
    return entry.some(hasRuntimeTarget);
  }
  if (entry && typeof entry === 'object') {
    return Object.entries(entry).some(
      ([condition, target]) => condition !== 'types' && hasRuntimeTarget(target)
    );
  }
  return false;
}

function exportsName(file: string, name: string, visited = new Set<string>()): boolean {
  if (visited.has(file)) {
    return false;
  }
  visited.add(file);

  try {
    const content = cachedReadTextFileSync(file);
    let cached = parsedEntries.get(file);
    if (!cached || cached.content !== content) {
      cached = { content, program: parseModule(content, file).program };
      parsedEntries.set(file, cached);
    }
    const { program } = cached;
    for (const statement of program.body) {
      if (statement.type === 'ExportNamedDeclaration') {
        if (
          statement.exportKind !== 'type' &&
          statement.specifiers.some(
            (specifier) =>
              specifier.exportKind !== 'type' &&
              (specifier.exported.type === 'Identifier'
                ? specifier.exported.name
                : specifier.exported.value) === name
          )
        ) {
          return true;
        }
        const declaration = statement.declaration;
        if (
          declaration &&
          ((declaration.type === 'VariableDeclaration' &&
            declaration.declarations.some(
              ({ id }) => id.type === 'Identifier' && id.name === name
            )) ||
            ((declaration.type === 'FunctionDeclaration' ||
              declaration.type === 'TSDeclareFunction' ||
              declaration.type === 'ClassDeclaration' ||
              declaration.type === 'TSEnumDeclaration') &&
              declaration.id?.name === name))
        ) {
          return true;
        }
      }
      if (
        statement.type === 'ExportAllDeclaration' &&
        statement.exportKind !== 'type' &&
        !statement.exported &&
        statement.source.value.startsWith('.')
      ) {
        const target = resolve(dirname(file), statement.source.value);
        const base = target.replace(/\.(?:mjs|cjs|js)$/, '');
        if (
          [
            target,
            `${base}.d.ts`,
            `${base}.ts`,
            `${base}.tsx`,
            `${base}/index.d.ts`,
            `${base}/index.ts`,
          ].some((candidate) => exportsName(candidate, name, visited))
        ) {
          return true;
        }
      }
    }
  } catch {
    // Missing or unparseable entry points cannot establish a public export.
  }
  return false;
}

export function getPackageExport(
  packageFile: string,
  packageName: string,
  exports: unknown,
  exportName: string
): string | undefined {
  const entries: [string, unknown][] =
    exports &&
    typeof exports === 'object' &&
    !Array.isArray(exports) &&
    Object.keys(exports).some((key) => key.startsWith('.'))
      ? Object.entries(exports)
      : [['.', exports]];

  // Prefer the root when the same name is exposed by more than one entry.
  entries.sort(([a], [b]) => (a === '.' ? -1 : b === '.' ? 1 : 0));
  for (const [subpath, entry] of entries) {
    if ((subpath !== '.' && !subpath.startsWith('./')) || subpath.includes('*')) {
      continue;
    }
    if (!hasRuntimeTarget(entry)) {
      continue;
    }
    const target = entryTarget(entry);
    if (!target?.startsWith('./')) {
      continue;
    }
    const packageDir = dirname(packageFile);
    const targetFile = resolve(packageDir, target);
    let candidates = [targetFile];
    try {
      cachedReadTextFileSync(targetFile);
    } catch {
      // Many workspace packages have not been built yet. Their dist entry points commonly mirror
      // source entry points; use those only when the declared entry itself is absent.
      if (target.startsWith('./dist/')) {
        const source = resolve(
          packageDir,
          target.replace(/^\.\/dist\//, 'src/').replace(/\.d\.[cm]?ts$|\.[cm]?js$/, '')
        );
        candidates = [`${source}.ts`, `${source}.tsx`, `${source}.js`, `${source}.jsx`];
      }
    }
    if (candidates.some((candidate) => exportsName(candidate, exportName))) {
      return `${packageName}${subpath === '.' ? '' : subpath.slice(1)}`;
    }
  }
  return undefined;
}
