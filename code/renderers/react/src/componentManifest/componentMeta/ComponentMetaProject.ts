/**
 * One TypeScript LanguageService per tsconfig, built on the checker and project-host patterns from
 * `@volar/typescript`. Freshness is not decided here: the snapshot cache, projectVersion gate and
 * root-set re-checks all live in core's `ProjectFileTracker`, which the Angular analyzer shares.
 *
 * The extraction itself is shared with the native-API project in `extract-entries.ts`; this class
 * only supplies the program and checker of the compiler API.
 */
import {
  type FileChange,
  type FileSnapshotCache,
  ProgramBackedProject,
  ProjectFileTracker,
} from 'storybook/internal/component-meta';

import { FileMap, createLanguage } from '@volar/language-core';
import {
  type TypeScriptProjectHost,
  createLanguageServiceHost,
  resolveFileLanguageId,
} from '@volar/typescript';
import * as path from 'path';
import type ts from 'typescript';

import type { StoryRef } from '../getComponentImports.ts';
import {
  type DocgenTypeScript,
  createCompilerDocgenTypeScript,
} from '@storybook/component-meta-typescript';
import { extractEntries } from './extract-entries.ts';

/** What the manager drives on a project of either backend. */
export interface ReactComponentMetaProject {
  extractPropsFromStories(entries: StoryRef[]): void;
}

export class ComponentMetaProject
  extends ProgramBackedProject<ts.IScriptSnapshot, ts.SourceFile | undefined>
  implements ReactComponentMetaProject
{
  protected readonly service: ts.LanguageService;
  /** Invalidation state machine shared with the Angular component-meta project. */
  protected readonly files: ProjectFileTracker<ts.IScriptSnapshot>;
  private readonly docgenTypeScript: DocgenTypeScript;
  private warmupTimer?: ReturnType<typeof setTimeout>;
  /** Entries to extract - set by the generator, replayed during warmup for targeted type resolution. */
  private entries: StoryRef[] = [];

  constructor(
    private typescript: typeof ts,
    private commandLine: ts.ParsedCommandLine,
    public readonly configFileName: string | undefined,
    /** Shared snapshot cache owned by ComponentMetaManager. */
    fsFileSnapshots: FileSnapshotCache<ts.IScriptSnapshot> = new Map(),
    getCommandLineFn?: () => ts.ParsedCommandLine,
    /**
     * Shared by ComponentMetaManager so projects with matching compiler options reuse parsed+bound
     * SourceFiles. The snapshot cache above dedupes the file *reads*, not the ASTs: without a shared
     * registry each LanguageService re-parses lib.d.ts, React's types and node_modules from scratch.
     */
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

    // Adapted from the language construction in @volar/kit's createChecker.
    const language = createLanguage<string>(
      [{ getLanguageId: (fileName: string) => resolveFileLanguageId(fileName) }],
      new FileMap(typescript.sys.useCaseSensitiveFileNames),
      (fileName, includeFsFiles) => {
        if (!includeFsFiles) {
          return;
        }
        const snapshot = this.files.getSnapshot(fileName);
        if (snapshot) {
          language.scripts.set(fileName, snapshot);
        } else {
          language.scripts.delete(fileName);
        }
      }
    );

    // Adapted from the project host in @volar/kit's createChecker.
    const projectHost: TypeScriptProjectHost = {
      getCurrentDirectory: () =>
        configFileName
          ? path.dirname(configFileName)
          : (commandLine.options.rootDir ?? process.cwd()),
      getCompilationSettings: () => {
        return this.commandLine.options;
      },
      getProjectReferences: () => {
        return this.commandLine.projectReferences;
      },
      // getProjectVersion gates the language service's host re-sync; the tracker funnels every
      // invalidation into it.
      getProjectVersion: () => this.files.getProjectVersion(),
      getScriptFileNames: () => this.files.getScriptFileNames(),
    };

    // Adapted from @volar/typescript's createProject.
    const { languageServiceHost } = createLanguageServiceHost(
      typescript,
      typescript.sys,
      language,
      (s) => s, // asScriptId - identity for React (no URI mapping needed)
      projectHost
    );

    this.service = typescript.createLanguageService(languageServiceHost, this.documentRegistry);
  }

  getCommandLine(): ts.ParsedCommandLine {
    return this.commandLine;
  }

  // ---------------------------------------------------------------------------
  // Project management
  // ---------------------------------------------------------------------------

  /** Cancels the warmup the base does not know about. */
  override dispose(): void {
    clearTimeout(this.warmupTimer);
    super.dispose();
  }

  getSourceFile(fileName: string): ts.SourceFile | undefined {
    return this.service.getProgram()?.getSourceFile(fileName);
  }

  override onFilesChanged(changes: FileChange[]): void {
    // Membership probe against the pre-event program; captured once so the batch cannot rebuild
    // the program mid-loop.
    const program = this.service.getProgram();
    const versionMoved = this.files.onFilesChanged(
      changes,
      (fileName) => !!program?.getSourceFile(fileName)
    );

    // Targeted warmup: re-extract in the background so the next request is instant. Only the types
    // the stories actually need get resolved, and TypeScript caches those on the AST nodes, so the
    // real extraction that follows hits cached results.
    if (versionMoved && this.entries.length > 0) {
      clearTimeout(this.warmupTimer);
      this.warmupTimer = setTimeout(() => {
        try {
          this.extractPropsFromStories(this.entries);
        } catch {
          // Warmup failure is non-fatal - extraction will still work on demand.
        }
      }, 100);
      this.warmupTimer?.unref?.();
    }
  }

  extractPropsFromStories(entries: StoryRef[]): void {
    this.entries = entries;

    const allFiles = entries.flatMap((entry) =>
      entry.component?.path ? [entry.storyPath, entry.component.path] : [entry.storyPath]
    );
    this.files.ensureFiles(allFiles);
    this.files.ensureFresh(allFiles);

    const program = this.service.getProgram();
    if (!program) {
      return;
    }
    extractEntries(
      {
        typescript: this.docgenTypeScript,
        checker: program.getTypeChecker(),
        program,
        resolveModule: (importId, fromFile) =>
          this.typescript.resolveModuleName(
            importId,
            fromFile,
            this.commandLine.options,
            this.typescript.sys
          ).resolvedModule?.resolvedFileName,
      },
      entries
    );
  }
}
