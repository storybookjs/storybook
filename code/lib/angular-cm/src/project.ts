import {
  type ComponentMetaProjectBase,
  type FileChange,
  type FileSnapshotCache,
  ProjectFileTracker,
  filterSourceFilePaths,
} from 'storybook/internal/component-meta';

import * as path from 'node:path';

import type * as ts from 'typescript';

import type { CompodocJson } from '@storybook/angular-compodoc';
import { analyzeSourceFile } from './analyzer/analyze-file.ts';
import type { AngularClassMeta, AngularComponentMetaResult, AngularFileMeta } from './types.ts';

export type FsFileSnapshots = FileSnapshotCache<ts.IScriptSnapshot>;

const normalize = (fileName: string) => fileName.replace(/\\/g, '/');

// The host is hand-written instead of Volar's because Angular components are plain TS files,
// needing no language plugins or script-id mapping.
export class AngularComponentMetaProject implements ComponentMetaProjectBase {
  private readonly ls: ts.LanguageService;
  private readonly files: ProjectFileTracker<ts.IScriptSnapshot>;

  constructor(
    private typescript: typeof ts,
    private commandLine: ts.ParsedCommandLine,
    public readonly configFileName: string | undefined,
    fsFileSnapshots: FsFileSnapshots = new Map(),
    getCommandLineFn?: () => ts.ParsedCommandLine,
    private documentRegistry?: ts.DocumentRegistry
  ) {
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
    this.ls = typescript.createLanguageService(host, this.documentRegistry);
  }

  getCommandLine(): ts.ParsedCommandLine {
    return this.commandLine;
  }

  dispose(): void {
    this.ls.dispose();
  }

  ensureFiles(fileNames: string[]): void {
    this.files.ensureFiles(fileNames);
  }

  hasSourceFile(fileName: string): boolean {
    return !!this.ls.getProgram()?.getSourceFile(normalize(fileName));
  }

  getSourceFilePaths(): string[] {
    const program = this.ls.getProgram();
    if (!program) {
      return [];
    }
    return filterSourceFilePaths(program.getSourceFiles().map((sourceFile) => sourceFile.fileName));
  }

  onFilesChanged(changes: FileChange[]): void {
    // Captured once so the batch cannot rebuild the program mid-probe.
    const program = this.ls.getProgram();
    this.files.onFilesChanged(changes, (fileName) => !!program?.getSourceFile(fileName));
  }

  extract(
    componentPath: string,
    names: { exportName: string; localName?: string }
  ): AngularComponentMetaResult | undefined {
    const fileName = normalize(componentPath);

    // Extractions can land inside the watcher's debounce window, or with no watcher at all.
    this.files.ensureFresh([fileName]);

    let program = this.ls.getProgram();
    let sourceFile = program?.getSourceFile(fileName);
    if (!sourceFile) {
      // Not in the root set: an inferred project, or a component outside the tsconfig's include.
      this.ensureFiles([fileName]);
      program = this.ls.getProgram();
      sourceFile = program?.getSourceFile(fileName);
    }
    if (!program || !sourceFile) {
      return undefined;
    }

    // Sweeping every cached snapshot instead costs one stat per project file per component.
    if (this.files.ensureFresh(importClosure(this.typescript, program, sourceFile))) {
      program = this.ls.getProgram();
      sourceFile = program?.getSourceFile(fileName);
      if (!program || !sourceFile) {
        return undefined;
      }
    }

    const checker = program.getTypeChecker();
    const fileMeta = analyzeSourceFile(this.typescript, sourceFile, checker);
    const entry = this.pickEntry(fileMeta, sourceFile, names);
    if (entry) {
      return { entry, json: toCompodocJson(fileMeta) };
    }
    return this.extractViaModuleExports(checker, sourceFile, fileMeta, names);
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
        return { entry, json: toCompodocJson(targetMeta) };
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
    if (closure.has(file.fileName) || file.fileName.includes('node_modules')) {
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

const findRecord = (
  fileMeta: AngularFileMeta,
  name: string | undefined
): AngularClassMeta | undefined =>
  name
    ? [
        ...fileMeta.components,
        ...fileMeta.directives,
        ...fileMeta.pipes,
        ...fileMeta.injectables,
        ...fileMeta.classes,
      ].find((record) => record.name === name)
    : undefined;

// The cast is sound because the analyzer dispatches by decorator, so no array mixes record kinds.
const toCompodocJson = (fileMeta: AngularFileMeta): CompodocJson =>
  fileMeta as unknown as CompodocJson;

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
