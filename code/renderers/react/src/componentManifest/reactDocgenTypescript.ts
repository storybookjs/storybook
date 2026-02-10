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
 * Get the ordered list of export names for symbols that react-docgen-typescript would recognize as
 * components. react-docgen-typescript processes exports in order and skips non-components, so the
 * Nth doc corresponds to the Nth component-export.
 *
 * This replicates the component detection heuristic from react-docgen-typescript's Parser:
 *
 * - ExtractPropsFromTypeIfStatelessComponent: call signatures with a "props" param
 * - ExtractPropsFromTypeIfStatefulComponent: construct signatures with 'props' on the instance
 *
 * @see https://github.com/styleguidist/react-docgen-typescript/blob/master/src/parser.ts
 */
function getComponentExportNames(checker: ts.TypeChecker, sourceFile: ts.SourceFile): string[] {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    return [];
  }

  const result: string[] = [];

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
      result.push(exportSymbol.getName());
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
    const exportNames = sourceFile ? getComponentExportNames(checker, sourceFile) : [];

    return docs
      .map((doc, i) => ({
        ...doc,
        exportName: exportNames[i] ?? doc.displayName,
        // Filter out React built-in HTML/DOM/Aria props, keep third-party and custom props
        props: Object.fromEntries(
          Object.entries(doc.props).filter(([, prop]) => !isReactBuiltinProp(prop))
        ),
      }))
      .filter((doc) => /^[A-Z]/.test(doc.displayName));
  },
  { name: 'parseWithReactDocgenTypescript' }
);
