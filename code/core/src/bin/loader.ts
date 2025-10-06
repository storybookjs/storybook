/**
 * This is an isolated file that is registered as a loader in Node. It is used to convert TS to ESM
 * using esbuild. Do _not_ import from other modules in core unless strictly necessary, as it will
 * cause the dist to get huge.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { LoadHook } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { logger } from 'storybook/internal/node-logger';

import { transform } from 'esbuild';
import { dedent } from 'ts-dedent';

import { NODE_TARGET } from '../shared/constants/environments-support';

export const supportedExtensions = [
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.mts',
  '.cts',
  '.tsx',
] as const;

/**
 * Resolves an extensionless file path by trying different extensions. Returns the path with the
 * correct extension if found, otherwise returns the original path.
 */
export function resolveWithExtension(importPath: string, currentFilePath: string): string {
  // If the import already has an extension, return it as-is
  if (path.extname(importPath)) {
    return importPath;
  }

  logger.warn(dedent`Extensionless import detected: "${importPath}" in file "${currentFilePath}".
    For maximum compatibility, you should add an explicit file extension to this import.
    Storybook will attempt to resolve it automatically, but this may change in the future.`);

  // Resolve the import path relative to the current file
  const currentDir = path.dirname(currentFilePath);
  const absolutePath = path.resolve(currentDir, importPath);

  for (const ext of supportedExtensions) {
    const candidatePath = `${absolutePath}${ext}`;
    if (existsSync(candidatePath)) {
      logger.warn(`Resolved to "${importPath}${ext}"`);
      return `${importPath}${ext}`;
    }
  }

  // If no file is found, warn about the likely error
  logger.warn(`Could not resolve "${importPath}"`);
  logger.warn(
    `This will likely result in an ERR_MODULE_NOT_FOUND error. Please add an explicit file extension to the import.`
  );
  return importPath;
}

/**
 * Adds extensions to relative imports in the source code. This is necessary because Node.js ESM
 * requires explicit extensions for relative imports.
 */
export function addExtensionsToRelativeImports(source: string, filePath: string): string {
  // Regex patterns to match different import/export syntaxes with relative paths
  const patterns = [
    // import/export ... from './path' or "../path" (including side-effect imports)
    /(\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"])(\.[^'"]+)(['"])/g,
    // import('./path') or import("../path") - dynamic imports
    /(\bimport\s*\(\s*['"])(\.[^'"]+)(['"])/g,
  ];

  let result = source;
  for (const pattern of patterns) {
    result = result.replace(pattern, (match, prefix, path, suffix) => {
      // Only process relative paths (starting with ./ or ../)
      if (path.startsWith('./') || path.startsWith('../')) {
        const resolvedPath = resolveWithExtension(path, filePath);
        return `${prefix}${resolvedPath}${suffix}`;
      }
      return match;
    });
  }

  return result;
}

export const load: LoadHook = async (url, context, nextLoad) => {
  /** Convert TS to ESM using esbuild */
  if (
    url.endsWith('.ts') ||
    url.endsWith('.tsx') ||
    url.endsWith('.mts') ||
    url.endsWith('.cts') ||
    url.endsWith('.mtsx') ||
    url.endsWith('.ctsx')
  ) {
    const filePath = fileURLToPath(url);
    const rawSource = await readFile(filePath, 'utf-8');
    const transformedSource = await transform(rawSource, {
      loader: 'ts',
      target: NODE_TARGET,
      format: 'esm',
      platform: 'neutral',
    });

    // Add extensions to relative imports so Node.js ESM can resolve them
    const sourceWithExtensions = addExtensionsToRelativeImports(transformedSource.code, filePath);

    return {
      format: 'module',
      shortCircuit: true,
      source: sourceWithExtensions,
    };
  }

  return nextLoad(url, context);
};
