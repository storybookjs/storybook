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
    // Docgen loads the TypeScript installed in this project. A broad declared range or a root
    // declaration can hide an installed TypeScript 7, so read the installed copy first.
    if (configDir) {
      try {
        return {
          version: readTypeScriptPackageForDocgen({ specifier: 'typescript', configDir }).version,
        };
      } catch {
        // Fall back to the declared constraint when no installed copy can be resolved.
      }
    }
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
