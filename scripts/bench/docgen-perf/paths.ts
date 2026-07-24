/**
 * Mirrors SANDBOX_DIRECTORY from scripts/utils/constants.ts. That module deliberately stays on the
 * CJS-only `__dirname` global for Playwright compatibility, so the native-Node harness entry points
 * here cannot import it.
 */
import * as path from 'node:path';

const ROOT_DIRECTORY = path.join(import.meta.dirname, '..', '..', '..');

export const SANDBOX_DIRECTORY =
  process.env.STORYBOOK_SANDBOX_ROOT && path.isAbsolute(process.env.STORYBOOK_SANDBOX_ROOT)
    ? process.env.STORYBOOK_SANDBOX_ROOT
    : path.join(ROOT_DIRECTORY, process.env.STORYBOOK_SANDBOX_ROOT || '../storybook-sandboxes');
