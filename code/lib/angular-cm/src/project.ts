import { isInNodeModules, slash } from 'storybook/internal/common';
import {
  type ComponentJsDocInfo,
  extractComponentJsDocInfo,
  type FileSnapshotCache,
  ProgramBackedProject,
  ProjectFileTracker,
} from 'storybook/internal/component-meta';
import { logger } from 'storybook/internal/node-logger';

import * as path from 'node:path';

import type * as ts from 'typescript';

import { analyzeSourceFile } from './analyzer/analyze-file.ts';
import type { AngularClassMeta, AngularComponentMetaResult, AngularFileMeta } from './types.ts';

export type FsFileSnapshots = FileSnapshotCache<ts.IScriptSnapshot>;

// The host is hand-written instead of Volar's because Angular components are plain TS files,
// needing no language plugins or script-id mapping.
export class AngularComponentMetaProject extends ProgramBackedProject<
  ts.IScriptSnapshot,
  ts.SourceFile | undefined
> {
  protected readonly service: ts.LanguageService;
  protected readonly files: ProjectFileTracker<ts.IScriptSnapshot>;

  constructor(
    private typescript: typeof ts,
    private commandLine: ts.ParsedCommandLine,
    public readonly configFileName: string | undefined,
    fsFileSnapshots: FsFileSnapshots = new Map(),
    getCommandLineFn?: () => ts.ParsedCommandLine,
    private documentRegistry?: ts.DocumentRegistry
  ) {
    super();
    this.files = new ProjectFileTracker(
      typescript,
      commandLine,
      fsFileSnapshots,
      (text) => typescript.ScriptSnapshot.fromString(text),
      getCommandLineFn
    );
    const { sys } = typescript;
    // No `getProjectReferences`: honoring it drops a referenced project's files from this program.
    const host: ts.LanguageServiceHost = {
      getCompilationSettings: () => this.commandLine.options,
      // TS only re-reads script names, versions and snapshots when this string moves.
      getProjectVersion: () => this.files.getProjectVersion(),
      getScriptFileNames: () => this.files.getScriptFileNames(),
      getScriptVersion: (fileName) => this.files.getScriptVersion(fileName),
      getScriptSnapshot: (fileName) => this.files.getSnapshot(fileName),
      getCurrentDirectory: () =>
        configFileName
          ? path.dirname(configFileName)
          : (this.commandLine.options.rootDir ?? process.cwd()),
      getDefaultLibFileName: (options) => typescript.getDefaultLibFilePath(options),
      useCaseSensitiveFileNames: () => sys.useCaseSensitiveFileNames,
      fileExists: (fileName) => sys.fileExists(fileName),
      readFile: (fileName, encoding) => sys.readFile(fileName, encoding),
      // Without realpath TS cannot dedupe symlinked packages, splitting type identities.
      realpath: sys.realpath?.bind(sys),
      directoryExists: (directoryName) => sys.directoryExists(directoryName),
      getDirectories: (directoryName) => sys.getDirectories(directoryName),
      readDirectory: (dirName, extensions, exclude, include, depth) =>
        sys.readDirectory(dirName, extensions, exclude, include, depth),
    };
    this.service = typescript.createLanguageService(host, this.documentRegistry);
  }

  getCommandLine(): ts.ParsedCommandLine {
    return this.commandLine;
  }

  extract(
    componentPath: string,
    names: { exportName: string; localName?: string }
  ): AngularComponentMetaResult | undefined {
    const fileName = slash(componentPath);

    // Extractions can land inside the watcher's debounce window, or with no watcher at all.
    this.files.ensureFresh([fileName]);

    let program = this.service.getProgram();
    let sourceFile = program?.getSourceFile(fileName);
    if (!sourceFile) {
      // Not in the root set: an inferred project, or a component outside the tsconfig's include.
      this.ensureFiles([fileName]);
      program = this.service.getProgram();
      sourceFile = program?.getSourceFile(fileName);
    }
    if (!program || !sourceFile) {
      this.debug(`${fileName} is in no TypeScript program, so nothing was extracted from it`);
      return undefined;
    }

    // Sweeping every cached snapshot instead costs one stat per project file per component.
    if (this.files.ensureFresh(importClosure(this.typescript, program, sourceFile))) {
      program = this.service.getProgram();
      sourceFile = program?.getSourceFile(fileName);
      if (!program || !sourceFile) {
        this.debug(`${fileName} left the program while being refreshed`);
        return undefined;
      }
    }

    const checker = program.getTypeChecker();
    const fileMeta = analyzeSourceFile(this.typescript, sourceFile, checker);
    const entry = this.pickEntry(fileMeta, sourceFile, names);
    if (entry) {
      this.debug(`${describe(entry)} from ${fileName}`);
      return {
        entry,
        json: fileMeta,
        ...jsDocInfoField(
          this.typescript,
          checker,
          findClassDeclaration(this.typescript, sourceFile, entry.name)
        ),
      };
    }
    const viaExports = this.extractViaModuleExports(checker, sourceFile, fileMeta, names);
    if (viaExports) {
      this.debug(`${describe(viaExports.entry)} from ${fileName}, reached through its exports`);
      return viaExports;
    }
    // Listing what the file does declare turns a name mismatch from a silent miss into an obvious
    // one, which is the usual reason a component's props table comes back empty.
    this.debug(
      `no class named ${[names.exportName, names.localName].filter(Boolean).join(' or ')} in ` +
        `${fileName}; it declares ${declaredNames(fileMeta).join(', ') || 'no classes'}`
    );
    return undefined;
  }

  private debug(message: string): void {
    logger.debug(
      `[angular-cm] ${message}${this.configFileName ? ` (${this.configFileName})` : ''}`
    );
  }

  private pickEntry(
    fileMeta: AngularFileMeta,
    sourceFile: ts.SourceFile,
    { exportName, localName }: { exportName: string; localName?: string }
  ): AngularClassMeta | undefined {
    const direct = findRecord(fileMeta, exportName);
    if (direct) {
      return direct;
    }
    if (exportName === 'default') {
      const viaDefault = findRecord(
        fileMeta,
        findDefaultExportedClassName(this.typescript, sourceFile)
      );
      if (viaDefault) {
        return viaDefault;
      }
    }
    return findRecord(fileMeta, localName);
  }

  private extractViaModuleExports(
    checker: ts.TypeChecker,
    sourceFile: ts.SourceFile,
    fileMeta: AngularFileMeta,
    { exportName, localName }: { exportName: string; localName?: string }
  ): AngularComponentMetaResult | undefined {
    const { SymbolFlags, isClassDeclaration } = this.typescript;
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
      if (!declaration?.name || declaration.getSourceFile().isDeclarationFile) {
        continue;
      }
      const declarationFile = declaration.getSourceFile();
      const targetMeta =
        declarationFile === sourceFile
          ? fileMeta
          : analyzeSourceFile(this.typescript, declarationFile, checker);
      const entry = findRecord(targetMeta, declaration.name.text);
      if (entry) {
        return {
          entry,
          json: targetMeta,
          ...jsDocInfoField(this.typescript, checker, declaration),
        };
      }
    }
    return undefined;
  }
}

// `node_modules` is the boundary: a dependency's sources do not change under a running dev server.
const importClosure = (
  typescript: typeof ts,
  program: ts.Program,
  entry: ts.SourceFile
): string[] => {
  const checker = program.getTypeChecker();
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
  typescript: typeof ts,
  sourceFile: ts.SourceFile,
  name: string
): ts.ClassDeclaration | undefined {
  return sourceFile.statements.find(
    (statement): statement is ts.ClassDeclaration =>
      typescript.isClassDeclaration(statement) && statement.name?.text === name
  );
}

function jsDocInfoField(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  declaration: ts.ClassDeclaration | undefined
): { jsDocInfo?: ComponentJsDocInfo } {
  const symbol = declaration?.name && checker.getSymbolAtLocation(declaration.name);
  return symbol ? { jsDocInfo: extractComponentJsDocInfo(typescript, checker, symbol) } : {};
}

function findDefaultExportedClassName(
  typescript: typeof ts,
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
