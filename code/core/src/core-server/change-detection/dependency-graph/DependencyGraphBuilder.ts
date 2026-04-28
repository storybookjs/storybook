import { cpus } from 'node:os';

import { normalize } from 'pathe';

import { logger as defaultLogger } from 'storybook/internal/node-logger';

import type { ParserRegistry } from '../parser-registry/index.ts';
import { ParseResolveCache } from './ParseResolveCache.ts';
import { ReverseIndexImpl } from './ReverseIndex.ts';
import type { ChangeDetectionResolverFactory } from './ResolverFactory.ts';
import type { DependencyGraph } from './types.ts';
import { walkFromStory } from './walkFromStory.ts';

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
 * specifiers. Per-file errors (read failure, parse failure, individual unresolved specifiers)
 * are swallowed and result in fewer recorded deps for that file — not a build failure.
 * Graceful degradation ensures one bad file cannot crash change-detection for all stories.
 */
export class DependencyGraphBuilder {
  private readonly registry: ParserRegistry;
  private readonly logger: BuilderLogger;
  private readonly cache: ParseResolveCache;

  constructor(opts: BuilderOptions) {
    this.registry = opts.registry;
    this.logger = opts.logger ?? defaultLogger;
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
    const reverseIndex = new ReverseIndexImpl();
    const graph: DependencyGraph = new Map();

    const { default: pLimit } = await import('p-limit');
    const limit = pLimit(cpus().length * 2);

    const stories = Array.from(storyFiles, (s) => normalize(s));

    await Promise.all(
      stories.map((story) =>
        limit(() =>
          walkFromStory({
            storyRoot: story,
            registry: this.registry,
            cache: this.cache,
            reverseIndex,
            recordEdges: (file, deps) => graph.set(file, deps),
          })
        )
      )
    );

    const elapsed = Date.now() - startedAt;
    this.logger.debug(
      `Change detection graph built: ${stories.length} stories, ${reverseIndex.asMap().size} deps tracked, ${elapsed}ms`
    );

    return { reverseIndex, graph };
  }
}
