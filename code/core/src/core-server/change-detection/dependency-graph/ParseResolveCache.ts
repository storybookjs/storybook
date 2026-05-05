import { readFile } from 'node:fs/promises';

import { normalize } from 'pathe';

import type { ParserRegistry } from '../parser-registry/index.ts';
import type { ImportEdge } from './types.ts';
import type { ChangeDetectionResolverFactory } from './ResolverFactory.ts';
import { isInScope } from './scope.ts';

interface CacheLogger {
  debug: (message: string) => void;
  warn: (message: string) => void;
}

interface CacheOptions {
  registry: ParserRegistry;
  resolver: ChangeDetectionResolverFactory;
  workspaceRoots: Set<string>;
  projectRoot: string;
  logger: CacheLogger;
}

/**
 * Long-lived parse + resolve cache shared across cold-start build and incremental patch.
 *
 * Both layers were re-parsing and re-resolving every shared module on every walk before
 * this cache existed (`DependencyGraphBuilder` had per-build caches; the patcher had none
 * at all). Promoting the caches to instance scope and invalidating on file-change events
 * collapses the redundant work without sacrificing correctness — `change`/`unlink` events
 * call {@link invalidate} before the patcher reads, so a stale entry can never survive.
 */
export class ParseResolveCache {
  private readonly registry: ParserRegistry;
  private readonly resolver: ChangeDetectionResolverFactory;
  private readonly workspaceRoots: Set<string>;
  private readonly projectRoot: string;
  private readonly logger: CacheLogger;

  private readonly parseCache = new Map<string, Promise<ImportEdge[]>>();
  private readonly resolveCache = new Map<string, Promise<Set<string>>>();

  constructor(opts: CacheOptions) {
    this.registry = opts.registry;
    this.resolver = opts.resolver;
    this.workspaceRoots = new Set(Array.from(opts.workspaceRoots, (r) => normalize(r)));
    this.projectRoot = normalize(opts.projectRoot);
    this.logger = opts.logger;
  }

  /**
   * Parses the file once and caches the resulting edge list. Returns `[]` for unreadable
   * files, parse failures, or files whose extension has no registered parser — callers
   * cannot distinguish between "no edges" and "we couldn't look", which is by design:
   * either way the file contributes nothing to the dependency graph.
   */
  parseOnce(filePath: string): Promise<ImportEdge[]> {
    const existing = this.parseCache.get(filePath);
    if (existing) {
      return existing;
    }
    const promise = (async (): Promise<ImportEdge[]> => {
      let source: string;
      try {
        source = await readFile(filePath, 'utf8');
      } catch (error) {
        this.logger.debug(
          `Change detection: could not read ${filePath}: ${error instanceof Error ? error.message : String(error)}`
        );
        return [];
      }
      try {
        return (await this.registry.parse(filePath, source)) ?? [];
      } catch (error) {
        this.logger.debug(
          `Change detection: failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`
        );
        return [];
      }
    })();
    this.parseCache.set(filePath, promise);
    return promise;
  }

  /** Resolves every in-scope edge declared by `filePath` and returns the dep Set. */
  resolveOnce(filePath: string): Promise<Set<string>> {
    const existing = this.resolveCache.get(filePath);
    if (existing) {
      return existing;
    }
    const promise = (async (): Promise<Set<string>> => {
      const edges = await this.parseOnce(filePath);
      const deps = new Set<string>();
      for (const edge of edges) {
        const resolved = await this.resolver.resolve(filePath, edge.specifier);
        if (resolved === null) {
          this.logger.debug(`Could not resolve ${edge.specifier} from ${filePath}`);
          continue;
        }
        const normalised = normalize(resolved);
        if (!isInScope(normalised, this.projectRoot, this.workspaceRoots)) {
          continue;
        }
        deps.add(normalised);
      }
      return deps;
    })();
    this.resolveCache.set(filePath, promise);
    return promise;
  }

  /** Drops both cached entries for `filePath`. Call on every `change`/`unlink` event. */
  invalidate(filePath: string): void {
    this.parseCache.delete(filePath);
    this.resolveCache.delete(filePath);
  }

  /** Test-only: full reset. */
  clear(): void {
    this.parseCache.clear();
    this.resolveCache.clear();
  }
}
