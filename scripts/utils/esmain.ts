import { createRequire } from 'node:module';
import { extname } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * Strip the extension from a filename if it has one.
 * @param {string} name A filename.
 * @return {string} The filename without a path.
 */
export function stripExt(name: string) {
  const extension = extname(name);
  if (!extension) {
    return name;
  }

  return name.slice(0, -extension.length);
}

/**
 * Check if a module was run directly with node as opposed to being
 * imported from another module.
 */
export function esMain(url: string) {
  if (!url || !process.argv[1]) {
    return false;
  }

  const require = createRequire(url);
  const scriptPath = require.resolve(process.argv[1]);

  const modulePath = fileURLToPath(url);

  const extension = extname(scriptPath);
  if (extension) {
    return modulePath === scriptPath;
  }

  return stripExt(modulePath) === scriptPath;
}
