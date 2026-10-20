import { existsSync } from 'node:fs';

import { join } from 'pathe';

// File-relative configs first, then project-wide ones.
const BABEL_CONFIG_FILES = [
  '.babelrc',
  '.babelrc.json',
  '.babelrc.js',
  '.babelrc.mjs',
  '.babelrc.cjs',
  'babel.config.js',
  'babel.config.json',
  'babel.config.mjs',
  'babel.config.cjs',
];

/** Return the path of the first Babel config file in `dir`, or `undefined` if there is none. */
export function findBabelConfigFile(dir: string): string | undefined {
  return BABEL_CONFIG_FILES.map((file) => join(dir, file)).find((path) => existsSync(path));
}
