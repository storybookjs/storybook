import { readTypeScriptPackageForDocgen } from 'storybook/internal/common';

import { coerce } from 'semver';

import type { CheckOptions } from '../types.ts';

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
