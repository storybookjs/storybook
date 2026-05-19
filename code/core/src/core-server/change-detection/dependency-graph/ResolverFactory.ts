import { join } from 'pathe';

import { ResolverFactory as OxcResolverFactory } from 'oxc-resolver';

import { logger } from 'storybook/internal/node-logger';

import type { ModuleResolveConfig } from '../adapters/types.ts';

const DEFAULT_EXTENSIONS = ['.tsx', '.ts', '.d.ts', '.jsx', '.js', '.mjs', '.cjs', '.json'];
const DEFAULT_CONDITIONS = ['storybook', 'import', 'module', 'default'];

/**
 * `ModuleResolveConfig.alias` accepts both Vite shapes:
 *   - `Record<string, string>` (object form)
 *   - `Array<{ find: string | RegExp; replacement: string }>` (array form)
 *
 * `oxc-resolver` expects `Record<string, Array<string | undefined | null>>`.
 * RegExp `find` entries cannot be expressed in oxc-resolver's alias config and
 * are skipped with a debug log (downgraded to opaque-leaf at resolve time).
 *
 * Instance-scoped so each ChangeDetectionResolverFactory warns independently —
 * multiple service instances in the same process do not suppress each other's warnings.
 */
class AliasNormalizer {
  private readonly warnedRegexAliases = new Set<string>();

  normalize(
    alias: ModuleResolveConfig['alias']
  ): Record<string, Array<string | undefined | null>> | undefined {
    if (!alias) {
      return undefined;
    }

    const out: Record<string, Array<string | undefined | null>> = {};
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
 * Thin wrapper around `oxc-resolver`'s `ResolverFactory` configured per a
 * builder-supplied {@link ModuleResolveConfig}. Normalizes the alias map shape and
 * converts resolver errors to `null` (with a debug log) — the caller treats
 * unresolvable specifiers as opaque-leaf edges.
 */
export class ChangeDetectionResolverFactory {
  private readonly factory: OxcResolverFactory;
  private readonly aliasNormalizer = new AliasNormalizer();
  /**
   * Virtual entry point placed directly in the project root.
   *
   * Used as the fallback `from` path when the primary resolution fails.
   * Resolving from here guarantees that `resolveFileAsync`'s tsconfig
   * walk-up reaches the root `tsconfig.json` before any intermediate
   * per-package tsconfig — so workspace-level `paths` mappings are
   * consulted even when the per-package tsconfig does not extend root.
   */
  private readonly projectRootEntry: string;

  constructor(config: ModuleResolveConfig) {
    const alias = this.aliasNormalizer.normalize(config.alias);
    const conditionNames = config.conditions ?? DEFAULT_CONDITIONS;

    this.factory = new OxcResolverFactory({
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
      const result = await this.factory.resolveFileAsync(from, specifier);
      if (result.path) {
        return result.path;
      }

      // Fallback: retry from the project root so that root-level tsconfig paths
      // and root node_modules are consulted.  Skip the fallback when `from` is
      // already the virtual root entry to avoid a redundant second attempt.
      if (from !== this.projectRootEntry) {
        const rootResult = await this.factory.resolveFileAsync(this.projectRootEntry, specifier);
        if (rootResult.path) {
          return rootResult.path;
        }
        if (result.error ?? rootResult.error) {
          logger.debug(
            `ChangeDetectionResolverFactory: '${specifier}' from '${from}' unresolved (${result.error ?? rootResult.error})`
          );
        }
        return null;
      }

      if (result.error) {
        logger.debug(
          `ChangeDetectionResolverFactory: '${specifier}' from '${from}' unresolved (${result.error})`
        );
      }
      return null;
    } catch (error) {
      logger.debug(
        `ChangeDetectionResolverFactory: error resolving '${specifier}' from '${from}': ${String(error)}`
      );
      return null;
    }
  }
}
