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
    // Docgen loads the TypeScript declared by this project. Another installed copy in a monorepo
    // can report a different version, so resolve the declared constraint instead.
    const version = coerce(
      await packageManager.getDeclaredVersionSpecifier('typescript', { preferDeclared: true })
    )?.version;
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
