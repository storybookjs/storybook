import { readFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getProjectRoot } from 'storybook/internal/common';

import { WebpackDefinePlugin } from '@storybook/builder-webpack5';

import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';
import nextJsLoadConfigModule from 'next/dist/server/config.js';
import semver from 'semver';
import type { Configuration as WebpackConfig } from 'webpack';

import { resolvePackageDir } from '../../../core/src/shared/utils/module';

export const configureRuntimeNextjsVersionResolution = (baseConfig: WebpackConfig): void => {
  baseConfig.plugins?.push(
    new WebpackDefinePlugin({
      'process.env.__NEXT_VERSION': JSON.stringify(getNextjsVersion()),
    })
  );
};

export const getNextjsVersion = (): string =>
  JSON.parse(readFileSync(join(resolvePackageDir('next'), 'package.json'), 'utf8')).version;

export const isNextVersionGte = (version: string): boolean => {
  const currentVersion = getNextjsVersion();
  const coercedVersion = semver.coerce(currentVersion);
  return coercedVersion ? semver.gte(coercedVersion, version) : false;
};

export const resolveNextConfig = async ({
  nextConfigPath,
}: {
  nextConfigPath?: string;
}): Promise<NextConfig> => {
  const dir = nextConfigPath ? dirname(nextConfigPath) : getProjectRoot();
  const loadConfig = (nextJsLoadConfigModule as any).default ?? nextJsLoadConfigModule;

  // This hack is necessary to prevent Next.js override Node.js' module resolution
  // Next.js attempts to set aliases for webpack imports on the module resolution level
  // which leads to two webpack versions used at the same time. It seems that Next.js doesn't
  // forward/alias all possible webpack imports.
  const nextPrivateRenderWorker = process.env.__NEXT_PRIVATE_RENDER_WORKER;

  process.env.__NEXT_PRIVATE_RENDER_WORKER = 'defined';

  const config = loadConfig(PHASE_DEVELOPMENT_SERVER, dir, undefined);

  if (typeof nextPrivateRenderWorker === 'undefined') {
    delete process.env.__NEXT_PRIVATE_RENDER_WORKER;
  } else {
    process.env.__NEXT_PRIVATE_RENDER_WORKER = nextPrivateRenderWorker;
  }

  return config;
};

export function setAlias(baseConfig: WebpackConfig, name: string, alias: string) {
  baseConfig.resolve ??= {};
  baseConfig.resolve.alias ??= {};
  const aliasConfig = baseConfig.resolve.alias;

  if (Array.isArray(aliasConfig)) {
    aliasConfig.push({
      name,
      alias,
    });
  } else {
    aliasConfig[name] = alias;
  }
}

// This is to help the addon in development
// Without it, webpack resolves packages in its node_modules instead of the example's node_modules
export const addScopedAlias = (baseConfig: WebpackConfig, name: string, alias?: string): void => {
  const scopedAlias = scopedResolve(`${alias ?? name}`);

  setAlias(baseConfig, name, scopedAlias);
};

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
  const scopedModulePath = fileURLToPath(import.meta.resolve(id));
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

/**
 * Returns a RegExp that matches node_modules except for the given transpilePackages.
 *
 * @param transpilePackages Array of package names to NOT exclude (i.e., to include for
 *   transpilation)
 * @returns RegExp for use in Webpack's exclude
 */
export function getNodeModulesExcludeRegex(transpilePackages: string[]): RegExp {
  if (!transpilePackages || transpilePackages.length === 0) {
    return /node_modules/;
  }
  const escaped = transpilePackages
    .map((pkg) => pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  return new RegExp(`node_modules/(?!(${escaped})/)`);
}
