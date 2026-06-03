import { writeFile } from 'node:fs/promises';

import { join, normalize } from 'pathe';

import { getProjectRoot } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { Presets } from 'storybook/internal/types';

import type { StoryIndex } from '../../../../../types/modules/indexer.ts';
import { ModuleGraphFailureError } from '../errors.ts';
import { getModuleGraphLifecycleConsumer } from '../lifecycle-consumer.ts';
import { getStoryIdsByAbsolutePath } from '../story-files.ts';
import { reverseIndexToStoriesByFile } from '../types.ts';
import type { ChangeDetectionAdapter, FileChangeEvent } from './adapters/types.ts';
import { DependencyGraphBuilder } from './dependency-graph/dependency-graph-builder.ts';
import { IncrementalPatcher } from './dependency-graph/incremental-patcher.ts';
import { ParseResolveCache } from './dependency-graph/parse-resolve-cache.ts';
import { ChangeDetectionResolverFactory } from './dependency-graph/resolver-factory.ts';
import type { DependencyGraph } from './dependency-graph/types.ts';
import type { ReverseIndexImpl } from './dependency-graph/reverse-index.ts';
import { builtinImportParsers } from './parser-registry/builtins.ts';
import { ParserRegistry } from './parser-registry/parser-registry.ts';
import type { ImportParser } from './parser-registry/types.ts';

export interface ModuleGraphEngineOptions {
  getIndex: () => Promise<StoryIndex>;
  workingDir?: string;
  /** Presets instance used to resolve `experimental_importParsers` contributions from plugins. */
  presets?: Presets;
  /** Fired once the initial graph build succeeds and the reverse index is ready to be queried. */
  onReady?: () => void;
  /**
   * Edge-triggered "the dependency graph may have changed; recompute derived state" signal. Fires
   * after each settled file-change patch, and synchronously on a story-index invalidation (before
   * its reconciliation patches are enqueued). It is a coalesce signal, NOT a settled read: do not
   * call {@link ModuleGraphEngine.lookup} synchronously inside the callback — schedule a
   * (debounced) recompute whose first step is `await whenSettled()`. May fire more than once per
   * logical change, so consumers must be idempotent.
   */
  onChange?: () => void;
  /** Fired when the eager build (or start pipeline) fails irrecoverably. */
  onError?: (error: Error) => void;
  /** Fired when the builder adapter reports a startup failure. */
  onUnavailable?: (reason: string, error?: Error) => void;
  /** Mirrors the built reverse index into the `core/module-graph` open service. */
  onSnapshot?: (storiesByFile: ReturnType<typeof reverseIndexToStoriesByFile>) => void;
  /** Mirrors state after each settled patch; includes story files whose graph may have changed. */
  onUpdate?: (payload: {
    storiesByFile: ReturnType<typeof reverseIndexToStoriesByFile>;
    bumpedStoryFiles: string[];
  }) => void;
}

/**
 * Owns the module dependency graph: it consumes a builder-supplied {@link ChangeDetectionAdapter},
 * eagerly builds a reverse-dependency index from story files at startup, applies file-system events
 * incrementally to that index, and reconciles the story-root set when the story index changes.
 *
 * It is deliberately independent of git diffing, the status store, and the change-detection
 * readiness signal — those belong to the {@link ChangeDetectionService} status publisher (and, in
 * the future, other consumers such as server-side docgen). Consumers observe the graph through a
 * narrow surface: {@link lookup} for `changedFile -> affected stories`, {@link whenSettled} as a
 * patch-settle barrier, and lifecycle signals via {@link getModuleGraphLifecycleConsumer}.
 */
