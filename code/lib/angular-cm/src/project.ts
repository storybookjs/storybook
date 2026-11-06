import { slash } from 'storybook/internal/common';
import {
  type FileSnapshotCache,
  ProgramBackedProject,
  ProjectFileTracker,
} from 'storybook/internal/component-meta';

import * as path from 'node:path';

import type * as ts from 'typescript';
import {
  type DocgenTypeScript,
  createCompilerDocgenTypeScript,
} from '@storybook/component-meta-typescript';

import {
  type ComponentNames,
  debugExtraction,
  extractComponent,
  importClosure,
} from './extract-component.ts';
import type { AngularComponentMetaResult } from './types.ts';

export type FsFileSnapshots = FileSnapshotCache<ts.IScriptSnapshot>;

// The host is hand-written instead of Volar's because Angular components are plain TS files,
// needing no language plugins or script-id mapping.
export class AngularComponentMetaProject extends ProgramBackedProject<
  ts.IScriptSnapshot,
  ts.SourceFile | undefined
> {
  protected readonly service: ts.LanguageService;
  protected readonly files: ProjectFileTracker<ts.IScriptSnapshot>;
  private readonly docgenTypeScript: DocgenTypeScript;

  constructor(
    private typescript: typeof ts,
    private commandLine: ts.ParsedCommandLine,
    public readonly configFileName: string | undefined,
    fsFileSnapshots: FsFileSnapshots = new Map(),
    getCommandLineFn?: () => ts.ParsedCommandLine,
    private documentRegistry?: ts.DocumentRegistry
  ) {
    super();
    this.docgenTypeScript = createCompilerDocgenTypeScript(typescript);
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

  extract(componentPath: string, names: ComponentNames): AngularComponentMetaResult | undefined {
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
    if (
      this.files.ensureFresh(
        importClosure(this.docgenTypeScript, program.getTypeChecker(), sourceFile)
      )
    ) {
      program = this.service.getProgram();
      sourceFile = program?.getSourceFile(fileName);
      if (!program || !sourceFile) {
        this.debug(`${fileName} left the program while being refreshed`);
        return undefined;
      }
    }

    return extractComponent(
      this.docgenTypeScript,
      program.getTypeChecker(),
      sourceFile,
      names,
      (message) => this.debug(message)
    );
  }

  private debug(message: string): void {
    debugExtraction(this.configFileName, message);
  }
}
