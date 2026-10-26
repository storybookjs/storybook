import { isInNodeModules } from 'storybook/internal/common';
import {
  type ComponentJsDocInfo,
  extractComponentJsDocInfo,
} from 'storybook/internal/component-meta';
import { logger } from 'storybook/internal/node-logger';

import type * as ts from 'typescript';
import type { DocgenTypeChecker, DocgenTypeScript } from '@storybook/component-meta-typescript';

import { analyzeSourceFile, analyzerContext } from './analyzer/analyze-file.ts';
import type { AnalyzerContext } from './analyzer/context.ts';
import type { AngularClassMeta, AngularComponentMetaResult, AngularFileMeta } from './types.ts';

export interface ComponentNames {
  exportName: string;
  localName?: string;
}

export const debugExtraction = (configFileName: string | undefined, message: string) =>
  logger.debug(`[angular-cm] ${message}${configFileName ? ` (${configFileName})` : ''}`);

// Analyze the file a component lives in and pick the component's record, following the file's
// exports when the class is declared elsewhere. Both TypeScript APIs' projects extract through it.
export function extractComponent(
  typescript: DocgenTypeScript,
  checker: DocgenTypeChecker,
  sourceFile: ts.SourceFile,
  names: ComponentNames,
  debug: (message: string) => void
): AngularComponentMetaResult | undefined {
  const context = analyzerContext(typescript, sourceFile, checker);
  const fileMeta = analyzeSourceFile(typescript, sourceFile, checker, context);
  const entry = pickEntry(typescript, fileMeta, sourceFile, names);
  if (entry) {
    debug(`${describe(entry)} from ${sourceFile.fileName}`);
    return {
      entry,
      json: fileMeta,
      context,
      ...jsDocInfoField(
        typescript,
        checker,
        findClassDeclaration(typescript, sourceFile, entry.name)
      ),
    };
  }
  const viaExports = extractViaModuleExports(
    typescript,
    checker,
    sourceFile,
    fileMeta,
    context,
    names
  );
  if (viaExports) {
    debug(`${describe(viaExports.entry)} from ${sourceFile.fileName}, reached through its exports`);
    return viaExports;
  }
  // Listing what the file does declare turns a name mismatch from a silent miss into an obvious
  // one, which is the usual reason a component's props table comes back empty.
  debug(
    `no class named ${[names.exportName, names.localName].filter(Boolean).join(' or ')} in ` +
      `${sourceFile.fileName}; it declares ${declaredNames(fileMeta).join(', ') || 'no classes'}`
  );
  return undefined;
}

// The project files a component's file imports, transitively, to check for edits before extracting.
// `node_modules` is the boundary: a dependency's sources do not change under a running dev server.
export const importClosure = (
  typescript: DocgenTypeScript,
  checker: DocgenTypeChecker,
  entry: ts.SourceFile
): string[] => {
  const closure = new Set<string>();
  const queue: ts.SourceFile[] = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (closure.has(file.fileName) || isInNodeModules(file.fileName)) {
      continue;
    }
    closure.add(file.fileName);
    for (const statement of file.statements) {
      const specifier =
        typescript.isImportDeclaration(statement) || typescript.isExportDeclaration(statement)
          ? statement.moduleSpecifier
          : undefined;
      if (!specifier) {
        continue;
      }
      for (const declaration of checker.getSymbolAtLocation(specifier)?.declarations ?? []) {
        if (typescript.isSourceFile(declaration)) {
          queue.push(declaration);
        }
      }
    }
  }
  return [...closure];
};

const pickEntry = (
  typescript: DocgenTypeScript,
  fileMeta: AngularFileMeta,
  sourceFile: ts.SourceFile,
  { exportName, localName }: ComponentNames
): AngularClassMeta | undefined => {
  const direct = findRecord(fileMeta, exportName);
  if (direct) {
    return direct;
  }
  if (exportName === 'default') {
    const viaDefault = findRecord(fileMeta, findDefaultExportedClassName(typescript, sourceFile));
    if (viaDefault) {
      return viaDefault;
    }
  }
  return findRecord(fileMeta, localName);
};

