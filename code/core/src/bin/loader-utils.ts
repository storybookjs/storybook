/**
 * Pure helpers shared by the two TypeScript loader registration paths: the off-thread worker
 * loader (`bin/loader.ts`, via `module.register`) and the in-thread sync hooks registered by
 * `shared/utils/module.ts` (via `module.registerHooks`). Keep this file dependency-light — it is
 * bundled into both.
 */
import { readdirSync } from 'node:fs';
import * as path from 'node:path';

import { deprecate } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';

/** File extensions the TypeScript loader hook transforms. */
export const TS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.mtsx', '.ctsx'] as const;

/** Does this URL (query string already stripped) point at a TypeScript source file? */
export function isTypeScriptUrl(urlWithoutQuery: string): boolean {
  return TS_EXTENSIONS.some((ext) => urlWithoutQuery.endsWith(ext));
}

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

const directoryCache = new Map<string, Set<string>>();

export function clearDirectoryCache(): void {
  directoryCache.clear();
}

function getDirectoryFiles(dir: string): Set<string> {
  if (!directoryCache.has(dir)) {
    try {
      directoryCache.set(dir, new Set(readdirSync(dir)));
    } catch {
      directoryCache.set(dir, new Set());
    }
  }
  return directoryCache.get(dir)!;
}

/**
 * Resolves an extensionless file path by trying different extensions. Returns the path with the
 * correct extension if found, otherwise returns the original path. Also handles .js → .ts
 * resolution for TypeScript projects using moduleResolution "Node16" or "NodeNext", where imports
 * use .js extensions but source files are .ts.
 */
export function resolveWithExtension(importPath: string, currentFilePath: string): string {
  const extImportPath = path.extname(importPath);
  const currentDir = path.dirname(currentFilePath);

  // Handle .js/.mjs/.cjs/.jsx imports that might need to resolve to TypeScript files
  // TypeScript Node16/NodeNext resolution order: .ts → .tsx → .d.ts → .js
  // So we check TypeScript alternatives FIRST, then fall back to JS
  if (extImportPath && extImportPath in jsToTsExtensionMap) {
    const basePath = importPath.slice(0, -extImportPath.length);
    const tsExtensions = jsToTsExtensionMap[extImportPath];

    // Try TypeScript alternatives first (.js → .ts/.tsx, .mjs → .mts, etc.)
    const absoluteBase = path.resolve(currentDir, basePath);
    const dirFiles = getDirectoryFiles(path.dirname(absoluteBase));
    const baseFileName = path.basename(absoluteBase);
    for (const tsExt of tsExtensions) {
      if (dirFiles.has(`${baseFileName}${tsExt}`)) {
        return `${basePath}${tsExt}`;
      }
    }

    // No TypeScript alternative found, fall back to original JS path
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

  const dirFiles = getDirectoryFiles(path.dirname(absolutePath));
  const baseFileName = path.basename(absolutePath);
  for (const ext of supportedExtensions) {
    if (dirFiles.has(`${baseFileName}${ext}`)) {
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
    result = result.replace(pattern, (match, prefix, importPath, suffix) => {
      // Only process relative paths (starting with ./ or ../)
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        const resolvedPath = resolveWithExtension(importPath, filePath);
        return `${prefix}${resolvedPath}${suffix}`;
      }
      return match;
    });
  }

  return result;
}
