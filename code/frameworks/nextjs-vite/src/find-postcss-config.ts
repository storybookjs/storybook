// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { getProjectRoot } from 'storybook/internal/common';
import { IncompatiblePostCssConfigError } from 'storybook/internal/server-errors';

import config from 'lilconfig';
import postCssLoadConfig from 'postcss-load-config';
import yaml from 'yaml';

type Options = import('lilconfig').Options;

const require = createRequire(import.meta.url);

async function loader(filepath: string) {
  return require(filepath);
}

async function yamlLoader(_: string, content: string) {
  return yaml.parse(content);
}

const withLoaders = (options: Options = {}) => {
  const moduleName = 'postcss';

  return {
    ...options,
    loaders: {
      ...options.loaders,
      '.cjs': loader,
      '.cts': loader,
      '.js': loader,
      '.mjs': loader,
      '.mts': loader,
      '.ts': loader,
      '.yaml': yamlLoader,
      '.yml': yamlLoader,
    },
    searchPlaces: [
      ...(options.searchPlaces ?? []),
      'package.json',
      `.${moduleName}rc`,
      `.${moduleName}rc.json`,
      `.${moduleName}rc.yaml`,
      `.${moduleName}rc.yml`,
      `.${moduleName}rc.ts`,
      `.${moduleName}rc.cts`,
      `.${moduleName}rc.mts`,
      `.${moduleName}rc.js`,
      `.${moduleName}rc.cjs`,
      `.${moduleName}rc.mjs`,
      `${moduleName}.config.ts`,
      `${moduleName}.config.cts`,
      `${moduleName}.config.mts`,
      `${moduleName}.config.js`,
      `${moduleName}.config.cjs`,
      `${moduleName}.config.mjs`,
    ],
  } satisfies Options;
};

/**
 * Find PostCSS config file path (without loading the config)
 *
 * @param {String} path Config Path
 * @param {Object} options Config Options
 * @returns {Promise<string | null>} Config file path or null if not found
 */
export async function postCssFindConfig(path: string, options: Options = {}) {
  const result = await config.lilconfig('postcss', withLoaders(options)).search(path);

  return result ? result.filepath : null;
}

export { postCssLoadConfig };

/** Handle PostCSS config loading with fallback mechanism */
export const loadPostCssConfigWithFallback = async (searchPath: string): Promise<boolean> => {
  const configPath = await postCssFindConfig(searchPath);
  if (!configPath) {
    return true;
  }

  let error: any;

  // First attempt: try loading config as-is
  try {
    await postCssLoadConfig({}, searchPath, { stopDir: getProjectRoot() });
    return true; // Success!
  } catch (e: any) {
    error = e;
  }

  // No config found is not an error we need to handle
  if (error.message.includes('No PostCSS Config found')) {
    return true;
  }

  // NextJS uses an incompatible format for PostCSS plugins, we make an attempt to fix it
  if (error.message.includes('Invalid PostCSS Plugin found')) {
    // Second attempt: try with modified config
    try {
      const originalContent = await readFile(configPath, 'utf8');
      const modifiedContent = originalContent.replace(
        'plugins: ["@tailwindcss/postcss"]',
        'plugins: { "@tailwindcss/postcss": {} }'
      );

      // Write the modified content
      await writeFile(configPath, modifiedContent, 'utf8');

      // Retry loading the config
      await postCssLoadConfig({}, searchPath, { stopDir: getProjectRoot() });
      return true; // Success with modified config!
    } catch (e: any) {
      // We were unable to fix the config, so we throw an error
      throw new IncompatiblePostCssConfigError({ error });
    }
  }

  return false;
};
