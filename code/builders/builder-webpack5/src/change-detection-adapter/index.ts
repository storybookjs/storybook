import type {
  ChangeDetectionAdapter,
  FileChangeEvent,
  ModuleResolveConfig,
} from 'storybook/internal/core-server';

import { logger } from 'storybook/internal/node-logger';

import { normalize } from 'pathe';
import type { Compiler } from 'webpack';

/**
 * Webpack implementation of {@link ChangeDetectionAdapter}.
 *
 * - `getResolveConfig()` reads `compiler.options.resolve` and `compiler.context` once at startup.
 * - `onFileChange()` taps `compiler.hooks.watchRun` and forwards `modifiedFiles` as `add`/`change`
 *   and `removedFiles` as `unlink` events. File kind (add vs change) is inferred by tracking which
 *   paths webpack has reported at least once.
 *
 * Note: on first watch run `modifiedFiles` may be undefined (initial full build). Events are only
 * emitted for subsequent incremental runs where webpack populates the sets.
 */
export function createWebpackChangeDetectionAdapter(compiler: Compiler): ChangeDetectionAdapter {
  return {
    async getResolveConfig(): Promise<ModuleResolveConfig> {
      const resolveOpts = compiler.options.resolve;
      return {
        projectRoot: compiler.context,
        alias: normaliseWebpackAlias(resolveOpts.alias),
        conditions: resolveOpts.conditionNames,
      };
    },

    onFileChange(handler: (event: FileChangeEvent) => void): () => void {
      let active = true;
      let firstRun = true;
      const seenFiles = new Set<string>();

      compiler.hooks.watchRun.tap('StorybookChangeDetection', (watchingCompiler) => {
        if (!active) return;

        for (const filePath of watchingCompiler.modifiedFiles ?? []) {
          const path = normalize(filePath);
          // On firstRun, seenFiles is empty but files already exist — treat as 'change'
          const kind: FileChangeEvent['kind'] =
            !firstRun && !seenFiles.has(path) ? 'add' : 'change';
          seenFiles.add(path);
          handler({ kind, path });
        }

        for (const filePath of watchingCompiler.removedFiles ?? []) {
          const path = normalize(filePath);
          seenFiles.delete(path);
          handler({ kind: 'unlink', path });
        }

        firstRun = false;
      });

      return () => {
        active = false;
      };
    },
  };
}

type WebpackResolveAlias = NonNullable<
  NonNullable<import('webpack').Configuration['resolve']>['alias']
>;

function normaliseWebpackAlias(
  alias: WebpackResolveAlias | undefined
): ModuleResolveConfig['alias'] | undefined {
  if (!alias) return undefined;

  if (Array.isArray(alias)) {
    const entries: Array<{ find: string; replacement: string }> = [];
    for (const entry of alias) {
      const replacement =
        typeof entry.alias === 'string'
          ? entry.alias
          : Array.isArray(entry.alias) && entry.alias.length > 0
            ? entry.alias[0]
            : null;
      if (replacement != null) {
        entries.push({ find: entry.name, replacement });
      }
    }
    return entries.length > 0 ? entries : undefined;
  }

  const record: Record<string, string> = {};
  for (const [key, value] of Object.entries(alias as Record<string, string | false | string[]>)) {
    if (typeof value === 'string') {
      record[key] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      if (value.length > 1) {
        logger.debug(
          `Change detection: webpack alias "${key}" has ${value.length} values; using only the first: "${value[0]}"`
        );
      }
      record[key] = value[0];
    }
    // false = disabled alias, skip
  }
  return Object.keys(record).length > 0 ? record : undefined;
}
