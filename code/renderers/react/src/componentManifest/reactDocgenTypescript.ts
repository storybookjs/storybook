import { dirname, join, resolve } from 'node:path';

import {
  type ComponentDoc,
  type FileParser,
  type ParserOptions,
  type PropItem,
} from 'react-docgen-typescript';
import type ts from 'typescript';

import { logger } from 'storybook/internal/node-logger';

import { asyncCache, cached, findTsconfigPath } from './utils';

export type ComponentDocWithExportName = ComponentDoc & { exportName: string };

type TypeScriptRuntime = typeof import('typescript');
type ReactDocgenTypescriptRuntime = typeof import('react-docgen-typescript');

let typeScriptPromise: Promise<TypeScriptRuntime> | undefined;
let reactDocgenTypescriptPromise: Promise<ReactDocgenTypescriptRuntime> | undefined;

const loadTypeScript = () => (typeScriptPromise ??= import('typescript'));

const loadReactDocgenTypescript = () =>
  (reactDocgenTypescriptPromise ??= import('react-docgen-typescript'));

/**
 * Auto-detect bulk props contributed by a single non-user source file and filter them out.
 *
 * This catches:
 *
 * - React built-in props (HTMLAttributes, DOMAttributes, AriaAttributes from @types/react)
 * - DOM built-in props (HTMLElement, GlobalEventHandlers from lib.dom.d.ts)
 * - CSS-in-JS system props (Panda CSS, styled-system, Stitches style props)
 *
 * The heuristic: when a single source file in `node_modules` or ending in `.d.ts` contributes more
 * than {@link LARGE_NON_USER_SOURCE_THRESHOLD} props, all props from that source are filtered.
 * User-authored `.ts` files are never filtered.
 */
const LARGE_NON_USER_SOURCE_THRESHOLD = 30;

const getPropSource = (prop: PropItem): string | undefined =>
  prop.parent?.fileName ?? prop.declarations?.[0]?.fileName;

const getLargeNonUserPropSources = (props: Record<string, PropItem>): Set<string> => {
  const countBySource = new Map<string, number>();
  for (const prop of Object.values(props)) {
    const source = getPropSource(prop);
    if (source?.includes('node_modules') || source?.endsWith('.d.ts')) {
      countBySource.set(source, (countBySource.get(source) ?? 0) + 1);
    }
  }
  const largeNonUserSources = new Set<string>();
  for (const [source, count] of countBySource) {
    if (count > LARGE_NON_USER_SOURCE_THRESHOLD) {
      largeNonUserSources.add(source);
    }
  }
  return largeNonUserSources;
};

/**
 * Find `Identifier.displayName = 'value'` assignments in a source file. Returns the string value if
 * the identifier matches the given name, otherwise undefined.
 */
function findDisplayNameAssignment(
  typescript: TypeScriptRuntime,
  sourceFile: ts.SourceFile,
  identifierName: string
): string | undefined {
  for (const statement of sourceFile.statements) {
    if (!typescript.isExpressionStatement(statement)) {
      continue;
    }
    const expr = statement.expression;
    if (
      typescript.isBinaryExpression(expr) &&
      expr.operatorToken.kind === typescript.SyntaxKind.EqualsToken &&
      typescript.isPropertyAccessExpression(expr.left) &&
      expr.left.name.text === 'displayName' &&
      typescript.isIdentifier(expr.left.expression) &&
      expr.left.expression.text === identifierName &&
      typescript.isStringLiteral(expr.right)
    ) {
      return expr.right.text;
    }
  }
  return undefined;
}

/**
 * Build a map from possible displayName values to the public export name for component exports.
 * react-docgen-typescript computes displayName from:
 *
 * 1. An explicit `.displayName` static property
 * 2. The resolved symbol name (e.g. "Card" for `export { Card as RenamedCard }`)
 * 3. The filename (for default exports)
 *
 * We map all of these to the correct export name so we can match docs by displayName.
 *
 * @see https://github.com/styleguidist/react-docgen-typescript/blob/master/src/parser.ts
 */
function getExportNameMap(
  typescript: TypeScriptRuntime,
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile
): Map<string, string> {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    return new Map();
  }

  const result = new Map<string, string>();
  const fileName = sourceFile.fileName.replace(/.*\//, '').replace(/\.[^.]+$/, '');

  for (const exportSymbol of checker.getExportsOfModule(moduleSymbol)) {
    const resolved =
      exportSymbol.flags & typescript.SymbolFlags.Alias
        ? checker.getAliasedSymbol(exportSymbol)
        : exportSymbol;

    const declaration = resolved.valueDeclaration ?? resolved.getDeclarations()?.[0];
    if (!declaration) {
      continue;
    }

    const type = checker.getTypeOfSymbolAtLocation(resolved, declaration);

    const callSigs = type.getCallSignatures();
    const isStateless = callSigs.some((sig) => {
      const params = sig.getParameters();
      return params.length === 1 || (params.length > 0 && params[0].getName() === 'props');
    });

    const constructSigs = type.getConstructSignatures();
    const isStateful = constructSigs.some(
      (sig) => sig.getReturnType().getProperty('props') !== undefined
    );

    if (isStateless || isStateful) {
      const exportName = exportSymbol.getName();
      const resolvedName = resolved.getName();

      // Map resolved symbol name → export name (handles aliased re-exports)
      result.set(resolvedName, exportName);

      // For default exports, RDT uses the filename as displayName
      if (exportName === 'default') {
        result.set(fileName, 'default');
      }

      // If the component has a static .displayName assignment (e.g. Foo.displayName = 'Bar'),
      // RDT uses that value. Map it → export name so we can match it.
      const displayNameValue = findDisplayNameAssignment(typescript, sourceFile, resolvedName);
      if (displayNameValue) {
        result.set(displayNameValue, exportName);
      }
    }
  }

  return result;
}

