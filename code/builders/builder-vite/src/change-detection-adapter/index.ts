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

      return {
        projectRoot: server.config.root,
        alias,
        conditions,
      };
    },

    onFileChange(handler) {
      const FORWARDED_EVENTS = new Set<FileChangeEvent['kind']>(['add', 'change', 'unlink']);
      const isForwardedEvent = (name: string): name is FileChangeEvent['kind'] =>
        FORWARDED_EVENTS.has(name as FileChangeEvent['kind']);

      const onAll = (eventName: string, path: string) => {
        if (!isForwardedEvent(eventName)) {
          return;
        }
        handler({ kind: eventName, path: normalize(path) });
      };
      server.watcher.on('all', onAll);
      return () => {
        server.watcher.off('all', onAll);
      };
    },
  };
}
