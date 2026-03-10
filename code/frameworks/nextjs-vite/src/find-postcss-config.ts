import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { getProjectRoot } from 'storybook/internal/common';
import { IncompatiblePostCssConfigError } from 'storybook/internal/server-errors';

import config from 'lilconfig';
import postCssLoadConfig from 'postcss-load-config';

type Options = import('lilconfig').Options;

const require = createRequire(import.meta.url);

async function loader(filepath: string) {
  return require(filepath);
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
    },
    searchPlaces: [
      ...(options.searchPlaces ?? []),
      'package.json',
      `.${moduleName}rc`,
      `.${moduleName}rc.json`,
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
async function postCssFindConfig(path: string, options: Options = {}) {
  const result = await config.lilconfig('postcss', withLoaders(options)).search(path);

  return result ? result.filepath : null;
}

export { postCssLoadConfig };

/**
 * Normalizes PostCSS configuration for NextJS compatibility.
 *
 * This function handles the incompatibility between NextJS's PostCSS plugin format and Storybook's
 * requirements. NextJS uses array format for plugins while Storybook expects object format.
 *
 * Process:
 *
 * 1. First attempts to load the config as-is
 * 2. If that fails due to "Invalid PostCSS Plugin found" error, modifies the config file to convert
 *    array format to object format (e.g., ["@tailwindcss/postcss"] becomes {
 *    "@tailwindcss/postcss": {} })
 * 3. Retries loading with the modified config
 *
 * @param searchPath - Directory path to search for PostCSS config
 * @returns Promise<boolean> - true if config loads successfully (or no config found), false if
 *   config exists but cannot be loaded
 * @throws {IncompatiblePostCssConfigError} - When config cannot be fixed automatically
 * @sideEffect Modifies the PostCSS config file on disk when fixing plugin format
 */ export const normalizePostCssConfig = async (searchPath: string): Promise<boolean> => {
  const configPath = await postCssFindConfig(searchPath);
  if (!configPath) {
    return true;
  }

  let error: Error | undefined;

  // First attempt: try loading config as-is
  try {
    await postCssLoadConfig({}, searchPath, { stopDir: getProjectRoot() });
    return true; // Success!
  } catch (e: unknown) {
    if (e instanceof Error) {
      error = e;
    }
  }

  if (!error) {
    return true;
  }

  // No config found is not an error we need to handle
  if (error.message.includes('No PostCSS Config found')) {
    return true;
  }

  // NextJS uses an incompatible format for PostCSS plugins, we make an attempt to fix it
  if (error.message.includes('Invalid PostCSS Plugin found')) {
    // Second attempt: try with modified config
    const originalContent = await readFile(configPath, 'utf8');
    try {
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
      // We were unable to fix the config, so we change the file back to the original content
      await writeFile(configPath, originalContent, 'utf8');
      // and throw an error
      throw new IncompatiblePostCssConfigError({ error });
    }
  }

  return false;
};