type ParserState = { program: ts.Program; fileParser: FileParser };

/**
 * Manages TS programs and react-docgen-typescript parsers per tsconfig. On `invalidateParser()` the
 * parsers are rebuilt incrementally — TypeScript reuses source files that haven't changed on disk,
 * so only modified files are re-parsed. This keeps prop extraction correct across HMR cycles
 * without the cost of a full program rebuild.
 */
const previousProgramsByConfigKey = new Map<string, ts.Program | undefined>();
let parserCache = new Map<string, ParserState>();
let parserBuilds = new Map<string, Promise<ParserState>>();

/** Rebuild the TS program incrementally so that file changes are picked up on the next parse. */
export function invalidateParser() {
  parserCache = new Map();
  parserBuilds = new Map();
}

async function getParser(filePath: string, userOptions?: ParserOptions) {
  const [typescript, reactDocgenTypescript] = await Promise.all([
    loadTypeScript(),
    loadReactDocgenTypescript(),
  ]);
  const optionsKey = JSON.stringify(userOptions ?? {});

  // Mirror the Volar-inspired project selection we already use in react-component-meta:
  // if the nearest root tsconfig is only a project-references shell, follow references and pick
  // the config that actually includes this file. This is the manifest-side extension of #34353.
  const configPath =
    findTsconfigPathForFile(typescript, process.cwd(), filePath) ?? findTsconfigPath(process.cwd());
  const configKey = configPath ?? '<no-tsconfig>';
  const parserKey = `${configKey}::${optionsKey}`;
  const cachedParser = parserCache.get(parserKey);
  if (cachedParser) {
    return { ...cachedParser, typescript };
  }

  const pendingParser = parserBuilds.get(parserKey);
  if (pendingParser) {
    return { ...(await pendingParser), typescript };
  }

  const buildParser = (async () => {
    let compilerOptions: ts.CompilerOptions = { noErrorTruncation: true, strict: true };
    let fileNames: string[] = [];

    if (configPath) {
      const parsed = parseTsconfig(typescript, configPath);
      compilerOptions = { ...parsed.options, noErrorTruncation: true };
      fileNames = parsed.fileNames;
    } else {
      logger.warn(
        'No tsconfig.json (or tsconfig.base.json / tsconfig.app.json) found. ' +
          'TypeScript component props will not be documented by react-docgen-typescript. ' +
          'Create a tsconfig.json in your project root to enable automatic controls.'
      );
    }

    const program = typescript.createProgram(
      fileNames,
      compilerOptions,
      undefined,
      previousProgramsByConfigKey.get(configKey)
    );
    previousProgramsByConfigKey.set(configKey, program);

    const parserOptions: ParserOptions = {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      ...userOptions,
      // Always force savePropValueAsString so default values are in a consistent format
      savePropValueAsString: true,
    };

    const state = {
      program,
      fileParser: reactDocgenTypescript.withCompilerOptions(compilerOptions, parserOptions),
    };

    parserCache.set(parserKey, state);
    return state;
  })();

  parserBuilds.set(parserKey, buildParser);

  try {
    return { ...(await buildParser), typescript };
  } finally {
    parserBuilds.delete(parserKey);
  }
}

/** Find the component doc that matches the given import/component name. */
export function matchComponentDoc(
  docs: ComponentDocWithExportName[],
  {
    importName,
    localImportName,
    componentName,
  }: { importName?: string; localImportName?: string; componentName?: string }
): ComponentDocWithExportName | undefined {
  if (docs.length === 0) {
    return undefined;
  }
  if (docs.length === 1) {
    return docs[0];
  }
  return docs.find(
    (doc) =>
      doc.exportName === importName ||
      doc.exportName === localImportName ||
      doc.displayName === importName ||
      doc.displayName === localImportName ||
      doc.displayName === componentName
  );
}

