import { isInNodeModules, slash } from '../shared/utils/paths.ts';
import type { FileChange, ProjectFileSystem } from './types.ts';

export type FileSnapshotCache<Snapshot> = Map<string, [number | undefined, Snapshot | undefined]>;

/** Normalize program file paths and drop node_modules, for the manager's directory watching. */
export function filterSourceFilePaths(fileNames: readonly string[]): string[] {
  return fileNames.map(slash).filter((fileName) => !isInNodeModules(fileName));
}

export class ProjectFileTracker<Snapshot> {
  private projectVersion = 0;
  private shouldCheckRootFiles = false;
  private readonly fileVersions = new Map<string, number>();

  constructor(
    private readonly fs: ProjectFileSystem,
    private readonly commandLine: { fileNames: string[] },
    private readonly snapshots: FileSnapshotCache<Snapshot>,
    private readonly createSnapshot: (text: string) => Snapshot,
    private readonly getCommandLineFn?: () => { fileNames: string[] }
  ) {}

  getProjectVersion(): string {
    this.checkRootFilesUpdate();
    return this.projectVersion.toString();
  }

  getScriptFileNames(): string[] {
    this.checkRootFilesUpdate();
    return this.commandLine.fileNames;
  }

  getScriptVersion(fileName: string): string {
    const normalized = slash(fileName);
    const edits = this.fileVersions.get(normalized) ?? 0;
    const cached = this.snapshots.get(normalized);
    if (cached) {
      // Mtime of the cached snapshot; deliberately no stat here. Freshness is driven by the watch
      // layer and ensureFresh deleting entries, keeping program syncs free of per-file fs churn.
      return `${edits}:${cached[0] ?? 0}`;
    }
    return `${edits}:${this.fs.sys.getModifiedTime?.(normalized)?.valueOf() ?? 0}`;
  }

  /** Mtime-checked read-through: re-reads the file only when its mtime moved or was evicted. */
  getSnapshot(fileName: string): Snapshot | undefined {
    const normalized = slash(fileName);
    const modifiedTime = this.fs.sys.getModifiedTime?.(normalized)?.valueOf();
    const cache = this.snapshots.get(normalized);
    if (!cache || cache[0] !== modifiedTime) {
      const text = this.fs.sys.fileExists(normalized)
        ? this.fs.sys.readFile(normalized)
        : undefined;
      this.snapshots.set(normalized, [
        modifiedTime,
        text !== undefined ? this.createSnapshot(text) : undefined,
      ]);
    }
    return this.snapshots.get(normalized)?.[1];
  }

  /**
   * Batch-add files to the project's root set (inferred projects and on-demand inclusion). Bumps
   * projectVersion once for the whole batch to avoid repeated program rebuilds.
   */
  ensureFiles(fileNames: string[]): void {
    let added = false;
    for (const fileName of fileNames) {
      const normalized = slash(fileName);
      if (!this.commandLine.fileNames.includes(normalized)) {
        this.commandLine.fileNames.push(normalized);
        added = true;
      }
    }
    if (added) {
      this.projectVersion++;
    }
  }

  onFilesChanged(changes: FileChange[], isTracked: (fileName: string) => boolean): boolean {
    for (const { filePath } of changes) {
      const fileName = slash(filePath);
      this.snapshots.delete(fileName);
      this.bumpFileVersion(fileName);
    }

    const oldVersion = this.projectVersion;
    for (const { filePath, type } of changes) {
      const fileName = slash(filePath);
      if (type === 'changed') {
        if (isTracked(fileName)) {
          this.projectVersion++;
        }
      } else {
        this.projectVersion++;
        this.shouldCheckRootFiles = true;
      }
    }
    return this.projectVersion !== oldVersion;
  }

  ensureFresh(fileNames: string[]): boolean {
    let stale = false;
    for (const fileName of fileNames) {
      const normalized = slash(fileName);
      const cache = this.snapshots.get(normalized);
      if (!cache) {
        continue;
      }
      const currentMtime = this.fs.sys.getModifiedTime?.(normalized)?.valueOf();
      if (cache[0] !== currentMtime) {
        this.snapshots.delete(normalized);
        this.bumpFileVersion(normalized);
        stale = true;
      }
    }
    if (stale) {
      this.projectVersion++;
    }
    return stale;
  }

  private bumpFileVersion(fileName: string): void {
    this.fileVersions.set(fileName, (this.fileVersions.get(fileName) ?? 0) + 1);
  }

  private checkRootFilesUpdate(): void {
    if (!this.shouldCheckRootFiles) {
      return;
    }
    this.shouldCheckRootFiles = false;

    if (!this.getCommandLineFn) {
      return;
    }
    const newFileNames = this.getCommandLineFn().fileNames.map(slash);
    if (!arrayItemsEqual(newFileNames, this.commandLine.fileNames)) {
      this.commandLine.fileNames = newFileNames;
      this.projectVersion++;
    }
  }
}

// Adapted from the root-file-set comparison in @volar/kit's createChecker.
function arrayItemsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }
  const set = new Set(a);
  for (const file of b) {
    if (!set.has(file)) {
      return false;
    }
  }
  return true;
}
