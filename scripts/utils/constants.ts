import path from 'node:path';

import { join } from 'path';

export const AFTER_DIR_NAME = 'after-storybook';
export const BEFORE_DIR_NAME = 'before-storybook';

// __dirname on purpose: Playwright transpiles importers of this file (e.g.
// code/e2e-sandbox/*.spec.ts) to CommonJS, where import.meta is a syntax
// error. Keep this module free of ESM-only globals.
export const ROOT_DIRECTORY = join(__dirname, '..', '..');
export const CODE_DIRECTORY = join(ROOT_DIRECTORY, 'code');
export const SNIPPETS_DIRECTORY = join(ROOT_DIRECTORY, 'docs', '_snippets');
export const PACKS_DIRECTORY = join(ROOT_DIRECTORY, 'packs');
export const REPROS_DIRECTORY = join(ROOT_DIRECTORY, 'repros');

export const SANDBOX_DIRECTORY =
  process.env.STORYBOOK_SANDBOX_ROOT && path.isAbsolute(process.env.STORYBOOK_SANDBOX_ROOT)
    ? process.env.STORYBOOK_SANDBOX_ROOT
    : join(ROOT_DIRECTORY, process.env.STORYBOOK_SANDBOX_ROOT || '../storybook-sandboxes');

export const JUNIT_DIRECTORY = join(ROOT_DIRECTORY, 'test-results');

export const LOCAL_REGISTRY_URL = 'http://localhost:6001';
export const SCRIPT_TIMEOUT = 5 * 60 * 1000;

/**
 * npm below this version silently ignores `NPM_CONFIG_MIN_RELEASE_AGE`. 11.17+ is required for
 * `min-release-age-exclude`, which templates with `minAgeGateExemptions` rely on during npx/npm
 * scaffolds. Lives here rather than in `sandbox/utils/yarn.ts` so the CI config generator can read
 * it without loading the sandbox generator, which needs built core packages at runtime.
 */
export const BEFORE_SANDBOX_NPM_MIN_VERSION = '11.17.0';