export class ModuleGraphEngine {
  private readonly workingDir: string;
  private adapter: ChangeDetectionAdapter | undefined;
  private dependencyGraphBuilder: DependencyGraphBuilder | undefined;
  private incrementalPatcher: IncrementalPatcher | undefined;
  private reverseIndex: ReverseIndexImpl | undefined;
  private storyFiles: Set<string> = new Set();
  private refreshInFlight = false;
  /**
   * Resolves once the in-flight story-index reconciliation has enqueued its add/unlink patches.
   * {@link whenSettled} awaits this before snapshotting {@link patchQueue}, so a barrier taken
   * while a reconciliation is still in `getIndex()` does not miss its patches (which would let a
   * later {@link lookup} observe a pre-reconciliation graph).
   */
  private refreshSettled: Promise<void> = Promise.resolve();
  /**
   * Serialises file-change patches so two events touching the same dep set never interleave
   * across `await` points inside `IncrementalPatcher.patch`. The chain ignores rejections
   * (each call's failure is logged in {@link handleFileChange}).
   */
  private patchQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: ModuleGraphEngineOptions) {
    this.workingDir = options.workingDir ?? process.cwd();
  }

  start(adapter: ChangeDetectionAdapter): void {
    this.adapter = adapter;

    void this.startInternal().catch((error) => {
      const failure = error instanceof Error ? error : new ModuleGraphFailureError(String(error));
      logger.error(`Module graph failed to start: ${failure.message}`);
      this.emitError(failure);
    });
  }

  private emitReady(): void {
    this.options.onReady?.();
    getModuleGraphLifecycleConsumer()?.onReady?.();
  }

  private emitChange(): void {
    this.options.onChange?.();
    getModuleGraphLifecycleConsumer()?.onChange?.();
  }

  private emitError(error: Error): void {
    this.options.onError?.(error);
    getModuleGraphLifecycleConsumer()?.onError?.(error);
  }

  private emitUnavailable(reason: string, error?: Error): void {
    this.options.onUnavailable?.(reason, error);
    getModuleGraphLifecycleConsumer()?.onUnavailable?.(reason, error);
  }

  private mirrorSnapshot(): void {
    if (!this.reverseIndex) {
      return;
    }
    this.options.onSnapshot?.(reverseIndexToStoriesByFile(this.reverseIndex.asMap()));
  }

  private mirrorUpdate(changedFile: string): void {
    if (!this.reverseIndex) {
      return;
    }
    const normalized = normalize(changedFile);
    const bumpedStoryFiles = new Set<string>();
    for (const [storyFile] of this.reverseIndex.lookup(normalized)) {
      bumpedStoryFiles.add(storyFile);
    }
    if (this.storyFiles.has(normalized)) {
      bumpedStoryFiles.add(normalized);
    }
    this.options.onUpdate?.({
      storiesByFile: reverseIndexToStoriesByFile(this.reverseIndex.asMap()),
      bumpedStoryFiles: [...bumpedStoryFiles],
    });
  }

  /**
   * Returns the per-story breadth-first-search depth map for `dep`. Depth is the shortest number of
   * import edges from the changed file to each affected story. Empty map if `dep` is unknown or
   * unbuilt.
   */
  lookup(dep: string): Map<string, number> {
    return this.reverseIndex?.lookup(dep) ?? new Map<string, number>();
  }

  /** True once the initial build has produced a reverse index. */
  hasGraph(): boolean {
    return this.reverseIndex !== undefined;
  }

  /**
   * Read barrier. First awaits any in-flight story-index reconciliation so its add/unlink patches
   * are enqueued, then snapshots the current tail of {@link patchQueue} (rather than re-reading the
   * live field, so a continuous stream of file events cannot livelock the awaiter) and awaits it.
   * When it resolves, every patch enqueued as of this call — including that reconciliation — has
   * fully settled.
   *
   * This is a point-in-time barrier, not a freeze: file events arriving after the snapshot enqueue
   * patches this call does not await, so a {@link lookup} taken after any further `await` may
   * observe a newer (still non-mid-patch) graph. For a read pinned to this barrier, call
   * {@link lookup} immediately after this resolves with no intervening `await`. Each new event
   * re-fires {@link onChange}, so coalescing consumers converge without holding this barrier open.
   */
  async whenSettled(): Promise<void> {
    // Phase 1: let any in-flight story-index reconciliation enqueue its add/unlink patches, so the
    // tail snapshot below includes them.
    await this.refreshSettled.catch(() => undefined);
    // Phase 2: drain the patch chain, including any patches phase 1 just enqueued.
    const tail = this.patchQueue;
    await tail.catch(() => undefined);
  }

  /**
   * Builds parser registry, resolver, dependency graph, and patcher; subscribes to file-change
   * events queued behind {@link patchQueue}; then signals readiness via {@link onReady}.
   */
  private async startInternal(): Promise<void> {
    const adapter = this.adapter;
    if (!adapter) {
      return;
    }

    const resolveConfig = await adapter.getResolveConfig();
    const projectRoot = normalize(resolveConfig.projectRoot ?? this.workingDir);

    const pluginParsers = this.options.presets
      ? await this.options.presets.apply<ImportParser[]>('experimental_importParsers', [])
      : [];
    const registry = new ParserRegistry({
      defaultParsers: builtinImportParsers,
      pluginParsers,
    });
    const resolver = new ChangeDetectionResolverFactory(resolveConfig);
    const workspaceRoots = new Set<string>([normalize(getProjectRoot())]);

    const storyIndex = await this.options.getIndex();
    const storyIdsByFile = getStoryIdsByAbsolutePath(storyIndex, this.workingDir);
    this.storyFiles = new Set(storyIdsByFile.keys());

    // Shared parse/resolve cache so the patcher reuses cold-start results instead of
    // re-doing every file's parse + resolution on the first event after boot. The patcher
    // invalidates per-file entries on every change/unlink before reading.
    const debugEnv = process.env.STORYBOOK_CHANGE_DETECTION_DEBUG;
    const cache = new ParseResolveCache({
      registry,
      resolver,
      workspaceRoots,
      projectRoot,
      logger,
      debug: !!debugEnv,
    });

    this.dependencyGraphBuilder = new DependencyGraphBuilder({
      registry,
      resolver,
      workspaceRoots,
      projectRoot,
      cache,
    });

    // Subscribe BEFORE build — buffer events until patcher is ready
    const eventBuffer: FileChangeEvent[] = [];
    const unsubscribeBuffer = adapter.onFileChange((event) => {
      eventBuffer.push(event);
    });

    const { reverseIndex, graph } = await this.dependencyGraphBuilder.build(this.storyFiles);
    this.reverseIndex = reverseIndex;
    void this.dumpDebugSnapshot(reverseIndex, graph, projectRoot, workspaceRoots, cache);

    this.incrementalPatcher = new IncrementalPatcher({
      reverseIndex,
      graph,
      registry,
      resolver,
      workspaceRoots,
      projectRoot,
      cache,
      isStoryFile: (path: string) => this.storyFiles.has(normalize(path)),
    });

    // Drain buffered events into patchQueue, then switch to live handler
    unsubscribeBuffer();
    for (const event of eventBuffer) {
      this.patchQueue = this.patchQueue
        .then(() => this.handleFileChange(event))
        .catch(() => undefined);
    }

    adapter.onFileChange((event) => {
      this.patchQueue = this.patchQueue
        .then(() => this.handleFileChange(event))
        .catch(() => undefined);
    });

    adapter.onStartupFailure?.((event) => {
      this.emitUnavailable(event.reason, event.error);
    });

    this.mirrorSnapshot();
    this.emitReady();
  }

  onStoryIndexInvalidated(): void {
    // Single-flight: a reconciliation already running will pick up this invalidation's changes when
    // its getIndex() reads the (already-nulled) index cache, so we don't start a second. Track the
    // running reconciliation in refreshSettled so whenSettled() can wait for it to enqueue its
    // add/unlink patches before snapshotting the patch tail. The guard lives here (not inside
    // refreshStoryFiles) so a dropped second invalidation can't overwrite refreshSettled with a
    // resolved no-op and let the barrier skip the real in-flight reconciliation.
    if (!this.refreshInFlight && this.incrementalPatcher) {
      this.refreshInFlight = true;
      this.refreshSettled = this.refreshStoryFiles()
        .catch(() => undefined)
        .finally(() => {
          this.refreshInFlight = false;
        });
    }
    // The story index changed even when no story files were added/removed (e.g. a story renamed
    // within a file); signal consumers so derived state is recomputed.
    this.emitChange();
  }

  /**
   * Re-reads the story index and reconciles {@link storyFiles} with stories that have appeared or
   * disappeared since startup. For each story that newly entered the index, the patcher is asked
   * to walk it (so its forward edges are recorded). For each story that left the index, the
   * patcher is asked to unlink it (so its reverse-index entries are pruned). Replays are queued
   * behind {@link patchQueue} to keep the serialised-patch invariant intact.
   *
   * Single-flight is enforced by the sole caller, {@link onStoryIndexInvalidated}, which also
   * exposes this run via {@link refreshSettled} so {@link whenSettled} can wait for the add/unlink
   * patches to be enqueued.
   */
  private async refreshStoryFiles(): Promise<void> {
    const storyIndex = await this.options.getIndex();
    const storyIdsByFile = getStoryIdsByAbsolutePath(storyIndex, this.workingDir);
    const next = new Set(storyIdsByFile.keys());
    const previous = this.storyFiles;

    const added: string[] = [];
    for (const path of next) {
      if (!previous.has(path)) {
        added.push(path);
      }
    }
    const removed: string[] = [];
    for (const path of previous) {
      if (!next.has(path)) {
        removed.push(path);
      }
    }

    if (added.length === 0 && removed.length === 0) {
      return;
    }

    this.storyFiles = next;

    for (const path of added) {
      this.patchQueue = this.patchQueue
        .then(() => this.handleFileChange({ kind: 'add', path }))
        .catch(() => undefined);
    }
    for (const path of removed) {
      this.patchQueue = this.patchQueue
        .then(() => this.handleFileChange({ kind: 'unlink', path }))
        .catch(() => undefined);
    }
  }

  private async dumpDebugSnapshot(
    reverseIndex: ReverseIndexImpl,
    graph: DependencyGraph,
    projectRoot: string,
    workspaceRoots: Set<string>,
    cache: ParseResolveCache
  ): Promise<void> {
    const debugEnv = process.env.STORYBOOK_CHANGE_DETECTION_DEBUG;
    if (!debugEnv) {
      return;
    }
    const outPath =
      debugEnv === '1' || debugEnv === 'true'
        ? join(projectRoot, 'storybook-graph-debug.json')
        : debugEnv;

    const graphObj: Record<string, string[]> = {};
    for (const [story, deps] of graph) {
      graphObj[story] = Array.from(deps).sort();
    }

    const reverseObj: Record<string, Array<{ story: string; depth: number }>> = {};
    for (const [dep, stories] of reverseIndex.asMap()) {
      reverseObj[dep] = Array.from(stories.entries())
        .map(([story, depth]) => ({ story, depth }))
        .sort((a, b) => a.depth - b.depth || a.story.localeCompare(b.story));
    }

    const snapshot = {
      timestamp: new Date().toISOString(),
      projectRoot,
      workspaceRoots: Array.from(workspaceRoots).sort(),
      // `graph` is keyed by every walked node (story roots + their transitive deps),
      // and `reverseIndex` records each story root at depth 0 alongside real deps —
      // so `graph.size` / `reverseIndex.asMap().size` over-report story and dep totals.
      // Report `storyFiles` from the authoritative source-of-truth set, plus the raw
      // node/entry counts under unambiguous names for diagnostics.
      storyFiles: this.storyFiles.size,
      graphNodes: graph.size,
      reverseIndexEntries: reverseIndex.asMap().size,
      graph: graphObj,
      reverseIndex: reverseObj,
      // Each entry records one named-import barrel lookup: which names were requested,
      // which source files they resolved to, and whether the barrel itself was also
      // included (needBarrel: true means at least one name fell back to the barrel).
      barrelResolutions: cache.getBarrelTrace() ?? [],
    };

    try {
      await writeFile(outPath, JSON.stringify(snapshot, null, 2), 'utf8');
      logger.debug(`Change detection: graph debug snapshot written to ${outPath}`);
    } catch (error) {
      logger.warn(
        `Change detection: failed to write debug snapshot to ${outPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleFileChange(event: FileChangeEvent): Promise<void> {
    if (!this.incrementalPatcher) {
      return;
    }
    try {
      await this.incrementalPatcher.patch(event);
    } catch (error) {
      logger.warn(
        `Change detection: failed to apply ${event.kind} for ${event.path}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    this.mirrorUpdate(event.path);
    this.emitChange();
  }
}
