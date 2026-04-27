import { normalize } from 'pathe';

import { logger as defaultLogger } from 'storybook/internal/node-logger';

import type { FileChangeEvent } from '../adapters/types.ts';
import type { ParserRegistry } from '../parser-registry/index.ts';
import { profiler } from '../profiling.ts';
import { ParseResolveCache } from './ParseResolveCache.ts';
import type { ReverseIndexImpl } from './ReverseIndex.ts';
import type { ChangeDetectionResolverFactory } from './ResolverFactory.ts';
import type { DependencyGraph } from './types.ts';
import { walkFromStory } from './walkFromStory.ts';

interface PatcherLogger {
  debug: (message: string) => void;
  warn: (message: string) => void;
}

interface PatcherOptions {
  reverseIndex: ReverseIndexImpl;
  graph: DependencyGraph;
  registry: ParserRegistry;
  resolver: ChangeDetectionResolverFactory;
  workspaceRoots: Set<string>;
  projectRoot: string;
  logger?: PatcherLogger;
  /** Set-style predicate: returns true if the path is a story-root file. */
  isStoryFile: (path: string) => boolean;
  /**
   * Optional shared cache. When the patcher and {@link DependencyGraphBuilder} share the
   * same instance, post-build incremental walks reuse parse + resolve results from the
   * cold-start build. The patcher invalidates `path` on every `change`/`unlink` event
   * before reading.
   */
  cache?: ParseResolveCache;
}

/**
 * Applies a single {@link FileChangeEvent} to the live reverse index + graph.
 *
 * `patch()` mutates `graph` and `reverseIndex` across multiple `await` points, so the caller
 * MUST serialise concurrent calls; {@link ChangeDetectionService} chains them through
 * `currentPatch`.
 */
export class IncrementalPatcher {
  private readonly reverseIndex: ReverseIndexImpl;
  private readonly graph: DependencyGraph;
  /** Inverse of `graph`: dep file → set of files that directly import it. */
  private readonly inverseImporters = new Map<string, Set<string>>();
  private readonly registry: ParserRegistry;
  private readonly logger: PatcherLogger;
  private readonly isStoryFile: (path: string) => boolean;
  private readonly cache: ParseResolveCache;

  constructor(opts: PatcherOptions) {
    this.reverseIndex = opts.reverseIndex;
    this.graph = opts.graph;
    this.registry = opts.registry;
    this.logger = opts.logger ?? defaultLogger;
    this.isStoryFile = opts.isStoryFile;
    this.cache =
      opts.cache ??
      new ParseResolveCache({
        registry: opts.registry,
        resolver: opts.resolver,
        workspaceRoots: opts.workspaceRoots,
        projectRoot: opts.projectRoot,
        logger: this.logger,
      });

    // Seed the inverse map from any pre-existing forward edges (typical: the cold-start
    // graph handed in by DependencyGraphBuilder.build()).
    for (const [importer, deps] of this.graph) {
      for (const dep of deps) {
        this.addInverseEdge(dep, importer);
      }
    }
  }

