/**
 * Mirrors SANDBOX_DIRECTORY from scripts/utils/constants.ts rather than importing it. That module
 * reaches the repo root through the CJS-only `__dirname`, which Playwright's transpilation supplies
 * for its own importers; the harness entry points here run as native ESM, where importing it throws
 * `ReferenceError: __dirname is not defined in ES module scope`.
 */
import { isAbsolute, join } from 'node:path';

const ROOT_DIRECTORY = join(import.meta.dirname, '..', '..', '..');

export const SANDBOX_DIRECTORY =
  process.env.STORYBOOK_SANDBOX_ROOT && isAbsolute(process.env.STORYBOOK_SANDBOX_ROOT)
    ? process.env.STORYBOOK_SANDBOX_ROOT
    : join(ROOT_DIRECTORY, process.env.STORYBOOK_SANDBOX_ROOT || '../storybook-sandboxes');
