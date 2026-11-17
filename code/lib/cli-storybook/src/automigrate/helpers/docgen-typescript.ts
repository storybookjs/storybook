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
  const effectiveSpecifier = specifier ?? 'typescript';
  // Docgen loads the resolved TypeScript package. Read it first; a declared range can hide a newer
  // installed TypeScript 7, especially when another workspace owns the copy being executed.
  if (configDir) {
    try {
      const { version } = readTypeScriptPackageForDocgen({
        specifier: effectiveSpecifier,
        configDir,
      });
      return { version, ...(specifier ? { specifier } : {}) };
    } catch {
      // An unreadable custom specifier leaves TypeScript unknown; only the default falls back to
      // the project's nearest declared constraint.
    }
  }
  if (specifier) {
    return undefined;
  }
  const version = coerce(packageManager.getNearestDeclaredRange('typescript'))?.version;
  return version ? { version } : undefined;
}