  async patch(event: FileChangeEvent): Promise<void> {
    profiler.patchStart({ kind: event.kind, path: event.path });
    let storiesReWalked = 0;
    try {
      const path = normalize(event.path);
      // File contents may have changed (or the file is gone); drop any stale cached
      // parse/resolve data before any read.
      this.cache.invalidate(path);

      if (event.kind === 'add') {
        if (this.isStoryFile(path)) {
          storiesReWalked += 1;
          await this.walkStory(path);
          return;
        }
        // Non-story add: re-walk stories whose direct importers may now resolve `path`.
        storiesReWalked += await this.recoverViaDirectImporters(path);
        return;
      }

      if (event.kind === 'unlink') {
        const dependentsSet = new Set(this.reverseIndex.lookup(path).keys());
        this.deleteFromGraph(path);
        if (this.isStoryFile(path)) {
          this.reverseIndex.removeStory(path);
        } else {
          for (const story of dependentsSet) {
            this.reverseIndex.removeEdge(path, story);
          }
        }
        // Re-walk every dependent story so transitive deps reachable only through `path`
        // are pruned.
        const storiesToWalk: string[] = [];
        for (const story of dependentsSet) {
          if (story === path || !this.isStoryFile(story)) {
            continue;
          }
          this.reverseIndex.removeStory(story);
          storiesToWalk.push(story);
        }
        await Promise.all(storiesToWalk.map((story) => this.walkStory(story)));
        storiesReWalked += storiesToWalk.length;
        return;
      }

      // 'change'
      const previousDeps = this.graph.get(path) ?? new Set<string>();
      const newDeps = await this.cache.resolveOnce(path);
      this.setEdges(path, newDeps);

      const areDepsEqual =
        newDeps.size === previousDeps.size && [...newDeps].every((d) => previousDeps.has(d));

      if (areDepsEqual && !this.isStoryFile(path)) {
        return;
      }

      const dependentsSet = new Set(this.reverseIndex.lookup(path).keys());
      if (this.isStoryFile(path)) {
        dependentsSet.add(path);
      }

      // Cold-start cascade-failure recovery: if no story reaches `path` via reverseIndex
      // (e.g. cold-start walker never visited it because its importer's parse/resolve
      // failed, or `path` did not exist on disk at boot), look for direct importers in
      // the graph and re-walk their stories. That re-walk picks up the new outgoing
      // edges introduced by this change.
      if (dependentsSet.size === 0 && !this.isStoryFile(path)) {
        storiesReWalked += await this.recoverViaDirectImporters(path);
        return;
      }

      const removedDeps = new Set<string>();
      for (const dep of previousDeps) {
        if (!newDeps.has(dep)) {
          removedDeps.add(dep);
        }
      }

      // For each dependent story: prune obsolete (dep, story) edges, then BFS again.
      const storiesToWalk: string[] = [];
      for (const story of dependentsSet) {
        for (const removedDep of removedDeps) {
          this.reverseIndex.removeEdge(removedDep, story);
        }
        if (this.isStoryFile(story)) {
          this.reverseIndex.removeStory(story);
          storiesToWalk.push(story);
        }
      }
      await Promise.all(storiesToWalk.map((story) => this.walkStory(story)));
      storiesReWalked += storiesToWalk.length;
    } finally {
      profiler.patchEnd({ storiesReWalked });
    }
  }

  /**
   * Re-walks every story that transitively reaches a known direct importer of `path`.
   * Used when `path` is not in the reverse-index (cold-start never reached it) but the
   * graph still records files that import it. Returns the number of stories re-walked.
   */
  private async recoverViaDirectImporters(path: string): Promise<number> {
    const directImporters = this.inverseImporters.get(path);
    if (!directImporters || directImporters.size === 0) {
      return 0;
    }
    const storiesToWalk = new Set<string>();
    for (const importer of directImporters) {
      for (const story of this.reverseIndex.lookup(importer).keys()) {
        if (this.isStoryFile(story)) {
          storiesToWalk.add(story);
        }
      }
      if (this.isStoryFile(importer)) {
        storiesToWalk.add(importer);
      }
    }
    for (const story of storiesToWalk) {
      this.reverseIndex.removeStory(story);
    }
    await Promise.all(Array.from(storiesToWalk, (story) => this.walkStory(story)));
    return storiesToWalk.size;
  }

  private walkStory(storyRoot: string): Promise<void> {
    return walkFromStory({
      storyRoot,
      registry: this.registry,
      cache: this.cache,
      reverseIndex: this.reverseIndex,
      recordEdges: (file, deps) => this.setEdges(file, deps),
    });
  }

  private setEdges(file: string, deps: Set<string>): void {
    const previous = this.graph.get(file);
    if (previous) {
      for (const dep of previous) {
        if (!deps.has(dep)) {
          this.removeInverseEdge(dep, file);
        }
      }
    }
    this.graph.set(file, deps);
    for (const dep of deps) {
      this.addInverseEdge(dep, file);
    }
  }

  private deleteFromGraph(file: string): void {
    const deps = this.graph.get(file);
    if (deps) {
      for (const dep of deps) {
        this.removeInverseEdge(dep, file);
      }
    }
    this.graph.delete(file);
  }

  private addInverseEdge(dep: string, importer: string): void {
    let importers = this.inverseImporters.get(dep);
    if (!importers) {
      importers = new Set();
      this.inverseImporters.set(dep, importers);
    }
    importers.add(importer);
  }

  private removeInverseEdge(dep: string, importer: string): void {
    const importers = this.inverseImporters.get(dep);
    if (!importers) {
      return;
    }
    importers.delete(importer);
    if (importers.size === 0) {
      this.inverseImporters.delete(dep);
    }
  }
}
