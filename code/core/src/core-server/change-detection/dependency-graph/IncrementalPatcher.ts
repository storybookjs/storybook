import { readFile } from 'node:fs/promises';

import { normalize } from 'pathe';

import { logger as defaultLogger } from 'storybook/internal/node-logger';

import type { FileChangeEvent } from '../adapters/types.ts';
import type { ParserRegistry } from '../parser-registry/index.ts';
import { profiler } from '../profiling.ts';
import type { ReverseIndexImpl } from './ReverseIndex.ts';
import type { ChangeDetectionResolverFactory } from './ResolverFactory.ts';
import type { DependencyGraph, ImportEdge } from './types.ts';

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
}

const NODE_MODULES_SEGMENT = '/node_modules/';

function isInsideAnyWorkspace(absolute: string, workspaceRoots: Set<string>): boolean {
  for (const root of workspaceRoots) {
    if (absolute === root || absolute.startsWith(root.endsWith('/') ? root : `${root}/`)) {
      return true;
    }
  }
  return false;
}

function isInScope(absolute: string, projectRoot: string, workspaceRoots: Set<string>): boolean {
  const projectPrefix = projectRoot.endsWith('/') ? projectRoot : `${projectRoot}/`;
  if (
    (absolute === projectRoot || absolute.startsWith(projectPrefix)) &&
    !absolute.includes(NODE_MODULES_SEGMENT)
  ) {
    return true;
  }
  if (isInsideAnyWorkspace(absolute, workspaceRoots)) {
    return true;
  }
  return false;
}

/**
 * Applies a single {@link FileChangeEvent} to the live reverse index + graph.
 *
 * `patch()` ASSUMES the caller has serialised events behind any in-flight `build()`. The
 * service that owns this patcher (see {@link ChangeDetectionService}) implements the
 * queue-during-build pattern.
 */
export class IncrementalPatcher {
  private readonly reverseIndex: ReverseIndexImpl;
  private readonly graph: DependencyGraph;
  private readonly registry: ParserRegistry;
  private readonly resolver: ChangeDetectionResolverFactory;
  private readonly workspaceRoots: Set<string>;
  private readonly projectRoot: string;
  private readonly logger: PatcherLogger;
  private readonly isStoryFile: (path: string) => boolean;

  constructor(opts: PatcherOptions) {
    this.reverseIndex = opts.reverseIndex;
    this.graph = opts.graph;
    this.registry = opts.registry;
    this.resolver = opts.resolver;
    this.workspaceRoots = new Set(Array.from(opts.workspaceRoots, (r) => normalize(r)));
    this.projectRoot = normalize(opts.projectRoot);
    this.logger = opts.logger ?? defaultLogger;
    this.isStoryFile = opts.isStoryFile;
  }

  /** Apply a single FileChangeEvent. Idempotent — safe to call multiple times for the same event. */
  async patch(event: FileChangeEvent): Promise<void> {
    profiler.patchStart({ kind: event.kind, path: event.path });
    let storiesReWalked = 0;
    try {
      const path = normalize(event.path);
      if (event.kind === 'add') {
        if (this.isStoryFile(path)) {
          storiesReWalked += 1;
          await this.walkFromStory(path);
        }
        // non-story add: no-op until something imports it.
        return;
      }

      if (event.kind === 'unlink') {
        // Stories that previously reached `path`.
        const dependents = Array.from(this.reverseIndex.lookup(path).keys());
        this.graph.delete(path);
        if (this.isStoryFile(path)) {
          this.reverseIndex.removeStory(path);
        } else {
          // Remove path itself from index entries that referenced it.
          for (const story of dependents) {
            this.reverseIndex.removeEdge(path, story);
          }
        }
        // Re-walk every story that previously reached `path` so transitive deps reachable only
        // through `path` are pruned correctly.
        for (const story of dependents) {
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
      const newEdges = await this.parseFile(path);
      const newDeps = new Set<string>();
      if (newEdges) {
        for (const edge of newEdges) {
          const resolved = await this.resolver.resolve(path, edge.specifier);
          if (resolved === null) {
            this.logger.warn(`Could not resolve ${edge.specifier} from ${path}`);
            continue;
          }
          const normalised = normalize(resolved);
          if (!isInScope(normalised, this.projectRoot, this.workspaceRoots)) {
            continue;
          }
          newDeps.add(normalised);
        }
      }
      this.graph.set(path, newDeps);

      // Stories whose dependency-set reaches `path`.
      const dependents = Array.from(this.reverseIndex.lookup(path).keys());
      if (this.isStoryFile(path) && !dependents.includes(path)) {
        dependents.push(path);
      }
      if (dependents.length === 0) {
        return;
      }

      const removedDeps = new Set<string>();
      for (const dep of previousDeps) {
        if (!newDeps.has(dep)) {
          removedDeps.add(dep);
        }
      }

      // For each story that reaches `path`: prune obsolete (dep, story) edges and re-walk to
      // recompute depths through the new outgoing-edge set.
      for (const story of dependents) {
        for (const removedDep of removedDeps) {
          this.reverseIndex.removeEdge(removedDep, story);
        }
        if (this.isStoryFile(story)) {
          // Conservative re-walk: clear the story's contribution from index then redo BFS.
          this.reverseIndex.removeStory(story);
          storiesReWalked += 1;
          await this.walkFromStory(story);
        }
      }
    } finally {
      profiler.patchEnd({ storiesReWalked });
    }
  }

  private isWalkable(filePath: string): boolean {
    return this.registry.parserFor(filePath) !== undefined;
  }

  /** BFS from a story root, recording depth into the reverse index and updating graph entries. */
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

      const edges = await this.parseFile(file);
      if (!edges) {
        continue;
      }

      const resolvedDeps = this.graph.get(file) ?? new Set<string>();
      for (const edge of edges) {
        const resolved = await this.resolver.resolve(file, edge.specifier);
        if (resolved === null) {
          this.logger.warn(`Could not resolve ${edge.specifier} from ${file}`);
          continue;
        }
        const normalised = normalize(resolved);
        if (!isInScope(normalised, this.projectRoot, this.workspaceRoots)) {
          continue;
        }
        resolvedDeps.add(normalised);

        const nextDepth = depth + 1;
        const previous = visited.get(normalised);
        if (previous !== undefined && previous <= nextDepth) {
          continue;
        }
        visited.set(normalised, nextDepth);
        this.reverseIndex.record(normalised, storyRoot, nextDepth);
        queue.push({ file: normalised, depth: nextDepth });
      }
      this.graph.set(file, resolvedDeps);
    }
  }

  private async parseFile(filePath: string): Promise<ImportEdge[] | null> {
    let source: string;
    try {
      source = await readFile(filePath, 'utf8');
    } catch (error) {
      this.logger.warn(
        `Change detection: could not read ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
    try {
      return (await this.registry.parse(filePath, source)) ?? [];
    } catch (error) {
      this.logger.warn(
        `Change detection: failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }
}
