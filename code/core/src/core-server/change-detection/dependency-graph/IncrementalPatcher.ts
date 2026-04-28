import { normalize } from 'pathe';

import { logger as defaultLogger } from 'storybook/internal/node-logger';

import type { FileChangeEvent } from '../adapters/types.ts';
import type { ParserRegistry } from '../parser-registry/index.ts';
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
 * `patchQueue`.
 *
 * Known limitation: files that are unresolved at cold-start (resolver returns null so they
 * never enter the graph) are not automatically reconnected when they later appear on disk.
 * A full rebuild is required to pick them up.
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
    const path = normalize(event.path);
    // File contents may have changed (or the file is gone); drop any stale cached
    // parse/resolve data before any read.
    this.cache.invalidate(path);

    if (event.kind === 'add') {
      if (this.isStoryFile(path)) {
        await this.walkStory(path);
      }
      // Non-story add: the documented limitation says we don't recover unresolved deps.
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
      const storiesToWalk: string[] = [];
      for (const story of dependentsSet) {
        if (story === path || !this.isStoryFile(story)) {
          continue;
        }
        this.reverseIndex.removeStory(story);
        storiesToWalk.push(story);
      }
      await Promise.all(storiesToWalk.map((story) => this.walkStory(story)));
      return;
    }

    // 'change' on an existing file: re-walk every story that depends on this file
    // (plus the file itself if it's a story). The walk re-resolves dependencies via
    // the cache (already invalidated above) and rebuilds the relevant slice of the
    // graph and reverse-index.
    const affectedStories = new Set(this.reverseIndex.lookup(path).keys());
    if (this.isStoryFile(path)) {
      affectedStories.add(path);
    }

    const storiesToWalk: string[] = [];
    for (const story of affectedStories) {
      if (!this.isStoryFile(story)) {
        continue;
      }
      this.reverseIndex.removeStory(story);
      storiesToWalk.push(story);
    }
    await Promise.all(storiesToWalk.map((story) => this.walkStory(story)));
  }

  private walkStory(storyRoot: string): Promise<void> {
    return walkFromStory({
      storyRoot,
      registry: this.registry,
      cache: this.cache,
      reverseIndex: this.reverseIndex,
      recordEdges: (file, deps) => {
        this.graph.set(file, deps);
      },
    });
  }
}
