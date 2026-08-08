/**
 * The invalidation state machine shared by renderer component-meta projects. A project (one
 * language service per tsconfig; React hosts it via Volar, Angular hand-writes the host) delegates
 * every freshness decision here: the mtime-keyed snapshot cache, per-file edit counters, the
 * projectVersion gate, lazy root-set re-checks, and the targeted ensureFresh guard. The language
 * service itself stays in the renderer - core never names types from the `typescript` package (see
 * ./types.ts), so snapshots are an opaque generic and the fs surface is structural.
 */
import type { FileChange, ProjectFileSystem } from './types.ts';

/**
 * Mtime-keyed snapshot cache shared across every project of one manager (Volar Kit checker
 * pattern); owned by the manager's factory so it dies with the manager.
 */
export type FileSnapshotCache<Snapshot> = Map<string, [number | undefined, Snapshot | undefined]>;

const normalize = (fileName: string) => fileName.replace(/\\/g, '/');

/** Matches a whole `node_modules` path segment, so `src/node_modules-tools/Tag.tsx` is kept. */
const NODE_MODULES_SEGMENT = /(?:^|\/)node_modules(?:\/|$)/;

/** Normalize program file paths and drop node_modules, for the manager's directory watching. */
export function filterSourceFilePaths(fileNames: readonly string[]): string[] {
  return fileNames.map(normalize).filter((fileName) => !NODE_MODULES_SEGMENT.test(fileName));
}

/**
 * Every public entry point normalizes its path argument to forward slashes, so `snapshots`,
 * `fileVersions` and the fs probes are all keyed the same way. Watcher events and the story and
 * component paths Storybook hands down can carry Windows backslashes, while TypeScript always uses
 * forward slashes, and the two meet in this cache.
 */
export class ProjectFileTracker<Snapshot> {
  private projectVersion = 0;
  private shouldCheckRootFiles = false;
  /**
   * Per-file edit counters folded into getScriptVersion. Mtime alone violates the LS host version
   * contract: a rewrite landing within the same mtime tick keeps the version string unchanged, so
   * the DocumentRegistry would pin the old AST forever. Every reported change and every ensureFresh
   * eviction bumps here.
   */
  private readonly fileVersions = new Map<string, number>();

  constructor(
    private readonly fs: ProjectFileSystem,
    /**
     * The project's parsed command line, held by reference: root-set updates assign
     * `commandLine.fileNames` in place so the owning project observes them without copies. Its names
     * arrive already normalized, from `parseTsconfigCommandLine`.
     */
    private readonly commandLine: { fileNames: string[] },
    private readonly snapshots: FileSnapshotCache<Snapshot>,
    private readonly createSnapshot: (text: string) => Snapshot,
    private readonly getCommandLineFn?: () => { fileNames: string[] }
  ) {}

  /**
   * The language service's host re-sync gate: script names, versions, and snapshots are only
   * re-read when this string moves, so every invalidation below funnels into a projectVersion
   * bump.
   */
  getProjectVersion(): string {
    this.checkRootFilesUpdate();
    return this.projectVersion.toString();
  }

  getScriptFileNames(): string[] {
    this.checkRootFilesUpdate();
    return this.commandLine.fileNames;
  }

  getScriptVersion(fileName: string): string {
    const normalized = normalize(fileName);
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
    const normalized = normalize(fileName);
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
      const normalized = normalize(fileName);
      if (!this.commandLine.fileNames.includes(normalized)) {
        this.commandLine.fileNames.push(normalized);
        added = true;
      }
    }
    if (added) {
      this.projectVersion++;
    }
  }

  /**
   * Broadcast handler for watcher events. Snapshots for every reported path are evicted (and their
   * edit counters bumped) before any version decision, so a batch stays coherent. `changed` bumps
   * projectVersion only when the program holds the file (per `isTracked`, which callers capture
   * against the pre-event program); created/deleted always bump - a new or removed file can change
   * module resolution even when the root set is unchanged - and additionally schedule a lazy
   * root-set re-check.
   *
   * Returns whether projectVersion moved, so callers can chain renderer-specific reactions (e.g.
   * React's background warmup re-extraction).
   */
  onFilesChanged(changes: FileChange[], isTracked: (fileName: string) => boolean): boolean {
    for (const { filePath } of changes) {
      const fileName = normalize(filePath);
      this.snapshots.delete(fileName);
      this.bumpFileVersion(fileName);
    }

    const oldVersion = this.projectVersion;
    for (const { filePath, type } of changes) {
      const fileName = normalize(filePath);
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

  /**
   * Targeted mtime check right before extraction. The projectVersion gate only re-reads files when
   * the version moves, so this covers the race where an extraction lands before the debounced
   * fs.watch event (or the event was missed entirely).
   *
   * Costs one stat per name, so callers pass the files their work actually reads rather than
   * everything cached. Returns whether projectVersion moved, so a caller holding a program built
   * before the sweep knows to re-read it.
   */
  ensureFresh(fileNames: string[]): boolean {
    let stale = false;
    for (const fileName of fileNames) {
      const normalized = normalize(fileName);
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
    const newCommandLine = this.getCommandLineFn();
    if (!arrayItemsEqual(newCommandLine.fileNames, this.commandLine.fileNames)) {
      this.commandLine.fileNames = newCommandLine.fileNames;
      this.projectVersion++;
    }
  }
}

// Adapted from:
// https://github.com/volarjs/volar.js/blob/882cd56d46a13d272f34e451f495d3d62251969a/packages/kit/lib/createChecker.ts#L450-L461
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
