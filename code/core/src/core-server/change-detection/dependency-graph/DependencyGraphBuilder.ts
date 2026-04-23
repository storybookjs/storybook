import { readFile } from 'node:fs/promises';
import { cpus } from 'node:os';

import { normalize } from 'pathe';

import { logger as defaultLogger } from 'storybook/internal/node-logger';

import type { ParserRegistry } from '../parser-registry/index.ts';
import { profiler } from '../profiling.ts';
import { ReverseIndexImpl } from './ReverseIndex.ts';
import type { ChangeDetectionResolverFactory } from './ResolverFactory.ts';
import type { DependencyGraph, ImportEdge } from './types.ts';

interface BuilderLogger {
  debug: (message: string) => void;
  warn: (message: string) => void;
}

interface BuilderOptions {
  registry: ParserRegistry;
  resolver: ChangeDetectionResolverFactory;
  workspaceRoots: Set<string>;
  projectRoot: string;
  logger?: BuilderLogger;
  concurrency?: number;
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
  // (a) under projectRoot AND not under any node_modules path segment
  const projectPrefix = projectRoot.endsWith('/') ? projectRoot : `${projectRoot}/`;
  if (
    (absolute === projectRoot || absolute.startsWith(projectPrefix)) &&
    !absolute.includes(NODE_MODULES_SEGMENT)
  ) {
    return true;
  }
  // (b) under one of workspaceRoots (workspace packages live in node_modules typically — these
  // are first-party packages we still want to walk into).
  if (isInsideAnyWorkspace(absolute, workspaceRoots)) {
    return true;
  }
  return false;
}

/**
 * Eagerly builds a {@link ReverseIndexImpl} + {@link DependencyGraph} by BFS-walking forward
 * from each story file. Walks stop at workspace boundaries, non-JS extensions, or unresolved
 * specifiers. All-or-nothing per file: a file's resolved subset is committed even if some of
 * its imports failed.
 */
export class DependencyGraphBuilder {
  private readonly registry: ParserRegistry;
  private readonly resolver: ChangeDetectionResolverFactory;
  private readonly workspaceRoots: Set<string>;
  private readonly projectRoot: string;
  private readonly logger: BuilderLogger;
  private readonly concurrency: number;

  constructor(opts: BuilderOptions) {
    this.registry = opts.registry;
    this.resolver = opts.resolver;
    this.workspaceRoots = new Set(Array.from(opts.workspaceRoots, (r) => normalize(r)));
    this.projectRoot = normalize(opts.projectRoot);
    this.logger = opts.logger ?? defaultLogger;
    this.concurrency = opts.concurrency ?? cpus().length * 2;
  }

  async build(
    storyFiles: Iterable<string>
  ): Promise<{ reverseIndex: ReverseIndexImpl; graph: DependencyGraph }> {
    const startedAt = Date.now();
    profiler.buildStart();
    const reverseIndex = new ReverseIndexImpl();
    const graph: DependencyGraph = new Map();
    const parseCache = new Map<string, Promise<ImportEdge[] | null>>();
    const resolveCache = new Map<string, Promise<Set<string>>>();

    const { default: pLimit } = await import('p-limit');
    const limit = pLimit(this.concurrency);

    const stories = Array.from(storyFiles, (s) => normalize(s));

    await Promise.all(
      stories.map((story) =>
        limit(() => this.walkFromStory(story, reverseIndex, graph, parseCache, resolveCache))
      )
    );

    const elapsed = Date.now() - startedAt;
    this.logger.debug(
      `Change detection graph built: ${stories.length} stories, ${reverseIndex.asMap().size} deps tracked, ${elapsed}ms`
    );
    profiler.buildEnd({
      storyCount: stories.length,
      reverseIndexSize: reverseIndex.asMap().size,
    });

    return { reverseIndex, graph };
  }

  private isWalkable(filePath: string): boolean {
    return this.registry.parserFor(filePath) !== undefined;
  }

  private async walkFromStory(
    storyRoot: string,
    reverseIndex: ReverseIndexImpl,
    graph: DependencyGraph,
    parseCache: Map<string, Promise<ImportEdge[] | null>>,
    resolveCache: Map<string, Promise<Set<string>>>
  ): Promise<void> {
    // Story root itself is recorded at depth 0.
    reverseIndex.record(storyRoot, storyRoot, 0);

    // Per-story BFS visited map (dedupes within this story walk; tracks min depth).
    const visited = new Map<string, number>();
    visited.set(storyRoot, 0);
    const queue: Array<{ file: string; depth: number }> = [{ file: storyRoot, depth: 0 }];
    let head = 0;

    while (head < queue.length) {
      const { file, depth } = queue[head++];

      if (!this.isWalkable(file)) {
        continue;
      }

      const resolvedDeps = await this.resolveOnce(file, parseCache, resolveCache);
      graph.set(file, resolvedDeps);

      const nextDepth = depth + 1;
      for (const normalised of resolvedDeps) {
        const previousDepth = visited.get(normalised);
        if (previousDepth !== undefined && previousDepth <= nextDepth) {
          // Already reached at equal-or-shorter depth; do not re-walk.
          continue;
        }
        visited.set(normalised, nextDepth);
        reverseIndex.record(normalised, storyRoot, nextDepth);
        queue.push({ file: normalised, depth: nextDepth });
      }
    }
  }

  private parseOnce(
    filePath: string,
    parseCache: Map<string, Promise<ImportEdge[] | null>>
  ): Promise<ImportEdge[] | null> {
    const existing = parseCache.get(filePath);
    if (existing) {
      return existing;
    }
    const promise = (async (): Promise<ImportEdge[] | null> => {
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
    })();
    parseCache.set(filePath, promise);
    return promise;
  }

  /**
   * Parses a file and resolves every in-scope edge it declares, returning the absolute-path
   * Set of its direct deps. The `resolveCache` hoists this computation above the per-story
   * walk: without it, a shared module imported by N stories is re-resolved N times (only
   * parsing was cached before). Cold-start builds on real projects showed ~135× more
   * resolver calls than parses; the cache collapses that back to 1×.
   */
  private resolveOnce(
    filePath: string,
    parseCache: Map<string, Promise<ImportEdge[] | null>>,
    resolveCache: Map<string, Promise<Set<string>>>
  ): Promise<Set<string>> {
    const existing = resolveCache.get(filePath);
    if (existing) {
      return existing;
    }
    const promise = (async (): Promise<Set<string>> => {
      const edges = await this.parseOnce(filePath, parseCache);
      if (!edges) {
        return new Set<string>();
      }
      const deps = new Set<string>();
      for (const edge of edges) {
        const resolved = await this.resolver.resolve(filePath, edge.specifier);
        if (resolved === null) {
          this.logger.debug(`Could not resolve ${edge.specifier} from ${filePath}`);
          continue;
        }
        const normalised = normalize(resolved);
        if (!isInScope(normalised, this.projectRoot, this.workspaceRoots)) {
          // Out-of-scope (e.g. external node_modules) — opaque leaf, no walk.
          continue;
        }
        deps.add(normalised);
      }
      return deps;
    })();
    resolveCache.set(filePath, promise);
    return promise;
  }
}
