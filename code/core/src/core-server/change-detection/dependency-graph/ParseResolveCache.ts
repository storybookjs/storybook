import { readFile } from 'node:fs/promises';

import { normalize } from 'pathe';

import { parseBarrelInfo } from 'storybook/internal/oxc-parser';
import type { BarrelInfo } from 'storybook/internal/oxc-parser';

import type { ParserRegistry } from '../parser-registry/index.ts';
import type { ImportEdge } from './types.ts';
import type { ChangeDetectionResolverFactory } from './ResolverFactory.ts';
import { isInScope } from './scope.ts';

/** Maximum barrel-chain hops followed when tracing a named export to its source file. */
const BARREL_FOLLOW_MAX_DEPTH = 10;

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
  /** When true, accumulates barrel resolution events retrievable via {@link getBarrelTrace}. */
  debug?: boolean;
}

export interface BarrelResolutionEvent {
  /** File that contained the import statement. */
  from: string;
  /** Raw import specifier as written in source. */
  specifier: string;
  /** Resolved absolute path of the barrel file. */
  barrel: string;
  /** Named symbols that were requested. */
  names: string[];
  /** Source files the names resolved to (empty when needBarrel is true for all names). */
  resolved: string[];
  /**
   * True when at least one name could not be chain-followed — the barrel itself was
   * added to the dep set as a conservative fallback.
   */
  needBarrel: boolean;
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
  private readonly barrelInfoCache = new Map<string, Promise<BarrelInfo>>();
  private readonly debugTrace: BarrelResolutionEvent[] | null;

  constructor(opts: CacheOptions) {
    this.registry = opts.registry;
    this.resolver = opts.resolver;
    this.workspaceRoots = new Set(Array.from(opts.workspaceRoots, (r) => normalize(r)));
    this.projectRoot = normalize(opts.projectRoot);
    this.logger = opts.logger;
    this.debugTrace = opts.debug ? [] : null;
  }

