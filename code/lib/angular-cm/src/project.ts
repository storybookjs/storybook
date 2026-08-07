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

/**
 * Mtime-keyed snapshot cache shared across every project of one manager (Volar Kit checker
 * pattern); owned by the manager's factory.
 */
export type FsFileSnapshots = FileSnapshotCache<ts.IScriptSnapshot>;

const normalize = (fileName: string) => fileName.replace(/\\/g, '/');

/**
 * One TS LanguageService per tsconfig, with a hand-written `ts.LanguageServiceHost` instead of
 * `@volar/typescript`: Angular components are plain TS files, so no language plugins or script-id
 * mapping are needed. All invalidation state (snapshot cache, per-file edit counters,
 * projectVersion, root-set re-checks) lives in core's ProjectFileTracker, shared with React's
 * ComponentMetaProject. The `typescript` module is constructor-injected; this package depends on
 * it only as a type.
 */
export class AngularComponentMetaProject implements ComponentMetaProjectBase {
  private readonly ls: ts.LanguageService;
  /** Invalidation state machine; the host hooks below delegate to it. */
  private readonly files: ProjectFileTracker<ts.IScriptSnapshot>;

  constructor(
    private typescript: typeof ts,
    private commandLine: ts.ParsedCommandLine,
    public readonly configFileName: string | undefined,
    /** Shared snapshot cache owned by AngularComponentMetaManager; all reads go via the tracker. */
    fsFileSnapshots: FsFileSnapshots = new Map(),
    getCommandLineFn?: () => ts.ParsedCommandLine,
    /**
     * Shared by AngularComponentMetaManager so projects with matching compiler options reuse
     * parsed+bound SourceFiles. The snapshot cache above dedupes the file *reads*, not the ASTs:
     * without a shared registry each LanguageService re-parses lib.d.ts, Angular's types and
     * node_modules from scratch.
     */
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
    const host: ts.LanguageServiceHost = {
      // Project references are deliberately NOT surfaced (matching React's host): honoring them
      // makes TS drop files owned by a referenced project from this program, so hybrid tsconfigs
      // (include + references, e.g. a root config referencing tsconfig.lib/storybook configs)
      // lose exactly the component files the reference owns - even after ensureFiles. Docgen
      // wants the flat view: include matches + ensured files + whatever their imports reach.
      getCompilationSettings: () => this.commandLine.options,
      // getProjectVersion gates the language service's host re-sync: script names, versions, and
      // snapshots are only re-read when this string moves, so every invalidation funnels through
      // the tracker into a projectVersion bump.
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
      // Without realpath TS cannot dedupe symlinked packages (pnpm/Nx workspaces), splitting type
      // identities across the symlink and real paths.
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

  // ---------------------------------------------------------------------------
  // Project management
  // ---------------------------------------------------------------------------

  /**
   * Batch-add files to the project's root set (inferred projects and on-demand inclusion). Bumps
   * projectVersion once for the whole batch to avoid repeated program rebuilds.
   */
  ensureFiles(fileNames: string[]): void {
    this.files.ensureFiles(fileNames);
  }

  hasSourceFile(fileName: string): boolean {
    return !!this.ls.getProgram()?.getSourceFile(normalize(fileName));
  }

  /**
   * Non-node_modules source file paths of the current program, for the manager's directory
   * watching.
   */
  getSourceFilePaths(): string[] {
    const program = this.ls.getProgram();
    if (!program) {
      return [];
    }
    return filterSourceFilePaths(program.getSourceFiles().map((sourceFile) => sourceFile.fileName));
  }

  onFilesChanged(changes: FileChange[]): void {
    // Membership probe against the pre-event program; captured once so the batch cannot rebuild
    // the program mid-loop.
    const program = this.ls.getProgram();
    this.files.onFilesChanged(changes, (fileName) => !!program?.getSourceFile(fileName));
  }

  // ---------------------------------------------------------------------------
  // Extraction
  // ---------------------------------------------------------------------------

  /**
   * Analyze `componentPath` and pick the class record the story's import names point at:
   * `exportName` match first, then the default-exported class when `exportName` is `'default'`,
   * then `localName`, then the module's export symbols (which follows barrel re-exports to the
   * defining file). The returned `json` carries every record of the analyzed file plus referenced
   * enums/typealiases, so the arg-types extractor's by-name lookups work.
   */
  extract(
    componentPath: string,
    names: { exportName: string; localName?: string }
  ): AngularComponentMetaResult | undefined {
    const fileName = normalize(componentPath);

    // Freshness guard: an extraction can land inside the watcher's debounce window, and the
    // story-docs provider runs with no watcher at all, so the component's own mtime is checked
    // before anything reads it.
    this.files.ensureFresh([fileName]);

    let program = this.ls.getProgram();
    let sourceFile = program?.getSourceFile(fileName);
    if (!sourceFile) {
      // The file may not be in the root set yet (inferred project, or a component outside the
      // tsconfig's include). Add it and rebuild before giving up.
      this.ensureFiles([fileName]);
      program = this.ls.getProgram();
      sourceFile = program?.getSourceFile(fileName);
    }
    if (!program || !sourceFile) {
      return undefined;
    }

    // Base classes and referenced enums/aliases sit in the files the component imports, so those
    // get the same check - and nothing else. A sweep over every cached snapshot instead costs one
    // stat per project file on every single component, which dominates a whole-project docgen run.
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

  /**
   * Resolves the requested name through the module's export symbols when no local class record
   * matches: barrels (`export * from './x'`, `export { X } from './x'`, aliased spellings) and
   * `export { X as default }`. `getAliasedSymbol` resolves the whole re-export chain in one step,
   * so cyclic re-exports cannot loop. When the class is defined in another file, that file's
   * analysis becomes the result (entry and `json` alike).
   */
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

/**
 * The project files an extraction of `entry` can read: the file itself plus everything its imports
 * and re-exports reach, transitively. `node_modules` is the boundary - a dependency's sources do
 * not change under a running dev server, and walking in would pull in the whole dependency graph.
 *
 * Only static top-level `import`/`export ... from` is followed, which is what Angular sources use
 * to reach a base class or a referenced enum. A `require`-style import or a lazy `import()` inside
 * a function body is not part of the closure.
 */
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

/**
 * Each AngularFileMeta array holds the record kind its name says (the analyzer dispatches by
 * decorator), but AngularClassMeta is a union across all kinds, so narrowing to CompodocJson's
 * per-kind arrays needs this cast.
 */
const toCompodocJson = (fileMeta: AngularFileMeta): CompodocJson =>
  fileMeta as unknown as CompodocJson;

function findDefaultExportedClassName(
  typescript: typeof ts,
  sourceFile: ts.SourceFile
): string | undefined {
  for (const statement of sourceFile.statements) {
    // `export default class Foo {}`
    if (
      typescript.isClassDeclaration(statement) &&
      statement.name &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === typescript.SyntaxKind.DefaultKeyword
      )
    ) {
      return statement.name.text;
    }
    // `class Foo {} export default Foo;`
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
