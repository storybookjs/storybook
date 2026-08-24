import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const agentEvalRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const wrapperAppRoot = join(agentEvalRoot, 'app');
const playgroundRoot = dirname(require.resolve('@vercel/agent-eval-playground/package.json'));
const playgroundAppRoot = join(playgroundRoot, 'app');
// Keep this in sync with next.config.ts and tsconfig.playground.json.
const PLAYGROUND_ALIAS_PREFIX = '@/app';

const ROUTE_ENTRY_FILES = new Set([
  'default.tsx',
  'error.tsx',
  'global-error.tsx',
  'layout.tsx',
  'loading.tsx',
  'not-found.tsx',
  'page.tsx',
  'route.ts',
  'template.tsx',
]);

function collectRouteEntries(root, dir = root) {
  const routes = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      routes.push(...collectRouteEntries(root, entryPath));
      continue;
    }

    if (entry.isFile() && ROUTE_ENTRY_FILES.has(entry.name)) {
      routes.push(relative(root, entryPath).split(sep).join('/'));
    }
  }

  return routes.sort();
}

function diffRoutes(actual, expected) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  return {
    missing: expected.filter((route) => !actualSet.has(route)),
    extra: actual.filter((route) => !expectedSet.has(route)),
  };
}

function routeModulePath(route) {
  return `${PLAYGROUND_ALIAS_PREFIX}/${route.replace(/\.tsx$/, '')}`;
}

function reportExportError(filePath, exportName) {
  console.error(`${filePath} must export ${exportName} for the wrapper shim to re-export it.`);
  process.exitCode = 1;
}

function parseSource(filePath, source) {
  return ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function addBindingNames(name, exports) {
  if (ts.isIdentifier(name)) {
    exports.add(name.text);
    return;
  }

  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) {
        addBindingNames(element.name, exports);
      }
    }
  }
}

function collectExports(filePath, source) {
  const sourceFile = parseSource(filePath, source);
  const named = new Set();
  const reExports = [];
  let defaultExport = false;

  for (const statement of sourceFile.statements) {
    if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
        defaultExport = true;
      }

      if (
        (ts.isFunctionDeclaration(statement) ||
          ts.isClassDeclaration(statement) ||
          ts.isInterfaceDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement) ||
          ts.isEnumDeclaration(statement)) &&
        statement.name
      ) {
        named.add(statement.name.text);
      }

      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          addBindingNames(declaration.name, named);
        }
      }
    }

    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      defaultExport = true;
    }

    if (!ts.isExportDeclaration(statement) || !statement.exportClause) {
      continue;
    }

    const modulePath =
      statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : undefined;

    if (ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        const exportName = element.name.text;
        named.add(exportName);

        if (exportName === 'default') {
          defaultExport = true;
        }

        if (modulePath) {
          reExports.push({ exportName, modulePath });
        }
      }
    }
  }

  return { defaultExport, named, reExports };
}

function hasNamedExport(filePath, source, exportName) {
  return collectExports(filePath, source).named.has(exportName);
}

function hasDefaultExport(filePath, source) {
  return collectExports(filePath, source).defaultExport;
}

function hasReExport(filePath, source, exportName, modulePath) {
  return collectExports(filePath, source).reExports.some(
    (reExport) => reExport.exportName === exportName && reExport.modulePath === modulePath
  );
}

function hasSideEffectImport(filePath, source, modulePath) {
  const sourceFile = parseSource(filePath, source);

  return sourceFile.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      !statement.importClause &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === modulePath
  );
}

const wrapperRoutes = collectRouteEntries(wrapperAppRoot);
const playgroundRoutes = collectRouteEntries(playgroundAppRoot);
const { missing, extra } = diffRoutes(wrapperRoutes, playgroundRoutes);
const missingSet = new Set(missing);
const globalsCss = readFileSync(join(wrapperAppRoot, 'globals.css'), 'utf8');

if (missing.length > 0 || extra.length > 0) {
  console.error('agent-eval playground route shims are out of sync.');

  if (missing.length > 0) {
    console.error(`Missing wrapper routes:\n${missing.map((route) => `  - ${route}`).join('\n')}`);
  }

  if (extra.length > 0) {
    console.error(`Extra wrapper routes:\n${extra.map((route) => `  - ${route}`).join('\n')}`);
  }

  process.exitCode = 1;
}

for (const route of playgroundRoutes) {
  if (missingSet.has(route)) {
    continue;
  }

  const playgroundFile = join(playgroundAppRoot, route);
  const wrapperFile = join(wrapperAppRoot, route);
  const playgroundSource = readFileSync(playgroundFile, 'utf8');
  const wrapperSource = readFileSync(wrapperFile, 'utf8');
  const modulePath = routeModulePath(route);

  if (route !== 'page.tsx' && !route.endsWith('/page.tsx')) {
    continue;
  }

  if (!hasNamedExport(playgroundFile, playgroundSource, 'dynamic')) {
    reportExportError(playgroundFile, 'dynamic');
  }

  if (!hasDefaultExport(playgroundFile, playgroundSource)) {
    reportExportError(playgroundFile, 'default');
  }

  if (!hasReExport(wrapperFile, wrapperSource, 'dynamic', modulePath)) {
    console.error(`${wrapperFile} must re-export dynamic from ${modulePath}.`);
    process.exitCode = 1;
  }

  if (!hasReExport(wrapperFile, wrapperSource, 'default', modulePath)) {
    console.error(`${wrapperFile} must re-export default from ${modulePath}.`);
    process.exitCode = 1;
  }
}

const playgroundLayout = join(playgroundAppRoot, 'layout.tsx');
const wrapperLayout = join(wrapperAppRoot, 'layout.tsx');
const playgroundLayoutSource = readFileSync(playgroundLayout, 'utf8');
const wrapperLayoutSource = readFileSync(wrapperLayout, 'utf8');

if (!hasNamedExport(playgroundLayout, playgroundLayoutSource, 'metadata')) {
  reportExportError(playgroundLayout, 'metadata');
}

if (!hasDefaultExport(playgroundLayout, playgroundLayoutSource)) {
  reportExportError(playgroundLayout, 'default');
}

if (!hasSideEffectImport(wrapperLayout, wrapperLayoutSource, './globals.css')) {
  console.error(`${wrapperLayout} must import the wrapper globals.css.`);
  process.exitCode = 1;
}

if (
  !hasReExport(wrapperLayout, wrapperLayoutSource, 'metadata', `${PLAYGROUND_ALIAS_PREFIX}/layout`)
) {
  console.error(`${wrapperLayout} must re-export metadata from ${PLAYGROUND_ALIAS_PREFIX}/layout.`);
  process.exitCode = 1;
}

if (
  !hasReExport(wrapperLayout, wrapperLayoutSource, 'default', `${PLAYGROUND_ALIAS_PREFIX}/layout`)
) {
  console.error(`${wrapperLayout} must re-export default from ${PLAYGROUND_ALIAS_PREFIX}/layout.`);
  process.exitCode = 1;
}

if (!globalsCss.includes('@vercel/agent-eval-playground/app/globals.css')) {
  console.error('agent-eval/app/globals.css must import the playground globals.css.');
  process.exitCode = 1;
}

if (!globalsCss.includes('@source "../node_modules/@vercel/agent-eval-playground"')) {
  console.error(
    'agent-eval/app/globals.css must include the playground package as a Tailwind source.'
  );
  process.exitCode = 1;
}

if (process.exitCode === undefined) {
  console.log(`Playground route shims match ${playgroundRoutes.length} upstream routes.`);
}
