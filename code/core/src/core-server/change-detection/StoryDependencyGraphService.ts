import { writeFile } from 'node:fs/promises';

import { join, normalize } from 'pathe';

import { getProjectRoot } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { disposeOxcParsePool } from 'storybook/internal/oxc-parser';
import type { Presets } from 'storybook/internal/types';

import type { StoryIndexGenerator } from '../utils/StoryIndexGenerator.ts';
import type { ChangeDetectionAdapter, FileChangeEvent } from './adapters/index.ts';
import {
  ChangeDetectionResolverFactory,
  DependencyGraphBuilder,
  IncrementalPatcher,
  ParseResolveCache,
} from './dependency-graph/index.ts';
import type { DependencyGraph, ReverseIndexImpl } from './dependency-graph/index.ts';
import { ChangeDetectionFailureError } from './errors.ts';
import type { ImportParser } from './parser-registry/index.ts';
import { ParserRegistry, builtinImportParsers } from './parser-registry/index.ts';
import { getStoryIdsByAbsolutePath } from './story-files.ts';

export interface StoryDependencyGraphServiceOptions {
  storyIndexGeneratorPromise: Promise<StoryIndexGenerator>;
  workingDir?: string;
  /** Presets instance used to resolve `experimental_importParsers` contributions from plugins. */
  presets?: Presets;
  /** Fired once the initial graph build succeeds and the reverse index is ready to be queried. */
  onReady?: () => void;
  /** Fired after each file-change patch settles, so consumers can recompute derived state. */
  onChange?: () => void;
  /** Fired when the eager build (or start pipeline) fails irrecoverably. */
  onError?: (error: Error) => void;
  /** Fired when the builder adapter reports a startup failure. */
  onUnavailable?: (reason: string, error?: Error) => void;
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
 * patch-settle barrier, and the lifecycle callbacks supplied at construction.
 */
export class StoryDependencyGraphService {
  private disposed = false;
  private readonly workingDir: string;
  private adapter: ChangeDetectionAdapter | undefined;
  private dependencyGraphBuilder: DependencyGraphBuilder | undefined;
  private incrementalPatcher: IncrementalPatcher | undefined;
  private reverseIndex: ReverseIndexImpl | undefined;
  private storyFiles: Set<string> = new Set();
  private refreshInFlight = false;
  /**
   * Serialises file-change patches so two events touching the same dep set never interleave
   * across `await` points inside `IncrementalPatcher.patch`. The chain ignores rejections
   * (each call's failure is logged in {@link handleFileChange}).
   */
  private patchQueue: Promise<void> = Promise.resolve();
  private unsubscribeFileChange: (() => void) | undefined;
  private unsubscribeStartupFailure: (() => void) | undefined;

  constructor(private readonly options: StoryDependencyGraphServiceOptions) {
    this.workingDir = options.workingDir ?? process.cwd();
  }

  start(adapter: ChangeDetectionAdapter): void {
    this.adapter = adapter;

    void this.startInternal().catch((error) => {
      if (this.disposed) {
        return;
      }
      const failure =
        error instanceof Error ? error : new ChangeDetectionFailureError(String(error));
      logger.error(`Change detection failed to start: ${failure.message}`);
      this.options.onError?.(failure);
      void this.dispose().catch(() => undefined);
    });
  }

  /** Returns the per-story BFS-depth map for `dep`. EMPTY map if `dep` is unknown or unbuilt. */
  lookup(dep: string): Map<string, number> {
    return this.reverseIndex?.lookup(dep) ?? new Map<string, number>();
  }

  /** True once the initial build has produced a reverse index. */
  hasGraph(): boolean {
    return this.reverseIndex !== undefined;
  }

  /**
   * Resolves once the patches enqueued up to the moment of the call have settled. Snapshots the
   * current tail of {@link patchQueue} (rather than re-reading the live field) so a continuous
   * stream of file events cannot livelock the awaiter. Reads against {@link lookup} taken after
   * this resolves observe a consistent, non-mid-patch reverse index.
   */
  async whenSettled(): Promise<void> {
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

    if (this.disposed) {
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

    const storyIndexGenerator = await this.options.storyIndexGeneratorPromise;
    const storyIndex = await storyIndexGenerator.getIndex();
    const storyIdsByFile = getStoryIdsByAbsolutePath(storyIndex, this.workingDir);
    this.storyFiles = new Set(storyIdsByFile.keys());

    if (this.disposed) {
      return;
    }

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
    this.unsubscribeFileChange = adapter.onFileChange((event) => {
      if (this.disposed) {
        return;
      }
      eventBuffer.push(event);
    });

    const { reverseIndex, graph } = await this.dependencyGraphBuilder.build(this.storyFiles);
    if (this.disposed) {
      return;
    }
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
    this.unsubscribeFileChange?.();
    for (const event of eventBuffer) {
      this.patchQueue = this.patchQueue
        .then(() => this.handleFileChange(event))
        .catch(() => undefined);
    }

    this.unsubscribeFileChange = adapter.onFileChange((event) => {
      if (this.disposed) {
        return;
      }
      this.patchQueue = this.patchQueue
        .then(() => this.handleFileChange(event))
        .catch(() => undefined);
    });

    if (adapter.onStartupFailure) {
      this.unsubscribeStartupFailure = adapter.onStartupFailure((event) => {
        if (this.disposed) {
          return;
        }
        this.options.onUnavailable?.(event.reason, event.error);
        void this.dispose();
      });
    }

    if (this.disposed) {
      return;
    }
    this.options.onReady?.();
  }

  onStoryIndexInvalidated(): void {
    if (this.disposed) {
      return;
    }
    void this.refreshStoryFiles().catch(() => undefined);
    // The story index changed even when no story files were added/removed (e.g. a story renamed
    // within a file); signal consumers so derived state is recomputed.
    this.options.onChange?.();
  }

  /**
   * Re-reads the story index and reconciles {@link storyFiles} with stories that have appeared or
   * disappeared since startup. For each story that newly entered the index, the patcher is asked
   * to walk it (so its forward edges are recorded). For each story that left the index, the
   * patcher is asked to unlink it (so its reverse-index entries are pruned). Replays are queued
   * behind {@link patchQueue} to keep the serialised-patch invariant intact.
   */
  private async refreshStoryFiles(): Promise<void> {
    if (this.refreshInFlight || !this.incrementalPatcher) {
      return;
    }
    this.refreshInFlight = true;
    try {
      const storyIndexGenerator = await this.options.storyIndexGeneratorPromise;
      const storyIndex = await storyIndexGenerator.getIndex();
      if (this.disposed) {
        return;
      }
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
    } finally {
      this.refreshInFlight = false;
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
    if (this.disposed || !this.incrementalPatcher) {
      return;
    }
    try {
      await this.incrementalPatcher.patch(event);
    } catch (error) {
      logger.warn(
        `Change detection: failed to apply ${event.kind} for ${event.path}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    if (this.disposed) {
      return;
    }
    this.options.onChange?.();
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    this.unsubscribeFileChange?.();
    this.unsubscribeFileChange = undefined;
    this.unsubscribeStartupFailure?.();
    this.unsubscribeStartupFailure = undefined;

    // Drain in-flight patches before tearing down the OXC parse pool so no
    // patch reads the pool after it has been disposed.
    await this.patchQueue.catch(() => undefined);
    await disposeOxcParsePool().catch(() => undefined);
  }
}
