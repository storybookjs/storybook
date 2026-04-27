import { ResolverFactory as OxcResolverFactory } from 'oxc-resolver';
import { dirname } from 'pathe';

import { logger } from 'storybook/internal/node-logger';

import type { ResolveConfig } from '../adapters/types.ts';
import { profiler } from '../profiling.ts';

const DEFAULT_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs', '.json'];
const DEFAULT_CONDITIONS = ['storybook', 'import', 'module', 'default'];

/**
 * Thin wrapper around `oxc-resolver`'s `ResolverFactory` configured per the
 * change-detection `ResolveConfig`. Normalises the alias map shape and converts
 * resolver errors to `null` (with a debug log) — the caller treats unresolvable
 * specifiers as opaque-leaf edges.
 */
export class ChangeDetectionResolverFactory {
  private readonly factory: OxcResolverFactory;

  constructor(config: ResolveConfig) {
    const alias = normaliseAlias(config.alias);
    const conditionNames = config.conditions ?? DEFAULT_CONDITIONS;

    this.factory = new OxcResolverFactory({
      tsconfig: config.tsconfigPath
        ? { configFile: config.tsconfigPath, references: 'auto' }
        : undefined,
      alias,
      conditionNames,
      extensions: DEFAULT_EXTENSIONS,
    });
  }

  /**
   * Resolves `specifier` from the file at `from` (must be an absolute path).
   * Returns the absolute resolved path, or `null` if the resolver could not
   * locate it. Never throws — internal errors are converted to `null` and a
   * debug-level log line is emitted.
   */
  async resolve(from: string, specifier: string): Promise<string | null> {
    if (profiler.enabled) {
      profiler.recordResolve();
    }
    const directory = dirname(from);
    try {
      const result = await this.factory.async(directory, specifier);
      if (result.path) {
        return result.path;
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

/**
 * `ResolveConfig.alias` accepts both Vite shapes:
 *   - `Record<string, string>` (object form)
 *   - `Array<{ find: string | RegExp; replacement: string }>` (array form)
 *
 * `oxc-resolver` expects `Record<string, Array<string | undefined | null>>`.
 * RegExp `find` entries cannot be expressed in oxc-resolver's alias config and
 * are skipped with a debug log (downgraded to opaque-leaf at resolve time).
 */
let warnedRegexAliases = false;

function normaliseAlias(
  alias: ResolveConfig['alias']
): Record<string, Array<string | undefined | null>> | undefined {
  if (!alias) {
    return undefined;
  }

  const out: Record<string, Array<string | undefined | null>> = {};
  const skippedRegex: string[] = [];

  if (Array.isArray(alias)) {
    for (const entry of alias) {
      if (typeof entry.find === 'string') {
        out[entry.find] = [entry.replacement];
      } else {
        skippedRegex.push(String(entry.find));
      }
    }
  } else {
    for (const [find, replacement] of Object.entries(alias)) {
      out[find] = [replacement];
    }
  }

  if (skippedRegex.length > 0) {
    if (!warnedRegexAliases) {
      warnedRegexAliases = true;
      logger.warn(
        `Change detection: ignored ${skippedRegex.length} regex alias(es) — oxc-resolver only supports literal string aliases. ` +
          `Modules matched by [${skippedRegex.slice(0, 3).join(', ')}${skippedRegex.length > 3 ? ', …' : ''}] will be tracked as opaque-leaf.`
      );
    } else {
      for (const pattern of skippedRegex) {
        logger.debug(`ChangeDetectionResolverFactory: skipping regex alias '${pattern}'`);
      }
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/** Test-only: reset the warn-once latch between cases. */
export function _resetResolverWarnLatchForTesting(): void {
  warnedRegexAliases = false;
}
