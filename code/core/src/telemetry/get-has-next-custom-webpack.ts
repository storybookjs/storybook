import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const NEXT_CONFIG_FILES = [
  'next.config.js',
  'next.config.mjs',
  'next.config.cjs',
  'next.config.ts',
  'next.config.mts',
];

/**
 * Detects whether a Next.js project customizes webpack through the `webpack` option of its
 * `next.config.*` file. The config file is scanned textually rather than evaluated, so a `webpack`
 * key inside a comment counts as a false positive — acceptable for telemetry.
 *
 * @param projectRoot The directory containing the project's next.config file
 * @returns Whether a next.config file defines a `webpack` option; false when no config file exists
 */
export function getHasNextCustomWebpack(projectRoot: string): boolean {
  for (const configFile of NEXT_CONFIG_FILES) {
    const configPath = join(projectRoot, configFile);
    if (!existsSync(configPath)) {
      continue;
    }
    try {
      // matches `webpack: (config) => ...`, `webpack(config) {`, `webpack = ...`, and quoted
      // `'webpack':` / `"webpack":` key forms
      return /(?<![\w$-])['"]?webpack['"]?\s*[:(=]/.test(readFileSync(configPath, 'utf8'));
    } catch {
      return false;
    }
  }
  return false;
}
