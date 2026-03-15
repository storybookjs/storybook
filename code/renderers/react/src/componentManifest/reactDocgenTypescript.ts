import { dirname } from 'node:path';

import {
  type ComponentDoc,
  type FileParser,
  type ParserOptions,
  type PropItem,
} from 'react-docgen-typescript';
import type ts from 'typescript';

import { asyncCache, findTsconfigPath } from './utils';

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

/**
 * Manages the TS program and react-docgen-typescript parser. On `invalidateParser()` the program is
 * rebuilt incrementally — TypeScript reuses source files that haven't changed on disk, so only
 * modified files are re-parsed. This keeps prop extraction correct across HMR cycles without the
 * cost of a full program rebuild.
 */
let cachedCompilerOptions: ts.CompilerOptions | undefined;
let cachedFileNames: string[] | undefined;
let previousProgram: ts.Program | undefined;
let parser: { program: ts.Program; fileParser: FileParser } | undefined;
let cachedParserOptionsKey: string | undefined;

/** Rebuild the TS program incrementally so that file changes are picked up on the next parse. */
export function invalidateParser() {
  parser = undefined;
  cachedCompilerOptions = undefined;
  cachedFileNames = undefined;
  cachedParserOptionsKey = undefined;
}

async function getParser(userOptions?: ParserOptions) {
  const [typescript, reactDocgenTypescript] = await Promise.all([
    loadTypeScript(),
    loadReactDocgenTypescript(),
  ]);
  // Rebuild parser if options changed
  const optionsKey = JSON.stringify(userOptions ?? {});
  if (parser && cachedParserOptionsKey !== optionsKey) {
    parser = undefined;
  }

  if (!parser) {
    const configPath = findTsconfigPath(process.cwd());
    cachedCompilerOptions = { noErrorTruncation: true, strict: true };

    if (configPath) {
      const { config } = typescript.readConfigFile(configPath, typescript.sys.readFile);
      const parsed = typescript.parseJsonConfigFileContent(
        config,
        typescript.sys,
        dirname(configPath)
      );
      cachedCompilerOptions = { ...parsed.options, noErrorTruncation: true };
      cachedFileNames = parsed.fileNames;
    }

    const program = typescript.createProgram(
      cachedFileNames ?? [],
      cachedCompilerOptions,
      undefined,
      previousProgram
    );
    previousProgram = program;

    const parserOptions: ParserOptions = {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      ...userOptions,
      // Always force savePropValueAsString so default values are in a consistent format
      savePropValueAsString: true,
    };

    parser = {
      program,
      fileParser: reactDocgenTypescript.withCompilerOptions(cachedCompilerOptions, parserOptions),
    };
    cachedParserOptionsKey = optionsKey;
  }
  return { ...parser, typescript };
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

/**
 * Parse a component file with react-docgen-typescript. Per-file results are cached via
 * `invalidateCache()`. The underlying TS program is a long-lived singleton.
 */
export const parseWithReactDocgenTypescript = asyncCache(
  async (filePath: string, userOptions?: ParserOptions): Promise<ComponentDocWithExportName[]> => {
    const { program, fileParser, typescript } = await getParser(userOptions);
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
