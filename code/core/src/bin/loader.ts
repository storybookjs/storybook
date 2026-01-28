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

import { deprecate } from 'storybook/internal/node-logger';

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

const jsToTsExtensionMap: Record<string, readonly string[]> = {
  '.js': ['.ts', '.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
  '.jsx': ['.tsx'],
};

/**
 * Resolves an extensionless file path by trying different extensions. Returns the path with the
 * correct extension if found, otherwise returns the original path.
 * Also handles .js → .ts resolution for TypeScript projects using moduleResolution "Node16"
 * or "NodeNext", where imports use .js extensions but source files are .ts.
 */
export function resolveWithExtension(importPath: string, currentFilePath: string): string {
  const extImportPath = path.extname(importPath);
  const currentDir = path.dirname(currentFilePath);

  // Handle .js/.mjs/.cjs/.jsx imports that might need to resolve to TypeScript files
  if (extImportPath && extImportPath in jsToTsExtensionMap) {
    const absolutePath = path.resolve(currentDir, importPath);

    // If the JS file exists, use it as-is
    if (existsSync(absolutePath)) {
      return importPath;
    }

    // Try TypeScript alternatives (.js → .ts/.tsx, .mjs → .mts, etc.)
    const basePath = importPath.slice(0, -extImportPath.length);
    const tsExtensions = jsToTsExtensionMap[extImportPath];

    for (const tsExt of tsExtensions) {
      const candidatePath = path.resolve(currentDir, `${basePath}${tsExt}`);
      if (existsSync(candidatePath)) {
        return `${basePath}${tsExt}`;
      }
    }

    // No TypeScript alternative found, return original path
    return importPath;
  }

  // If the import has a non-JS extension, return it as-is
  if (extImportPath) {
    return importPath;
  }

  deprecate(dedent`
    One or more extensionless imports detected: "${importPath}" in file "${currentFilePath}".
    For more information on how to resolve the issue: 
    https://storybook.js.org/docs/faq#extensionless-imports-in-storybookmaints-and-required-ts-extensions
  `);

  const absolutePath = path.resolve(currentDir, importPath);

  for (const ext of supportedExtensions) {
    const candidatePath = `${absolutePath}${ext}`;
    if (existsSync(candidatePath)) {
      return `${importPath}${ext}`;
    }
  }

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
    // import('./path') or import("../path") - dynamic imports with quotes (with closing paren, no concatenation)
    /(\bimport\s*\(\s*['"])(\.[^'"]+)(['"]\s*\))/g,
    // import(`./path`) - dynamic imports with backticks (with closing paren, no template interpolation)
    /(\bimport\s*\(\s*`)(\.[^`$]+)(`\s*\))/g,
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
