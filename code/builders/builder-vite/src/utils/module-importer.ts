import { fileURLToPath } from 'node:url';

import { ViteModuleImporterPathError } from 'storybook/internal/server-errors';
import type { Options } from 'storybook/internal/types';

import { isAbsolute, normalize } from 'pathe';

/**
 * The module specifier of the `experimental_moduleImporter` preset: an absolute path (normalized, also
 * from a `file:` URL) or a package specifier.
 */
export async function getModuleImporter(options: Options): Promise<string | undefined> {
  const moduleImporter = await options.presets.apply<unknown>('experimental_moduleImporter');
  if (moduleImporter === undefined || moduleImporter === null || moduleImporter === '') {
    return undefined;
  }
  if (
    moduleImporter instanceof URL ||
    (typeof moduleImporter === 'string' && moduleImporter.startsWith('file:'))
  ) {
    return normalize(fileURLToPath(moduleImporter));
  }
  // The generated modules import the importer, so a relative path would resolve against them
  if (typeof moduleImporter !== 'string' || moduleImporter.startsWith('.')) {
    throw new ViteModuleImporterPathError({ moduleImporter: String(moduleImporter) });
  }
  return isAbsolute(moduleImporter) ? normalize(moduleImporter) : moduleImporter;
}
