/**
 * Mirrors SANDBOX_DIRECTORY from scripts/utils/constants.ts rather than importing it. That module
 * reaches the repo root through the CJS-only `__dirname`, which Playwright's transpilation supplies
 * for its own importers; the harness entry points here run as native ESM, where importing it throws
 * `ReferenceError: __dirname is not defined in ES module scope`.
 */
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join } from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Anchored on package resolution instead of a hand-counted `..` walk from this file. Every
 * generated project and every results file hangs off SANDBOX_DIRECTORY, and a wrong root would
 * write them somewhere else without raising an error, so relocating a file inside this package
 * must not be able to change it.
 */
const PACKAGE_ROOT = dirname(require.resolve('@storybook/docgen-harness/package.json'));
const ROOT_DIRECTORY = join(PACKAGE_ROOT, '..', '..', '..');

export const SANDBOX_DIRECTORY =
  process.env.STORYBOOK_SANDBOX_ROOT && isAbsolute(process.env.STORYBOOK_SANDBOX_ROOT)
    ? process.env.STORYBOOK_SANDBOX_ROOT
    : join(ROOT_DIRECTORY, process.env.STORYBOOK_SANDBOX_ROOT || '../storybook-sandboxes');
