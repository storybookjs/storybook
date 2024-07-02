import path from 'path';

export const AFTER_DIR_NAME = 'after-storybook';
export const BEFORE_DIR_NAME = 'before-storybook';

const dirname = path.dirname(new URL(import.meta.url).pathname);

export const ROOT_DIRECTORY = path.join(dirname, '..', '..');
export const CODE_DIRECTORY = path.join(ROOT_DIRECTORY, 'code');
export const PACKS_DIRECTORY = path.join(ROOT_DIRECTORY, 'packs');
export const REPROS_DIRECTORY = path.join(ROOT_DIRECTORY, 'repros');
export const SANDBOX_DIRECTORY = path.join(ROOT_DIRECTORY, 'sandbox');
export const JUNIT_DIRECTORY = path.join(ROOT_DIRECTORY, 'test-results');

export const LOCAL_REGISTRY_URL = 'http://localhost:6001';
export const SCRIPT_TIMEOUT = 5 * 60 * 1000;
