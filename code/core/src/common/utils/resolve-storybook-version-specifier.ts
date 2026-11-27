import { getStorybookVersionSpecifierFromAncestry } from './get-storybook-version-specifier-from-ancestry.ts';
import { getProcessAncestry } from './process-ancestry.ts';

/** Set by the `storybook` dispatcher before it respawns `@storybook/cli` or `create-storybook`. */
export const STORYBOOK_VERSION_SPECIFIER_ENV = 'STORYBOOK_VERSION_SPECIFIER';

/** Reads the process ancestry only when the dispatcher did not pass the specifier on. */
export const resolveStorybookVersionSpecifier = (
  env: NodeJS.ProcessEnv = process.env
): string | undefined =>
  env[STORYBOOK_VERSION_SPECIFIER_ENV]?.trim() ||
  getStorybookVersionSpecifierFromAncestry(getProcessAncestry());
