import type {
  ChangeDetectionAdapter,
  FileChangeEvent,
  ModuleResolveConfig,
} from 'storybook/internal/core-server';

import { normalize } from 'pathe';
import type { ViteDevServer } from 'vite';

/**
 * Vite implementation of {@link ChangeDetectionAdapter}.
 *
 * - `getResolveConfig()` snapshots `server.config.resolve.alias`, `server.config.resolve.conditions`
 *   and `server.config.root` once at startup. The detector caches the result.
 * - `onFileChange()` subscribes to `server.watcher` (chokidar) and forwards `add`/`change`/`unlink`
 *   events with normalised absolute paths. Other chokidar event names (`addDir`, `unlinkDir`,
 *   `ready`, `raw`, `error`) are intentionally filtered out.
 *
 * `tsconfigPath` is left undefined unless the user explicitly set `resolve.tsconfig`. When omitted,
 * oxc-resolver auto-discovers tsconfig files by walking up from each parent dir.
 */
export function createViteChangeDetectionAdapter(server: ViteDevServer): ChangeDetectionAdapter {
  return {
    async getResolveConfig(): Promise<ModuleResolveConfig> {
      const resolveOpts = server.config.resolve;
      // Vite normalises `resolve.alias` to its array form (`Array<{find, replacement, ...}>`)
      // before we ever see it. The detector accepts both Record and Array shapes, so we pass
      // the array through unchanged.
      const alias = resolveOpts?.alias as ModuleResolveConfig['alias'];
      const conditions = resolveOpts?.conditions;
      // `tsconfig` is a non-standard Vite config option — only present when the user set it
      // explicitly. We forward it as-is; otherwise leave undefined so oxc-resolver auto-discovers.
      const tsconfigPath = (resolveOpts as { tsconfig?: string } | undefined)?.tsconfig;

      return {
        projectRoot: server.config.root,
        tsconfigPath,
        alias,
        conditions,
      };
    },

    onFileChange(handler) {
      const onAll = (eventName: string, path: string) => {
        let kind: FileChangeEvent['kind'];
        switch (eventName) {
          case 'add':
            kind = 'add';
            break;
          case 'change':
            kind = 'change';
            break;
          case 'unlink':
            kind = 'unlink';
            break;
          // Filter out 'addDir', 'unlinkDir', 'ready', 'raw', 'error' and any other chokidar
          // event we don't care about.
          default:
            return;
        }
        handler({ kind, path: normalize(path) });
      };
      server.watcher.on('all', onAll);
      return () => {
        server.watcher.off('all', onAll);
      };
    },
  };
}
