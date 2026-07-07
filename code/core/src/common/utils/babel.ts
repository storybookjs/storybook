import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { logger } from 'storybook/internal/node-logger';

const require = createRequire(import.meta.url);

/**
 * Reads the major version of the `@babel/preset-env` that is actually installed in the consumer's
 * project, at runtime.
 *
 * We can't rely on `@babel/core`'s exported `version`: it is a different package whose version can
 * diverge from `@babel/preset-env`, and it gets resolved when Storybook is bundled rather than from
 * the user's project. We instead resolve and read preset-env's own `package.json`. This must stay
 * synchronous because some call sites (e.g. the Next.js babel preset factory and the swc loader
 * transform) are synchronous.
 *
 * This is primarily used to gate the `bugfixes` option, which is valid in preset-env v7 but was
 * removed in v8 (where it throws when set, as the bugfix plugins are always enabled).
 *
 * @returns The major version (e.g. `7` or `8`), or `0` when preset-env cannot be resolved.
 */
export const getBabelPresetEnvMajor = (): number | undefined => {
  try {
    const pkgPath = require.resolve('@babel/preset-env/package.json');
    const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const parsed = Number.parseInt(version, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  } catch {
    logger.debug(
      'Could not determine @babel/preset-env version in use. In case of runtime errors with \@babel/preset-env, you may need to set the babelRemoveBugfixes feature flag in your `main.ts` file.'
    );

    return undefined;
  }
};
