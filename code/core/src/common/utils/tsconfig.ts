import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, relative, resolve } from 'node:path';

import * as find from 'empathic/find';
import picomatch from 'picomatch';
import stripJsonComments from 'strip-json-comments';

import { getProjectRoot } from './paths.ts';

const TSCONFIG_CANDIDATES = ['tsconfig.json', 'tsconfig.base.json', 'tsconfig.app.json'] as const;
const DEFAULT_EXCLUDE_PATTERNS = ['node_modules', 'bower_components', 'jspm_packages'];

type TsconfigReference = { path?: unknown };
type TsconfigConfig = {
  exclude?: unknown;
  files?: unknown;
  include?: unknown;
  references?: unknown;
};

type TsconfigEntry = {
  config: TsconfigConfig;
  path: string;
};

export const findTsconfigPath = (cwd: string): string | undefined => {
  const projectRoot = getProjectRoot();

  for (const candidate of TSCONFIG_CANDIDATES) {
    const found = find.up(candidate, { cwd, last: projectRoot });
    if (found) {
      return found;
    }
  }

  return undefined;
};

/**
 * Pick the tsconfig that actually applies to a given file, following project references when the
 * nearest root config is just a references shell (for example Vite's `files: []` root tsconfig).
 *
 * This intentionally follows the same idea as the Volar-inspired selection logic used by
 * `ComponentMetaManager`: prefer the config that really owns the file instead of stopping at the
 * first config filename we discover. It extends the simpler fallback-chain fix from #34353 so
 * docgen-style callers can handle project references too.
 */
export const findTsconfigPathForFile = (cwd: string, filePath: string): string | undefined => {
  const rootTsconfigPath = findTsconfigPath(cwd);
  if (!rootTsconfigPath) {
    return undefined;
  }

  const absoluteFilePath = resolve(filePath);
  const matchingConfigs = collectTsconfigEntries(rootTsconfigPath, new Set()).filter((entry) =>
    tsconfigIncludesFile(entry, absoluteFilePath)
  );

  matchingConfigs.sort((left, right) => compareTsconfigEntries(absoluteFilePath, left, right));

  return matchingConfigs[0]?.path ?? rootTsconfigPath;
};

/**
 * Resolve a tsconfig for either a source file or a directory.
 * Prefer file paths when available; directories must not be passed through
 * `findTsconfigPathForFile` (that would `dirname` them and search from the parent).
 */
export const findTsconfigPathForPath = (path: string): string | undefined => {
  if (isDirectoryPath(path)) {
    return findTsconfigPath(path);
  }

  return findTsconfigPathForFile(dirname(path), path);
};

function isDirectoryPath(path: string) {
  try {
    if (existsSync(path)) {
      return statSync(path).isDirectory();
    }
  } catch {
    // Fall through to the extension heuristic below.
  }

  // Non-existent paths: treat extensionless values (e.g. cwd-like basedirs) as directories.
  return extname(path) === '';
}

function collectTsconfigEntries(configPath: string, seen: Set<string>): TsconfigEntry[] {
  const normalizedConfigPath = resolve(configPath);
  if (seen.has(normalizedConfigPath)) {
    return [];
  }
  seen.add(normalizedConfigPath);

  const config = readTsconfigConfig(normalizedConfigPath);
  if (!config) {
    return [];
  }

  return [
    { path: normalizedConfigPath, config },
    ...getReferencedTsconfigPaths(normalizedConfigPath, config).flatMap((referencePath) =>
      collectTsconfigEntries(referencePath, seen)
    ),
  ];
}

function getReferencedTsconfigPaths(configPath: string, config: TsconfigConfig) {
  const references = Array.isArray(config.references)
    ? (config.references as TsconfigReference[])
    : [];

  return references
    .map((reference) => reference.path)
    .filter((referencePath): referencePath is string => typeof referencePath === 'string')
    .map((referencePath) => resolve(dirname(configPath), referencePath))
    .flatMap((referencePath) => resolveReferenceConfigPaths(referencePath));
}

