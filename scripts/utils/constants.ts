import { join } from 'node:path';

export const AFTER_DIR_NAME = 'after-storybook';
export const BEFORE_DIR_NAME = 'before-storybook';

export const ROOT_DIRECTORY = join(__dirname, '..', '..');
export const CODE_DIRECTORY = join(ROOT_DIRECTORY, 'code');
export const PACKS_DIRECTORY = join(ROOT_DIRECTORY, 'packs');
export const REPROS_DIRECTORY = join(ROOT_DIRECTORY, 'repros');
export const SANDBOX_DIRECTORY = join(ROOT_DIRECTORY, 'sandbox');
export const JUNIT_DIRECTORY = join(ROOT_DIRECTORY, 'test-results');

export const LOCAL_REGISTRY_URL = 'http://localhost:6001';
export const SCRIPT_TIMEOUT = 5 * 60 * 1000;
