import { resolve, sep } from 'node:path';

export const getNextjsVersion = (): string => require(scopedResolve('next/package.json')).version;

/**
 * @example
 *
 * ```
 * // before main script path truncation
 * require.resolve('styled-jsx') === '/some/path/node_modules/styled-jsx/index.js
 * // after main script path truncation
 * scopedResolve('styled-jsx') === '/some/path/node_modules/styled-jsx'
 * ```
 *
 * @example
 *
 * ```
 * // referencing a named export of a package
 * scopedResolve('next/dist/compiled/react-dom/client') ===
 *   // returns the path to the package export without the script filename
 *   '/some/path/node_modules/next/dist/compiled/react-dom/client';
 *
 * // referencing a specific file within a CJS package
 * scopedResolve('next/dist/compiled/react-dom/cjs/react-dom-test-utils.production.js') ===
 *   // returns the path to the physical file, including the script filename
 *   '/some/path/node_modules/next/dist/compiled/react-dom/cjs/react-dom-test-utils.production.js';
 * ```
 *
 * @param id The module id or script file to resolve
 * @returns An absolute path to the specified module id or script file scoped to the project folder
 * @summary
 * This is to help the addon in development.
 * Without it, the addon resolves packages in its node_modules instead of the example's node_modules.
 * Because require.resolve will also include the main script as part of the path, this function strips
 * that to just include the path to the module folder when the id provided is a package or named export.
 */
export const scopedResolve = (id: string): string => {
  let scopedModulePath;

  try {
    // TODO: Remove in next major release (SB 9.0) and use the statement in the catch block per default instead
    scopedModulePath = require.resolve(id, { paths: [resolve()] });
  } catch (e) {
    scopedModulePath = require.resolve(id);
  }

  const idWithNativePathSep = id.replace(/\//g /* all '/' occurrences */, sep);

  // If the id referenced the file specifically, return the full module path & filename
  if (scopedModulePath.endsWith(idWithNativePathSep)) {
    return scopedModulePath;
  }

  // Otherwise, return just the path to the module folder or named export
  const moduleFolderStrPosition = scopedModulePath.lastIndexOf(idWithNativePathSep);
  const beginningOfMainScriptPath = moduleFolderStrPosition + id.length;
  return scopedModulePath.substring(0, beginningOfMainScriptPath);
};