const extractViaModuleExports = (
  typescript: DocgenTypeScript,
  checker: DocgenTypeChecker,
  sourceFile: ts.SourceFile,
  fileMeta: AngularFileMeta,
  context: AnalyzerContext,
  { exportName, localName }: ComponentNames
): AngularComponentMetaResult | undefined => {
  const { SymbolFlags, isClassDeclaration } = typescript;
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    return undefined;
  }
  const moduleExports = checker.getExportsOfModule(moduleSymbol);
  for (const name of [exportName, localName]) {
    const exported = name && moduleExports.find((symbol) => symbol.name === name);
    if (!exported) {
      continue;
    }
    const target =
      exported.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const declaration = target.declarations?.find((candidate): candidate is ts.ClassDeclaration =>
      isClassDeclaration(candidate)
    );
    if (!declaration?.name) {
      continue;
    }
    const declarationFile = declaration.getSourceFile();
    // A fresh context per analyzed file: the TypeIndex files what each analysis rendered, and the
    // name-resolution scope must be the file the argTypes' type text came from.
    const targetContext =
      declarationFile === sourceFile
        ? context
        : analyzerContext(typescript, declarationFile, checker);
    const targetMeta =
      declarationFile === sourceFile
        ? fileMeta
        : analyzeSourceFile(typescript, declarationFile, checker, targetContext);
    const entry = findRecord(targetMeta, declaration.name.text);
    if (entry) {
      return {
        entry,
        json: targetMeta,
        context: targetContext,
        ...jsDocInfoField(typescript, checker, declaration),
      };
    }
  }
  return undefined;
};

const allRecords = (fileMeta: AngularFileMeta): AngularClassMeta[] => [
  ...fileMeta.components,
  ...fileMeta.directives,
  ...fileMeta.pipes,
  ...fileMeta.injectables,
  ...fileMeta.classes,
];

const declaredNames = (fileMeta: AngularFileMeta): string[] =>
  allRecords(fileMeta).map((record) => `${record.name} (${record.type})`);

// Enough of a record's shape to tell "found nothing" apart from "found it, and it was empty".
const describe = (entry: AngularClassMeta): string => {
  const counts =
    'inputsClass' in entry
      ? `${entry.inputsClass?.length ?? 0} input(s), ${entry.outputsClass?.length ?? 0} output(s), ` +
        `${'propertiesClass' in entry ? (entry.propertiesClass?.length ?? 0) : 0} propertie(s)`
      : `${entry.properties.length} propertie(s), ${entry.methods.length} method(s)`;
  return `extracted ${entry.type} ${entry.name} with ${counts}`;
};

const findRecord = (
  fileMeta: AngularFileMeta,
  name: string | undefined
): AngularClassMeta | undefined =>
  name ? allRecords(fileMeta).find((record) => record.name === name) : undefined;

function findClassDeclaration(
  typescript: DocgenTypeScript,
  sourceFile: ts.SourceFile,
  name: string
): ts.ClassDeclaration | undefined {
  return sourceFile.statements.find(
    (statement): statement is ts.ClassDeclaration =>
      typescript.isClassDeclaration(statement) && statement.name?.text === name
  );
}

function jsDocInfoField(
  typescript: DocgenTypeScript,
  checker: DocgenTypeChecker,
  declaration: ts.ClassDeclaration | undefined
): { jsDocInfo?: ComponentJsDocInfo } {
  const symbol = declaration?.name && checker.getSymbolAtLocation(declaration.name);
  return symbol ? { jsDocInfo: extractComponentJsDocInfo(typescript, checker, symbol) } : {};
}

function findDefaultExportedClassName(
  typescript: DocgenTypeScript,
  sourceFile: ts.SourceFile
): string | undefined {
  for (const statement of sourceFile.statements) {
    if (
      typescript.isClassDeclaration(statement) &&
      statement.name &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === typescript.SyntaxKind.DefaultKeyword
      )
    ) {
      return statement.name.text;
    }
    if (
      typescript.isExportAssignment(statement) &&
      !statement.isExportEquals &&
      typescript.isIdentifier(statement.expression)
    ) {
      return statement.expression.text;
    }
  }
  return undefined;
}
