import { cpus } from 'node:os';

import { normalize } from 'pathe';

import { logger as defaultLogger } from 'storybook/internal/node-logger';

import type { ParserRegistry } from '../parser-registry/index.ts';
import { profiler } from '../profiling.ts';
import { ParseResolveCache } from './ParseResolveCache.ts';
import { ReverseIndexImpl } from './ReverseIndex.ts';
import type { ChangeDetectionResolverFactory } from './ResolverFactory.ts';
import type { DependencyGraph } from './types.ts';

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
  /**
   * Optional shared cache. Pass the same instance to {@link IncrementalPatcher} so
   * post-build incremental walks skip work the cold-start build already did. When
   * omitted, the builder constructs a private cache that lives only for one `build()`.
   */
  cache?: ParseResolveCache;
}

/**
 * Eagerly builds a {@link ReverseIndexImpl} + {@link DependencyGraph} by BFS-walking forward
 * from each story file. Walks stop at workspace boundaries, non-JS extensions, or unresolved
 * specifiers. All-or-nothing per file: a file's resolved subset is committed even if some of
 * its imports failed.
 */
export class DependencyGraphBuilder {
  private readonly registry: ParserRegistry;
  private readonly logger: BuilderLogger;
  private readonly concurrency: number;
  private readonly cache: ParseResolveCache;

  constructor(opts: BuilderOptions) {
    this.registry = opts.registry;
    this.logger = opts.logger ?? defaultLogger;
    this.concurrency = opts.concurrency ?? cpus().length * 2;
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

  async build(
    storyFiles: Iterable<string>
  ): Promise<{ reverseIndex: ReverseIndexImpl; graph: DependencyGraph }> {
    const startedAt = Date.now();
    profiler.buildStart();
    const reverseIndex = new ReverseIndexImpl();
    const graph: DependencyGraph = new Map();

    const { default: pLimit } = await import('p-limit');
    const limit = pLimit(this.concurrency);

    const stories = Array.from(storyFiles, (s) => normalize(s));

    await Promise.all(
      stories.map((story) => limit(() => this.walkFromStory(story, reverseIndex, graph)))
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
    graph: DependencyGraph
  ): Promise<void> {
    reverseIndex.record(storyRoot, storyRoot, 0);

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
      graph.set(file, resolvedDeps);

      const nextDepth = depth + 1;
      for (const normalised of resolvedDeps) {
        const previousDepth = visited.get(normalised);
        if (previousDepth !== undefined && previousDepth <= nextDepth) {
          continue;
        }
        visited.set(normalised, nextDepth);
        reverseIndex.record(normalised, storyRoot, nextDepth);
        queue.push({ file: normalised, depth: nextDepth });
      }
    }
  }
}
