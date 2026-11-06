import { readTypeScriptPackageForDocgen } from 'storybook/internal/common';

import { coerce } from 'semver';

import type { CheckOptions } from '../types.ts';

/**
 * The version of the TypeScript that docgen loads: the package `typescript.docgenSpecifier` names
 * when the main config sets it, otherwise the declared `typescript` dependency. `specifier` is set
 * when the version comes from `typescript.docgenSpecifier`. `undefined` when the version cannot be
 * read.
 */
export async function getDocgenTypeScriptVersion({
  mainConfig,
  configDir,
  packageManager,
}: Pick<CheckOptions, 'mainConfig' | 'configDir' | 'packageManager'>): Promise<
  { version: string; specifier?: string } | undefined
> {
  const specifier = (mainConfig.typescript as { docgenSpecifier?: string } | undefined)
    ?.docgenSpecifier;
  if (!specifier) {
    const version = coerce(await packageManager.getDeclaredVersionSpecifier('typescript'))?.version;
    return version ? { version } : undefined;
  }
  if (!configDir) {
    return undefined;
  }
  try {
    return { version: readTypeScriptPackageForDocgen({ specifier, configDir }).version, specifier };
  } catch {
    return undefined;
  }
}