export function getReactDocgenTypescriptError(
  path: string,
  {
    importName,
    localImportName,
    componentName,
  }: { importName?: string; localImportName?: string; componentName?: string },
  docs: ComponentDocWithExportName[]
) {
  if (docs.length === 0) {
    return {
      name: 'react-docgen-typescript found no component docs',
      message: [
        `File: ${path}`,
        'react-docgen-typescript did not return any component docs for this file.',
      ].join('\n'),
    };
  }

  return {
    name: 'react-docgen-typescript could not match component docs',
    message: [
      `File: ${path}`,
      "react-docgen-typescript returned component docs for this file, but none matched the story's component import.",
      `Looked for: componentName=${componentName}, localImportName=${localImportName ?? '<none>'}, importName=${importName ?? '<none>'}.`,
    ].join('\n'),
  };
}

/**
 * Parse a component file with react-docgen-typescript. Per-file results are cached via
 * `invalidateCache()`. The underlying TS program is a long-lived singleton.
 */
export const parseWithReactDocgenTypescript = asyncCache(
  async (filePath: string, userOptions?: ParserOptions): Promise<ComponentDocWithExportName[]> => {
    const { program, fileParser, typescript } = await getParser(filePath, userOptions);
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(filePath);

    const docs = fileParser.parseWithProgramProvider(filePath, () => program);
    // Map from resolved (original) name → public export name.
    // e.g. for `export { Card as RenamedCard }`: "Card" → "RenamedCard"
    const exportNameMap = sourceFile
      ? getExportNameMap(typescript, checker, sourceFile)
      : new Map();

    return docs.map((doc) => {
      const largeNonUserSources = getLargeNonUserPropSources(doc.props);
      return {
        ...doc,
        // Use name-based lookup: displayName is the resolved symbol name, so look it up in the
        // export map to get the public export name. Falls back to displayName when not aliased.
        exportName: exportNameMap.get(doc.displayName) ?? doc.displayName,
        // Filter out bulk props from non-user sources (React built-ins, DOM, CSS-in-JS system props)
        props: Object.fromEntries(
          Object.entries(doc.props).filter(([, prop]) => {
            const source = getPropSource(prop);
            return !source || !largeNonUserSources.has(source);
          })
        ),
      };
    });
  },
  { name: 'parseWithReactDocgenTypescript' }
);

const findTsconfigPathForFile = cached(
  (typescript: TypeScriptRuntime, cwd: string, filePath: string): string | undefined => {
    const configPath = findTsconfigPath(cwd);
    if (!configPath) {
      return undefined;
    }

    return findTsconfigPathIncludingFile(typescript, configPath, filePath, new Set()) ?? configPath;
  },
  {
    key: (typescript, cwd, filePath) =>
      `${normalizeFileName(typescript, resolve(cwd))}::${normalizeFileName(
        typescript,
        resolve(filePath)
      )}`,
    name: 'findTsconfigPathForFile',
  }
);

function findTsconfigPathIncludingFile(
  typescript: TypeScriptRuntime,
  configPath: string,
  filePath: string,
  seenConfigPaths: Set<string>
): string | undefined {
  const normalizedConfigPath = normalizeFileName(typescript, configPath);
  if (seenConfigPaths.has(normalizedConfigPath)) {
    return undefined;
  }
  seenConfigPaths.add(normalizedConfigPath);

  const { config, parsed } = readTsconfig(typescript, configPath);
  if (parsed.fileNames.some((name) => isSameFileName(typescript, name, filePath))) {
    return configPath;
  }

  for (const referencedConfigPath of getReferencedTsconfigPaths(typescript, configPath, config)) {
    const matchingConfigPath = findTsconfigPathIncludingFile(
      typescript,
      referencedConfigPath,
      filePath,
      seenConfigPaths
    );
    if (matchingConfigPath) {
      return matchingConfigPath;
    }
  }

  return undefined;
}

function getReferencedTsconfigPaths(
  typescript: TypeScriptRuntime,
  configPath: string,
  config: unknown
) {
  const references = Array.isArray((config as { references?: unknown[] })?.references)
    ? (config as { references: Array<{ path?: unknown }> }).references
    : [];

  return references
    .map((reference) => reference.path)
    .filter((referencePath): referencePath is string => typeof referencePath === 'string')
    .map((referencePath) => resolve(dirname(configPath), referencePath))
    .map((referencePath) =>
      referencePath.endsWith('.json') ? referencePath : join(referencePath, 'tsconfig.json')
    )
    .filter((referencePath) => typescript.sys.fileExists(referencePath));
}

function parseTsconfig(typescript: TypeScriptRuntime, configPath: string) {
  return readTsconfig(typescript, configPath).parsed;
}

function readTsconfig(typescript: TypeScriptRuntime, configPath: string) {
  const { config } = typescript.readConfigFile(configPath, typescript.sys.readFile);
  return {
    config,
    parsed: typescript.parseJsonConfigFileContent(config, typescript.sys, dirname(configPath)),
  };
}

function isSameFileName(typescript: TypeScriptRuntime, left: string, right: string) {
  return normalizeFileName(typescript, left) === normalizeFileName(typescript, right);
}

function normalizeFileName(typescript: TypeScriptRuntime, fileName: string) {
  return typescript.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase();
}
