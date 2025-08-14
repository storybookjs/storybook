import { realpathSync } from 'fs';
import type { ViteDevServer } from 'vite';

/**
 * Get the clean id of a module.
 *
 * @param id - The id of the module.
 * @returns Extracts the id of node_modules for optimized deps
 */
export function getCleanId(id: string) {
  return id
    .replace(/^.*\/deps\//, '') // Remove everything up to and including /deps/
    .replace(/\.js.*$/, '') // Remove .js and anything after (query params)
    .replace(/_/g, '/');
}

/**
 * Invalidate all related modules for a given mock (by absolute path and package name), including
 * optimized deps and node_modules variants.
 */
export function invalidateAllRelatedModules(
  server: ViteDevServer,
  absPath: string,
  pkgName: string
) {
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    if (mod.id === absPath || (mod.id && getCleanId(mod.id) === pkgName)) {
      server.moduleGraph.invalidateModule(mod);
    }
  }
}

export type MockCall = {
  path: string;
  absolutePath: string;
  redirectPath: string | null;
  spy: boolean;
};
