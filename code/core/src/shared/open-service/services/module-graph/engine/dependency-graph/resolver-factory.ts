import { join } from 'pathe';

import { ResolverFactory as OxcResolverFactory } from 'oxc-resolver';
import type { NapiResolveOptions } from 'oxc-resolver';

import { defaultResolveConditionNames } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import type { ModuleResolveConfig } from '../adapters/types.ts';
import type { ImportEdge } from '../parser-registry/types.ts';

const DEFAULT_EXTENSIONS = ['.tsx', '.ts', '.d.ts', '.jsx', '.js', '.mjs', '.cjs', '.json'];

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
interface Resolvers {
  // Aliases, tsconfig `paths` and relative files, without `node_modules` or `NODE_PATH` lookup.
  paths: OxcResolverFactory;
  packages: OxcResolverFactory;
}

export class ChangeDetectionResolverFactory {
  private readonly importResolvers: Resolvers;
  private readonly requireResolvers: Resolvers;
  private readonly aliasNormalizer = new AliasNormalizer();
  /**
   * Virtual entry point placed directly in the project root.
   *
   * Resolving from here makes `resolveFileAsync`'s tsconfig walk-up reach the
   * root `tsconfig.json` before any intermediate per-package tsconfig, so
   * workspace-level `paths` mappings apply even when the per-package tsconfig
   * does not extend root.
   */
  private readonly projectRootEntry: string;

  constructor(config: ModuleResolveConfig) {
    const alias = this.aliasNormalizer.normalize(config.alias);
    const conditionNames = config.conditions ?? defaultResolveConditionNames;

    const options: NapiResolveOptions = {
      tsconfig: 'auto',
      alias,
      conditionNames,
      extensions: DEFAULT_EXTENSIONS,
    };
    const cache = new OxcResolverFactory(options);
    const resolversFor = (conditions: string[]): Resolvers => ({
      paths: cache.cloneWithOptions({
        ...options,
        conditionNames: conditions,
        modules: [],
        nodePath: false,
      }),
      packages: cache.cloneWithOptions({ ...options, conditionNames: conditions }),
    });
    this.importResolvers = resolversFor(conditionNames);
    this.requireResolvers = config.requireConditions
      ? resolversFor(config.requireConditions)
      : this.importResolvers;

    this.projectRootEntry = join(config.projectRoot, '__sb_resolver_root__.ts');
  }

  /**
   * Resolves `specifier` from the file at `from` (must be an absolute path), with the conditions
   * the builder applies to an edge of this `kind`.
   *
   * Aliases and tsconfig `paths` win over package resolution: first those of `from`, then those
   * of the project root, which maps workspace packages to their sources even when the
   * per-package tsconfig does not extend it. Only then does package resolution run through
   * `node_modules`, from `from` and then from the project root.
   *
   * Returns the absolute resolved path, or `null` if every attempt fails.
   * Never throws — internal errors are converted to `null` and a debug-level log
   * line is emitted.
   */
  async resolve(
    from: string,
    specifier: string,
    kind: ImportEdge['kind'] = 'static'
  ): Promise<string | null> {
    const { paths, packages } = kind === 'require' ? this.requireResolvers : this.importResolvers;
    const origins = from === this.projectRootEntry ? [from] : [from, this.projectRootEntry];
    try {
      for (const origin of origins) {
        const { path } = await paths.resolveFileAsync(origin, specifier);
        if (path) {
          return path;
        }
      }

      let error: string | undefined;
      for (const origin of origins) {
        const result = await packages.resolveFileAsync(origin, specifier);
        if (result.path) {
          return result.path;
        }
        error ??= result.error;
      }
      if (error) {
        logger.debug(
          `ChangeDetectionResolverFactory: '${specifier}' from '${from}' unresolved (${error})`
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