function resolveReferenceConfigPaths(referencePath: string) {
  if (referencePath.endsWith('.json')) {
    return [referencePath];
  }

  return TSCONFIG_CANDIDATES.map((candidate) => resolve(referencePath, candidate));
}

function tsconfigIncludesFile(entry: TsconfigEntry, filePath: string) {
  const configDir = dirname(entry.path);
  const relativeFilePath = normalizePath(relative(configDir, filePath));
  if (relativeFilePath.startsWith('../') || relativeFilePath === '..') {
    return false;
  }

  const files = asStringArray(entry.config.files);
  if (files.length > 0) {
    const normalizedFilePath = normalizePath(filePath);
    return files.some(
      (candidatePath) => normalizePath(resolve(configDir, candidatePath)) === normalizedFilePath
    );
  }

  const includePatterns = getIncludePatterns(entry.config);
  if (includePatterns.length === 0) {
    return false;
  }

  const excludePatterns = [...DEFAULT_EXCLUDE_PATTERNS, ...asStringArray(entry.config.exclude)].map(
    normalizeTsconfigPattern
  );

  if (matchesPatterns(relativeFilePath, excludePatterns)) {
    return false;
  }

  return matchesPatterns(relativeFilePath, includePatterns);
}

function getIncludePatterns(config: TsconfigConfig) {
  const includes = asStringArray(config.include);
  if (includes.length > 0) {
    return includes.map(normalizeTsconfigPattern);
  }

  const files = asStringArray(config.files);
  if (files.length > 0) {
    return files.map(normalizePath);
  }

  if (Array.isArray(config.references) && files.length === 0) {
    return [];
  }

  return ['**/*'];
}

function compareTsconfigEntries(filePath: string, left: TsconfigEntry, right: TsconfigEntry) {
  const leftDir = dirname(left.path);
  const rightDir = dirname(right.path);
  const leftDepth = normalizePath(relative(leftDir, filePath)).split('/').length;
  const rightDepth = normalizePath(relative(rightDir, filePath)).split('/').length;

  if (leftDepth !== rightDepth) {
    return leftDepth - rightDepth;
  }

  const leftIsPrimaryTsconfig = basename(left.path) === 'tsconfig.json' ? 1 : 0;
  const rightIsPrimaryTsconfig = basename(right.path) === 'tsconfig.json' ? 1 : 0;

  return rightIsPrimaryTsconfig - leftIsPrimaryTsconfig;
}

function readTsconfigConfig(configPath: string): TsconfigConfig | undefined {
  /*
   * Do NOT use `typescript.readConfigFile` (or any static `import 'typescript'`) here.
   *
   * This module is exported from `storybook/internal/common`. A top-level TypeScript import
   * pulls the full `typescript` package into every consumer of that barrel — including unit-test
   * processes that only touch unrelated helpers. That has OOM'd the CI Vitest runs (~4GB heap)
   * and timed out imports that load `common` transitively (e.g. docgen-harness loading react
   * `utils.ts`).
   *
   * Prefer the lightweight JSONC path: strip comments + trailing commas, then `JSON.parse`.
   * Enable `trailingCommas` so Vite-style / editor-formatted tsconfigs still parse; without it
   * a trailing comma makes `JSON.parse` fail and we silently skip that config.
   */
  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(stripJsonComments(content, { trailingCommas: true })) as TsconfigConfig;
  } catch {
    return undefined;
  }
}

function matchesPatterns(filePath: string, patterns: string[]) {
  return patterns.some((pattern) => picomatch(pattern, { dot: true })(filePath));
}

function normalizeTsconfigPattern(pattern: string) {
  const normalizedPattern = normalizePath(pattern);
  if (normalizedPattern.endsWith('/')) {
    return `${normalizedPattern}**/*`;
  }

  if (!picomatch.scan(normalizedPattern).isGlob && !/\.[^/]+$/.test(normalizedPattern)) {
    return `${normalizedPattern}/**/*`;
  }

  return normalizedPattern;
}

function normalizePath(value: string) {
  return value.replaceAll('\\', '/');
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
