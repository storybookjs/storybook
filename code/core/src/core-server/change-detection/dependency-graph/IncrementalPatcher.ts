import { normalize } from 'pathe';

import { logger as defaultLogger } from 'storybook/internal/node-logger';

import type { FileChangeEvent } from '../adapters/types.ts';
import type { ParserRegistry } from '../parser-registry/index.ts';
import { profiler } from '../profiling.ts';
import { ParseResolveCache } from './ParseResolveCache.ts';
import type { ReverseIndexImpl } from './ReverseIndex.ts';
import type { ChangeDetectionResolverFactory } from './ResolverFactory.ts';
import type { DependencyGraph } from './types.ts';

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
          await this.walkFromStory(path);
          return;
        }
        // Non-story add: scan graph for known direct importers whose previous resolve
        // missed `path` (e.g. file did not exist at cold-start). If none found, this is
        // a no-op until an importer's `change` fires.
        storiesReWalked += await this.recoverViaDirectImporters(path);
        return;
      }

      if (event.kind === 'unlink') {
        const dependentsSet = new Set(this.reverseIndex.lookup(path).keys());
        this.graph.delete(path);
        if (this.isStoryFile(path)) {
          this.reverseIndex.removeStory(path);
        } else {
          for (const story of dependentsSet) {
            this.reverseIndex.removeEdge(path, story);
          }
        }
        // Re-walk every dependent story so transitive deps reachable only through `path`
        // are pruned.
        for (const story of dependentsSet) {
          if (story === path) {
            continue;
          }
          if (this.isStoryFile(story)) {
            this.reverseIndex.removeStory(story);
            storiesReWalked += 1;
            await this.walkFromStory(story);
          }
        }
        return;
      }

      // 'change'
      const previousDeps = this.graph.get(path) ?? new Set<string>();
      const newDeps = await this.cache.resolveOnce(path);
      this.graph.set(path, newDeps);

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
      for (const story of dependentsSet) {
        for (const removedDep of removedDeps) {
          this.reverseIndex.removeEdge(removedDep, story);
        }
        if (this.isStoryFile(story)) {
          this.reverseIndex.removeStory(story);
          storiesReWalked += 1;
          await this.walkFromStory(story);
        }
      }
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
    const directImporters = new Set<string>();
    for (const [importer, deps] of this.graph) {
      if (deps.has(path)) {
        directImporters.add(importer);
      }
    }
    if (directImporters.size === 0) {
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
      await this.walkFromStory(story);
    }
    return storiesToWalk.size;
  }

  private isWalkable(filePath: string): boolean {
    return this.registry.parserFor(filePath) !== undefined;
  }

  private async walkFromStory(storyRoot: string): Promise<void> {
    this.reverseIndex.record(storyRoot, storyRoot, 0);

    const visited = new Map<string, number>();
    visited.set(storyRoot, 0);
    const queue: Array<{ file: string; depth: number }> = [{ file: storyRoot, depth: 0 }];
    let head = 0;

    while (head < queue.length) {
      const { file, depth } = queue[head++];

      if (!this.isWalkable(file)) {
        continue;
      }

      const resolvedDeps = await this.cache.resolveOnce(file);
      this.graph.set(file, resolvedDeps);

      const nextDepth = depth + 1;
      for (const normalised of resolvedDeps) {
        const previous = visited.get(normalised);
        if (previous !== undefined && previous <= nextDepth) {
          continue;
        }
        visited.set(normalised, nextDepth);
        this.reverseIndex.record(normalised, storyRoot, nextDepth);
        queue.push({ file: normalised, depth: nextDepth });
      }
    }
  }
}
