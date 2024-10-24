import { dirname, resolve, sep } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';

import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import loadConfig from 'next/dist/server/config';
import webpack from 'webpack';
import type { Configuration as WebpackConfig } from 'webpack';

export const configureRuntimeNextjsVersionResolution = (baseConfig: WebpackConfig): void => {
  baseConfig.plugins?.push(
    new webpack.DefinePlugin({
      'process.env.__NEXT_VERSION': JSON.stringify(getNextjsVersion()),
    })
  );
};

export const getNextjsVersion = (): string => require(scopedResolve('next/package.json')).version;

export const resolveNextConfig = async ({
  nextConfigPath,
}: {
  nextConfigPath?: string;
}): Promise<NextConfig> => {
  const dir = nextConfigPath ? dirname(nextConfigPath) : getProjectRoot();
  return loadConfig(PHASE_DEVELOPMENT_SERVER, dir, undefined);
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
 * @example // before main script path truncation require.resolve('styled-jsx') ===
 * '/some/path/node_modules/styled-jsx/index.js // after main script path truncation
 * scopedResolve('styled-jsx') === '/some/path/node_modules/styled-jsx'
 *
 * @param id The module id
 * @returns A path to the module id scoped to the project folder without the main script path at the
 *   end
 * @summary
 * This is to help the addon in development.
 * Without it, the addon resolves packages in its node_modules instead of the example's node_modules.
 * Because require.resolve will also include the main script as part of the path, this function strips
 * that to just include the path to the module folder
 */
export const scopedResolve = (id: string): string => {
  let scopedModulePath;

  try {
    // TODO: Remove in next major release (SB 9.0) and use the statement in the catch block per default instead
    scopedModulePath = require.resolve(id, { paths: [resolve()] });
  } catch (e) {
    scopedModulePath = require.resolve(id);
  }

  const moduleFolderStrPosition = scopedModulePath.lastIndexOf(
    id.replace(/\//g /* all '/' occurances */, sep)
  );
  const beginningOfMainScriptPath = moduleFolderStrPosition + id.length;
  return scopedModulePath.substring(0, beginningOfMainScriptPath);
};
