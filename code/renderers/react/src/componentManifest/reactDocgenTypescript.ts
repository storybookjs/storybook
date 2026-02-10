import { dirname } from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import { type ComponentDoc, type FileParser, withCompilerOptions } from 'react-docgen-typescript';
import ts from 'typescript';

import { cached, findTsconfigPath } from './utils';

export type ComponentDocWithExportName = ComponentDoc & { exportName: string };

/**
 * Check if a prop is inherited from a React built-in Attributes interface (e.g. HTMLAttributes,
 * AriaAttributes, DOMAttributes, ButtonHTMLAttributes). This also catches module augmentations
 * (e.g. Next.js extending HTMLAttributes).
 */
const isReactBuiltinProp = (prop: { parent?: { name: string } }): boolean =>
  prop.parent?.name?.endsWith('Attributes') ?? false;

/**
 * Find `Identifier.displayName = 'value'` assignments in a source file. Returns the string value if
 * the identifier matches the given name, otherwise undefined.
 */
function findDisplayNameAssignment(
  sourceFile: ts.SourceFile,
  identifierName: string
): string | undefined {
  for (const statement of sourceFile.statements) {
    if (!ts.isExpressionStatement(statement)) {
      continue;
    }
    const expr = statement.expression;
    if (
      ts.isBinaryExpression(expr) &&
      expr.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(expr.left) &&
      expr.left.name.text === 'displayName' &&
      ts.isIdentifier(expr.left.expression) &&
      expr.left.expression.text === identifierName &&
      ts.isStringLiteral(expr.right)
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
function getExportNameMap(checker: ts.TypeChecker, sourceFile: ts.SourceFile): Map<string, string> {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    return new Map();
  }

  const result = new Map<string, string>();
  const fileName = sourceFile.fileName.replace(/.*\//, '').replace(/\.[^.]+$/, '');

  for (const exportSymbol of checker.getExportsOfModule(moduleSymbol)) {
    const resolved =
      exportSymbol.flags & ts.SymbolFlags.Alias
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
      const displayNameValue = findDisplayNameAssignment(sourceFile, resolvedName);
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
let compilerOptions: ts.CompilerOptions | undefined;
let fileNames: string[] | undefined;
let previousProgram: ts.Program | undefined;
let parser: { program: ts.Program; fileParser: FileParser } | undefined;

/** Rebuild the TS program incrementally so that file changes are picked up on the next parse. */
export function invalidateParser() {
  parser = undefined;
}

function getParser() {
  if (!parser) {
    const configPath = findTsconfigPath(process.cwd());
    compilerOptions ??= { noErrorTruncation: true, strict: true };

    if (configPath && !fileNames) {
      const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(config, ts.sys, dirname(configPath));
      compilerOptions = { ...parsed.options, noErrorTruncation: true };
      fileNames = parsed.fileNames;
    }

    const start = Date.now();
    const program = ts.createProgram(fileNames ?? [], compilerOptions, undefined, previousProgram);
    logger.verbose(
      `[react-docgen-typescript] ts.createProgram took ${Date.now() - start}ms (incremental: ${!!previousProgram})`
    );
    previousProgram = program;

    parser = {
      program,
      fileParser: withCompilerOptions(compilerOptions, {
        shouldExtractLiteralValuesFromEnum: true,
        shouldRemoveUndefinedFromOptional: true,
        savePropValueAsString: true,
      }) as FileParser,
    };
  }
  return parser;
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
  return (
    docs.find(
      (doc) =>
        doc.exportName === importName ||
        doc.exportName === localImportName ||
        doc.displayName === importName ||
        doc.displayName === localImportName ||
        doc.displayName === componentName
    ) ?? docs[0]
  );
}

/**
 * Parse a component file with react-docgen-typescript. Per-file results are cached via
 * `invalidateCache()`. The underlying TS program is a long-lived singleton.
 */
export const parseWithReactDocgenTypescript = cached(
  (filePath: string): ComponentDocWithExportName[] => {
    const { program, fileParser } = getParser();
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(filePath);

    const docs = fileParser.parseWithProgramProvider(filePath, () => program);
    // Map from resolved (original) name → public export name.
    // e.g. for `export { Card as RenamedCard }`: "Card" → "RenamedCard"
    const exportNameMap = sourceFile ? getExportNameMap(checker, sourceFile) : new Map();

    return docs
      .map((doc) => ({
        ...doc,
        // Use name-based lookup: displayName is the resolved symbol name, so look it up in the
        // export map to get the public export name. Falls back to displayName when not aliased.
        exportName: exportNameMap.get(doc.displayName) ?? doc.displayName,
        // Filter out React built-in HTML/DOM/Aria props, keep third-party and custom props
        props: Object.fromEntries(
          Object.entries(doc.props).filter(([, prop]) => !isReactBuiltinProp(prop))
        ),
      }))
      .filter((doc) => /^[A-Z]/.test(doc.displayName));
  },
  { name: 'parseWithReactDocgenTypescript' }
);
