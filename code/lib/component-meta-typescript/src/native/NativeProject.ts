import {
  type ComponentMetaProjectBase,
  type FileChange,
  type ProjectCommandLine,
  filterSourceFilePaths,
} from 'storybook/internal/component-meta';

import { statSync } from 'node:fs';

import { logger } from 'storybook/internal/node-logger';

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

import type { DocgenTypeChecker } from '../docgen-typescript.ts';
import { NativeFacades } from './native-checker.ts';
import type { NativeDocgenTypeScript } from './native-typescript.ts';

/** What a native project parses from a tsconfig: core's subset plus the options the program needs. */
export interface NativeCommandLine extends ProjectCommandLine {
  options: RawCompilerOptions;
}

/**
 * One native-API project per tsconfig: a program in the compiler process whose root set is the
 * tsconfig's files plus whatever extraction asks for. A file change becomes a new snapshot; the
 * docgen server runs without a watcher, so extraction also notifies the files whose mtime moved.
 */
export abstract class NativeProject implements ComponentMetaProjectBase {
  private snapshot: Snapshot;
  private project: Project<SyntheticProjectId>;
  private rootFiles: Set<string>;
  private moduleResolver?: ModuleResolver;
  // Belongs to the current snapshot, so its answers are cached until a file change replaces it.
  private facades?: NativeFacades;
  // Mtime of each file extraction read, to notify edits when no watcher runs.
  private fileMtimes = new Map<string, number | undefined>();
  // A file whose mtime is later changed after the first snapshot read it.
  private readonly readSince = Date.now();
  protected disposed = false;

  constructor(
    private readonly api: API,
    protected readonly typescript: NativeDocgenTypeScript,
    private commandLine: NativeCommandLine,
    readonly configFileName: string | undefined,
    // Re-parses the tsconfig, so created and deleted files update the root set.
    private readonly getCommandLineFn?: () => NativeCommandLine
  ) {
    this.rootFiles = new Set(commandLine.fileNames);
    this.snapshot = api.createSnapshot({
      createPrograms: [this.programParams(this.rootFiles, commandLine)],
    });
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
    return filterSourceFilePaths(this.project.program.getSourceFileNames());
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
    const rootFiles = new Set([...this.rootFiles, ...missing]);
    this.replaceSnapshot(
      this.snapshot.update({
        reconfigurePrograms: [this.reconfigureParams(rootFiles, this.commandLine)],
      })
    );
    this.rootFiles = rootFiles;
  }

  /**
   * Core calls this from the watcher's timer, so a failure is logged and the project keeps its
   * state: every method here changes it only after the compiler process accepted the snapshot.
   */
  onFilesChanged(changes: FileChange[]): void {
    if (this.disposed) {
      return;
    }
    try {
      if (this.applyFileChanges(changes)) {
        this.afterFilesChanged();
      }
    } catch (error) {
      logger.debug(`[component-meta] Ignoring file changes for ${this.configFileName}: ${error}`);
    }
  }

  protected afterFilesChanged(): void {}

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.moduleResolver?.dispose();
    this.snapshot.dispose();
  }

  /**
   * Notify the compiler process of the files whose mtime moved since they were last read, and
   * return whether any did.
   */
  protected ensureFresh(fileNames: string[]): boolean {
    const changed: string[] = [];
    const mtimes = new Map<string, number | undefined>();
    for (const fileName of new Set(fileNames)) {
      const mtime = modifiedTime(fileName);
      const stale = this.fileMtimes.has(fileName)
        ? this.fileMtimes.get(fileName) !== mtime
        : mtime !== undefined && mtime > this.readSince;
      if (stale) {
        changed.push(fileName);
      }
      mtimes.set(fileName, mtime);
    }
    if (changed.length > 0) {
      this.replaceSnapshot(
        this.snapshot.update({ fileNotifications: { changed }, ensurePrograms: true })
      );
    }
    for (const [fileName, mtime] of mtimes) {
      this.fileMtimes.set(fileName, mtime);
    }
    return changed.length > 0;
  }

  /**
   * The checker of the current snapshot. Its objects belong to that snapshot, so ask for it at the
   * start of every extraction rather than keeping it across file changes.
   */
  protected getChecker(): DocgenTypeChecker {
    this.facades ??= new NativeFacades(this.project, this.typescript);
    return this.facades.createChecker();
  }

  protected resolveModule(importId: string, fromFile: string): string | undefined {
    return this.getModuleResolver().resolveModuleName(importId, dirname(fromFile), undefined, {
      snapshot: this.snapshot,
    }).resolvedModule?.resolvedFileName;
  }

  private applyFileChanges(changes: FileChange[]): boolean {
    const byType = (type: FileChange['type']) =>
      changes.filter((change) => change.type === type).map((change) => change.filePath);
    const created = byType('created');
    const deleted = byType('deleted');
    const changed = byType('changed');
    const known = changes.some((change) => this.hasSourceFile(change.filePath));

    // A created or deleted file can change which files the tsconfig includes.
    let commandLine = this.commandLine;
    let rootFiles = this.rootFiles;
    if ((created.length > 0 || deleted.length > 0) && this.getCommandLineFn) {
      commandLine = this.getCommandLineFn();
      rootFiles = new Set([...this.rootFiles, ...commandLine.fileNames]);
      for (const fileName of deleted) {
        rootFiles.delete(fileName);
      }
    }
    const rootsChanged =
      rootFiles.size !== this.rootFiles.size ||
      [...rootFiles].some((fileName) => !this.rootFiles.has(fileName));

    // A changed file the program does not know, such as a stylesheet, changes nothing here. A
    // created one can be what a failed import was looking for.
    const reachesProgram = known || rootsChanged || created.length > 0;
    if (reachesProgram) {
      this.replaceSnapshot(
        this.snapshot.update({
          fileNotifications: { changed, created, deleted },
          reconfigurePrograms: rootsChanged
            ? [this.reconfigureParams(rootFiles, commandLine)]
            : undefined,
          ensurePrograms: true,
        })
      );
      for (const fileName of [...changed, ...created]) {
        this.fileMtimes.set(fileName, modifiedTime(fileName));
      }
      for (const fileName of deleted) {
        this.fileMtimes.delete(fileName);
      }
    }
    if (commandLine !== this.commandLine) {
      this.commandLine = commandLine;
      this.rootFiles = rootFiles;
      this.moduleResolver?.dispose();
      this.moduleResolver = undefined;
    }
    return reachesProgram;
  }

  private programParams(rootFiles: Set<string>, commandLine: NativeCommandLine) {
    const options: CreateProgramOptions = {
      projectReferences: commandLine.projectReferences?.map(({ path }) => ({ path })),
    };
    return { rootFiles: [...rootFiles], compilerOptions: commandLine.options, options };
  }

  private reconfigureParams(rootFiles: Set<string>, commandLine: NativeCommandLine) {
    return { id: this.project.id, ...this.programParams(rootFiles, commandLine) };
  }

  private getModuleResolver(): ModuleResolver {
    this.moduleResolver ??= this.api.createModuleResolver(this.commandLine.options);
    return this.moduleResolver;
  }

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
    this.facades = undefined;
    previous.dispose();
  }
}

const modifiedTime = (fileName: string): number | undefined => {
  try {
    return statSync(fileName).mtimeMs;
  } catch {
    return undefined;
  }
};
