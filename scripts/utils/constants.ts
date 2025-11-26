import path from 'node:path';

import { join } from 'path';

export const AFTER_DIR_NAME = 'after-storybook';
export const BEFORE_DIR_NAME = 'before-storybook';

export const ROOT_DIRECTORY = join(__dirname, '..', '..');
export const CODE_DIRECTORY = (ROOT_DIRECTORY);
export const SNIPPETS_DIRECTORY = join(ROOT_DIRECTORY, 'docs', '_snippets');
export const PACKS_DIRECTORY = join(ROOT_DIRECTORY, 'packs');
export const REPROS_DIRECTORY = join(ROOT_DIRECTORY, 'repros');

export const SANDBOX_DIRECTORY =
  process.env.SANDBOX_ROOT && path.isAbsolute(process.env.SANDBOX_ROOT)
    ? process.env.SANDBOX_ROOT
    : join(ROOT_DIRECTORY, process.env.SANDBOX_ROOT || '../storybook-sandboxes');

export const JUNIT_DIRECTORY = join(ROOT_DIRECTORY, 'test-results');

export const LOCAL_REGISTRY_URL = 'http://localhost:6001';
export const SCRIPT_TIMEOUT = 5 * 60 * 1000;
