import { join } from 'pathe';

import {
  type ModuleResolver,
  createModuleResolver,
  defaultResolveConditionNames,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import type { ModuleResolveConfig } from '../adapters/types.ts';

const DEFAULT_EXTENSIONS = ['.tsx', '.ts', '.d.ts', '.jsx', '.js', '.mjs', '.cjs', '.json'];

/**
 * `ModuleResolveConfig.alias` accepts both Vite shapes:
 *   - `Record<string, string>` (object form)
 *   - `Array<{ find: string | RegExp; replacement: string }>` (array form)
 *
 * The resolver expects `Record<string, string[]>`.
 * RegExp `find` entries cannot be expressed in the resolver's alias config and
 * are skipped with a debug log (downgraded to opaque-leaf at resolve time).
 *
 * Instance-scoped so each ChangeDetectionResolverFactory warns independently —
 * multiple service instances in the same process do not suppress each other's warnings.
 */
class AliasNormalizer {
  private readonly warnedRegexAliases = new Set<string>();

  normalize(alias: ModuleResolveConfig['alias']): Record<string, string[]> | undefined {
    if (!alias) {
      return undefined;
    }

    const out: Record<string, string[]> = {};
    const skippedRegex: string[] = [];

    if (Array.isArray(alias)) {
      for (const entry of alias) {
        if (typeof entry.find === 'string') {
          const find = entry.find.replace(/\/$/, '');
          const replacement = entry.replacement.replace(/\/$/, '');
          out[find] = [replacement];
        } else {
          skippedRegex.push(String(entry.find));
        }
      }
    } else {
      for (const [find, replacement] of Object.entries(alias)) {
        out[find.replace(/\/$/, '')] = [replacement.replace(/\/$/, '')];
      }
    }

    if (skippedRegex.length > 0) {
      const newPatterns = skippedRegex.filter((p) => !this.warnedRegexAliases.has(p));
      if (newPatterns.length > 0) {
        for (const p of newPatterns) {
          this.warnedRegexAliases.add(p);
        }
        logger.debug(
          `Change detection: ignored ${skippedRegex.length} regex alias(es); related modules tracked as opaque-leaf.`
        );
        logger.debug(
          `ChangeDetectionResolverFactory: skipped regex aliases [${skippedRegex.join(', ')}]`
        );
      } else {
        for (const pattern of skippedRegex) {
          logger.debug(`ChangeDetectionResolverFactory: skipping regex alias '${pattern}'`);
        }
      }
    }

    return Object.keys(out).length > 0 ? out : undefined;
  }
}

/**
 * Thin wrapper around Rolldown's `ResolverFactory` configured per a
 * builder-supplied {@link ModuleResolveConfig}. Normalizes the alias map shape and
 * converts resolver errors to `null` (with a debug log) — the caller treats
 * unresolvable specifiers as opaque-leaf edges.
 */
export class ChangeDetectionResolverFactory {
  private readonly resolver: ModuleResolver;
  private readonly aliasNormalizer = new AliasNormalizer();
  /**
   * Virtual entry point placed directly in the project root.
   *
   * Used as the fallback `from` path when the primary resolution fails.
   * Resolving from here guarantees that the resolver's tsconfig
   * walk-up reaches the root `tsconfig.json` before any intermediate
   * per-package tsconfig — so workspace-level `paths` mappings are
   * consulted even when the per-package tsconfig does not extend root.
   */
  private readonly projectRootEntry: string;

  constructor(config: ModuleResolveConfig) {
    const alias = this.aliasNormalizer.normalize(config.alias);
    const conditionNames = config.conditions ?? defaultResolveConditionNames;

    this.resolver = createModuleResolver({
      tsconfig: 'auto',
      alias,
      conditionNames,
      extensions: DEFAULT_EXTENSIONS,
    });

    this.projectRootEntry = join(config.projectRoot, '__sb_resolver_root__.ts');
  }

  /**
   * Resolves `specifier` from the file at `from` (must be an absolute path).
   *
   * Two-pass strategy:
   * 1. Resolve from `from` — handles per-package tsconfig paths and local node_modules.
   * 2. On failure, retry from the project root — picks up root-level tsconfig `paths`
   *    (e.g. workspace package aliases) that intermediate per-package tsconfigs may
   *    not inherit, as well as root-level node_modules symlinks.
   *
   * Returns the absolute resolved path, or `null` if both passes fail.
   * Never throws — internal errors are converted to `null` and a debug-level log
   * line is emitted.
   */
  async resolve(from: string, specifier: string): Promise<string | null> {
    try {
      return await this.resolver.resolveFile(from, specifier);
    } catch (error) {
      // Fallback: retry from the project root so that root-level tsconfig paths
      // and root node_modules are consulted.  Skip the fallback when `from` is
      // already the virtual root entry to avoid a redundant second attempt.
      if (from !== this.projectRootEntry) {
        try {
          return await this.resolver.resolveFile(this.projectRootEntry, specifier);
        } catch {
          // The debug line below reports the error of the first attempt.
        }
      }
      logger.debug(
        `ChangeDetectionResolverFactory: '${specifier}' from '${from}' unresolved (${String(error)})`
      );
      return null;
    }
  }
}
