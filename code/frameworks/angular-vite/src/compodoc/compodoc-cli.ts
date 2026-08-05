import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Locates Compodoc's CLI entry point so it can be run as `node <cli>`.
 *
 * The project is searched before this package, so a workspace that pins its own Compodoc gets that
 * one rather than whatever happens to sit next to the framework. Returns `undefined` when Compodoc
 * is not installed at all, which is a configuration problem for the caller to report.
 */
export const resolveCompodocCli = (workspaceRoot: string): string | undefined => {
  const searchFrom = [pathToFileURL(join(resolve(workspaceRoot), 'noop.js')).href, import.meta.url];

  for (const from of searchFrom) {
    try {
      const packageJsonPath = createRequire(from).resolve('@compodoc/compodoc/package.json');
      const { bin } = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const entry = typeof bin === 'string' ? bin : bin?.compodoc;
      if (entry) {
        return join(dirname(packageJsonPath), entry);
      }
    } catch {
      // Not resolvable from here; try the next root.
    }
  }

  return undefined;
};
