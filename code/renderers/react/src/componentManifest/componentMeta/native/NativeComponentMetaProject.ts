/**
 * One native-API project per tsconfig: a program in the compiler process whose root set is the
 * tsconfig's files plus whatever extraction asks for, like the compiler-API project's
 * LanguageService host. A story's component can sit outside the tsconfig's include (a symlinked
 * directory resolves to its real path), so the root set has to grow on demand.
 *
 * The compiler process owns file versions and module resolution, so unlike the compiler-API
 * project there is no snapshot cache or file tracker here. A file change becomes a new snapshot
 * through `fileNotifications`, and the previous one is released.
 *
 * The extraction itself is shared with the compiler-API project in `extract-entries.ts`.
 */
import type {
  ComponentMetaProjectBase,
  FileChange,
  ProjectCommandLine,
} from 'storybook/internal/component-meta';

import { dirname } from 'pathe';
import type ts from 'typescript';
import type {
  API,
  CreateProgramOptions,
  ModuleResolver,
  Project,
  RawCompilerOptions,
  Snapshot,
  SyntheticProjectId,
} from 'typescript-native/sync';

import type { StoryRef } from '../../getComponentImports.ts';
import type { ReactComponentMetaProject } from '../ComponentMetaProject.ts';
import { extractEntries } from '../extract-entries.ts';
import { NativeFacades } from './native-checker.ts';
import type { NativeDocgenTypeScript } from './native-typescript.ts';

/** What the native factory parses from a tsconfig: core's subset plus the options the program needs. */
export interface NativeCommandLine extends ProjectCommandLine {
  options: RawCompilerOptions;
}

export class NativeComponentMetaProject
  implements ComponentMetaProjectBase, ReactComponentMetaProject
{
  private snapshot: Snapshot;
  private project: Project<SyntheticProjectId>;
  private rootFiles: Set<string>;
  private moduleResolver?: ModuleResolver;
  private warmupTimer?: ReturnType<typeof setTimeout>;
  /** Entries to extract - set by the generator, replayed during warmup for targeted type resolution. */
  private entries: StoryRef[] = [];
  private disposed = false;

  constructor(
    private readonly api: API,
    private readonly typescript: NativeDocgenTypeScript,
    private commandLine: NativeCommandLine,
    public readonly configFileName: string | undefined,
    /** Re-parses the tsconfig, so created and deleted files update the root set. */
    private readonly getCommandLineFn?: () => NativeCommandLine
  ) {
    this.rootFiles = new Set(commandLine.fileNames);
    this.snapshot = api.createSnapshot({ createPrograms: [this.programParams()] });
    const program = this.snapshot.operation.createdPrograms?.[0];
    if (!program) {
      this.snapshot.dispose();
      throw new Error(`TypeScript created no program for ${configFileName ?? 'inferred files'}`);
    }
    this.project = program.getProject();
  }

  getCommandLine(): NativeCommandLine {
    return this.commandLine;
  }

  hasSourceFile(fileName: string): boolean {
    return this.project.program.getSourceFile(fileName) !== undefined;
  }

  getSourceFilePaths(): string[] {
    return [...this.project.program.getSourceFileNames()];
  }

  getSourceFile(fileName: string): ts.SourceFile | undefined {
    return this.project.program.getSourceFile(fileName) as ts.SourceFile | undefined;
  }

  /** Add the files the program does not have to its root set. */
  ensureFiles(fileNames: string[]): void {
    const missing = fileNames.filter(
      (fileName) => !this.rootFiles.has(fileName) && !this.hasSourceFile(fileName)
    );
    if (missing.length === 0) {
      return;
    }
    for (const fileName of missing) {
      this.rootFiles.add(fileName);
    }
    this.replaceSnapshot(this.snapshot.update({ reconfigurePrograms: [this.reconfigureParams()] }));
  }

  onFilesChanged(changes: FileChange[]): void {
    const byType = (type: FileChange['type']) =>
      changes.filter((change) => change.type === type).map((change) => change.filePath);
    const created = byType('created');
    const deleted = byType('deleted');

    // A created or deleted file can change which files the tsconfig includes.
    let rootsChanged = false;
    if ((created.length > 0 || deleted.length > 0) && this.getCommandLineFn) {
      this.commandLine = this.getCommandLineFn();
      const roots = new Set([...this.rootFiles, ...this.commandLine.fileNames]);
      for (const fileName of deleted) {
        roots.delete(fileName);
      }
      rootsChanged = roots.size !== this.rootFiles.size;
      this.rootFiles = roots;
    }

    this.replaceSnapshot(
      this.snapshot.update({
        fileNotifications: { changed: byType('changed'), created, deleted },
        reconfigurePrograms: rootsChanged ? [this.reconfigureParams()] : undefined,
        ensurePrograms: true,
      })
    );

    // Targeted warmup: re-extract in the background so the next request is instant.
    if (this.entries.length > 0) {
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

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    clearTimeout(this.warmupTimer);
    this.moduleResolver?.dispose();
    this.snapshot.dispose();
  }

  extractPropsFromStories(entries: StoryRef[]): void {
    if (this.disposed) {
      return;
    }
    this.entries = entries;
    this.ensureFiles(
      entries.flatMap((entry) =>
        entry.component?.path ? [entry.storyPath, entry.component.path] : [entry.storyPath]
      )
    );

    const facades = new NativeFacades(this.project.checker, this.project);
    try {
      extractEntries(
        {
          typescript: this.typescript,
          checker: facades.createChecker(),
          program: { getSourceFile: (fileName) => this.getSourceFile(fileName) },
          resolveModule: (importId, fromFile) =>
            this.getModuleResolver().resolveModuleName(importId, dirname(fromFile), undefined, {
              snapshot: this.snapshot,
            }).resolvedModule?.resolvedFileName,
        },
        entries
      );
    } finally {
      this.typescript.releaseSourceFiles();
    }
  }

  private programParams() {
    const options: CreateProgramOptions = {
      projectReferences: this.commandLine.projectReferences?.map(({ path }) => ({ path })),
    };
    return { rootFiles: [...this.rootFiles], compilerOptions: this.commandLine.options, options };
  }

  private reconfigureParams() {
    return { id: this.project.id, ...this.programParams() };
  }

  private getModuleResolver(): ModuleResolver {
    this.moduleResolver ??= this.api.createModuleResolver(this.commandLine.options);
    return this.moduleResolver;
  }

  /** Move to the next snapshot and release the previous one; objects of the old one are stale. */
  private replaceSnapshot(next: Snapshot): void {
    const project = next.getProgram(this.project.id)?.getProject();
    if (!project) {
      next.dispose();
      throw new Error(
        `TypeScript dropped the program of ${this.configFileName ?? 'inferred files'}`
      );
    }
    const previous = this.snapshot;
    this.snapshot = next;
    this.project = project;
    previous.dispose();
  }
}
