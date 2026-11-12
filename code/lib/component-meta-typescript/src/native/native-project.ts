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
import { NativeFacades } from './native-facades.ts';
import type { NativeDocgenTypeScript } from './native-typescript.ts';

export interface NativeCommandLine extends ProjectCommandLine {
  options: RawCompilerOptions;
}

export abstract class NativeProject implements ComponentMetaProjectBase {
  private snapshot: Snapshot;
  private project: Project<SyntheticProjectId>;
  private rootFiles: Set<string>;
  private moduleResolver?: ModuleResolver;
  private facades?: NativeFacades;
  private fileMtimes = new Map<string, number | undefined>();
  private readonly createdAt = Date.now();
  protected disposed = false;

  constructor(
    private readonly api: API,
    protected readonly typescript: NativeDocgenTypeScript,
    private commandLine: NativeCommandLine,
    readonly configFileName: string | undefined,
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

  protected ensureFresh(fileNames: string[]): boolean {
    const changed: string[] = [];
    const mtimes = new Map<string, number | undefined>();
    for (const fileName of new Set(fileNames)) {
      const mtime = modifiedTime(fileName);
      const stale = this.fileMtimes.has(fileName)
        ? this.fileMtimes.get(fileName) !== mtime
        : mtime !== undefined && mtime > this.createdAt;
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