  /** Returns accumulated barrel resolution events, or null when debug mode is off. */
  getBarrelTrace(): BarrelResolutionEvent[] | null {
    return this.debugTrace;
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

        // For named imports, attempt to follow barrel re-exports directly to
        // the source files of the specific symbols used.  This prevents stories
        // that import only `Button` from being marked as related when
        // `Breadcrumb` (also exported by the same barrel) changes.
        if (edge.importedNames !== null && edge.importedNames.size > 0) {
          const { sources, barrels, needBarrel } = await this.followBarrel(
            normalised,
            edge.importedNames
          );
          this.debugTrace?.push({
            from: filePath,
            specifier: edge.specifier,
            barrel: normalised,
            names: Array.from(edge.importedNames),
            resolved: Array.from(sources),
            needBarrel,
          });
          for (const src of sources) {
            deps.add(src);
          }
          // Add every barrel visited during chain-following so that structural re-export
          // changes at any hop (not just the direct import) invalidate this importer.
          for (const barrel of barrels) {
            deps.add(barrel);
          }
        }

        deps.add(normalised);
      }
      return deps;
    })();
    this.resolveCache.set(filePath, promise);
    return promise;
  }

  /**
   * For each name in `requestedNames`, walks the barrel chain starting at `barrelPath`
   * until it reaches the actual source file that defines the symbol.  Handles multi-level
   * chains where intermediate barrels use `export * from '...'` by recursing through them.
   *
   * Returns `needBarrel = true` for any name that could not be fully resolved so the
   * caller falls back to including the barrel itself.
   */
  private async followBarrel(
    barrelPath: string,
    requestedNames: Set<string>
  ): Promise<{ sources: Set<string>; barrels: Set<string>; needBarrel: boolean }> {
    const barrels = new Set<string>();
    const results = await Promise.all(
      Array.from(requestedNames, (name) => this.followName(barrelPath, name, new Set(), 0, barrels))
    );
    const sources = new Set<string>();
    let needBarrel = false;
    for (const source of results) {
      if (source !== null) {
        sources.add(source);
      } else {
        needBarrel = true;
      }
    }
    return { sources, barrels, needBarrel };
  }

  /**
   * Recursively follows a single exported name through barrel re-exports.
   *
   * 1. Checks named re-exports in `barrelPath`; if found, resolves the specifier and
   *    recurses with the inner name in case the target is itself a barrel.
   * 2. Falls through to wildcard re-exports (`export * from '...'`) and searches each
   *    transitively until the name is found or all paths are exhausted.
   *
   * Returns the normalised absolute path of the first non-barrel source found, or `null`
   * when the chain is unresolvable (triggering the conservative `needBarrel` fallback).
   * Cycle detection via `visited`; depth limit of 10 hops prevents infinite recursion.
   */
  private async followName(
    barrelPath: string,
    name: string,
    visited: Set<string>,
    depth: number,
    barrels: Set<string>
  ): Promise<string | null> {
    if (depth > BARREL_FOLLOW_MAX_DEPTH) {
      this.logger.debug(
        `Change detection: barrel chain depth limit reached at ${barrelPath} (looking for "${name}")`
      );
      return null;
    }
    if (visited.has(barrelPath)) {
      return null;
    }
    visited.add(barrelPath);
    barrels.add(barrelPath);

    const info = await this.barrelInfoOnce(barrelPath);

    // NOTE: parseBarrelInfo only tracks direct re-exports (export { x } from './y').
    // Two-step re-exports (import { x } from './y'; export { x }) are not detected,
    // causing the barrel fallback to be used for those patterns.
    const entry = info.named.get(name);
    if (entry) {
      const sourceResolved = await this.resolver.resolve(barrelPath, entry.specifier);
      if (sourceResolved !== null) {
        const sourceNorm = normalize(sourceResolved);
        if (isInScope(sourceNorm, this.projectRoot, this.workspaceRoots)) {
          const deeper = await this.followName(
            sourceNorm,
            entry.importedName,
            new Set(visited),
            depth + 1,
            barrels
          );
          return deeper ?? sourceNorm;
        }
      }
      return null;
    }

    // NOTE: namespace re-exports (export * as ns from './foo') are not tracked.
    // Imports using the namespace form (ns.Button) fall back to barrel tracking.
    for (const wildcardSpec of info.wildcards) {
      const wildcardResolved = await this.resolver.resolve(barrelPath, wildcardSpec);
      if (wildcardResolved === null) {
        continue;
      }
      const wildcardNorm = normalize(wildcardResolved);
      if (!isInScope(wildcardNorm, this.projectRoot, this.workspaceRoots)) {
        continue;
      }
      const result = await this.followName(
        wildcardNorm,
        name,
        new Set(visited),
        depth + 1,
        barrels
      );
      if (result !== null) {
        return result;
      }
    }

    return null;
  }

  /**
   * Lazily parses and caches the barrel info (named re-exports + wildcard specifiers)
   * for `filePath`. Returns empty info for files that cannot be read or have no exports.
   */
  private barrelInfoOnce(filePath: string): Promise<BarrelInfo> {
    const existing = this.barrelInfoCache.get(filePath);
    if (existing) {
      return existing;
    }
    const promise = (async (): Promise<BarrelInfo> => {
      let source: string;
      try {
        source = await readFile(filePath, 'utf8');
      } catch {
        return { named: new Map(), wildcards: [] };
      }
      try {
        return await parseBarrelInfo(filePath, source);
      } catch {
        return { named: new Map(), wildcards: [] };
      }
    })();
    this.barrelInfoCache.set(filePath, promise);
    return promise;
  }

  /** Drops all cached entries for `filePath`. Call on every `change`/`unlink` event. */
  invalidate(filePath: string): void {
    this.parseCache.delete(filePath);
    this.resolveCache.delete(filePath);
    this.barrelInfoCache.delete(filePath);
  }

  /** Test-only: full reset. */
  clear(): void {
    this.parseCache.clear();
    this.resolveCache.clear();
    this.barrelInfoCache.clear();
  }
}
