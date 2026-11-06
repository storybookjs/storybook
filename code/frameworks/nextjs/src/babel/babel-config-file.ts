import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Babel config file names Next.js checks, in the same order
 * (`next/dist/build/get-babel-config-file.js`). Storybook switches from SWC to Babel exactly when
 * `next build` would.
 */
export const BABEL_CONFIG_FILES = [
  '.babelrc',
  '.babelrc.json',
  '.babelrc.js',
  '.babelrc.mjs',
  '.babelrc.cjs',
  'babel.config.js',
  'babel.config.json',
  'babel.config.mjs',
  'babel.config.cjs',
] as const;

export function findBabelConfigFile(dir: string): string | undefined {
  return BABEL_CONFIG_FILES.map((file) => join(dir, file)).find((path) => existsSync(path));
}
