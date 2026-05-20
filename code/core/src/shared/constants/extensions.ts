/**
 * JS-only module extensions. Used by code that loads runtime JS modules through Node's resolver
 * without TypeScript transpilation in scope.
 */
export const jsModuleExtensions = ['.mjs', '.js', '.cjs'] as const;

/**
 * JS/TS source file extensions (incl. JSX/TSX). Used by parsers, bundlers, and other tooling that
 * understands both languages but not framework single-file-component formats.
 */
export const jsTsSourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const;

/**
 * Storybook config file extensions for `main.{ext}`, `preview.{ext}`, `manager.{ext}`. Covers the
 * JS/TS family plus the Node module-system variants (`.mts`, `.cts`, etc.).
 */
export const storybookConfigExtensions = [
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.mjs',
  '.mts',
  '.mtsx',
  '.cjs',
  '.cts',
  '.ctsx',
] as const;

/**
 * Module file extensions for user-code resolution (e.g. `sb.mock()`). Covers JS/TS plus JSON and
 * common single-file-component types (`.vue`, `.svelte`).
 */
export const userModuleExtensions = [
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.json',
  '.vue',
  '.svelte',
] as const;
