import { fileURLToPath } from 'node:url';

import { ViteModuleImporterPathError } from 'storybook/internal/server-errors';
import type { Options } from 'storybook/internal/types';

import { genImport } from 'knitwork';
import { isAbsolute, normalize } from 'pathe';

/**
 * The module specifiers of the `experimental_moduleImporters` preset, in preset order and without
 * duplicates: absolute paths (normalized, also from a `file:` URL) or package specifiers.
 */
export async function getModuleImporters(options: Options): Promise<string[]> {
  const moduleImporters = await options.presets.apply<unknown>('experimental_moduleImporters', []);
  if (!Array.isArray(moduleImporters)) {
    throw new ViteModuleImporterPathError({ moduleImporter: String(moduleImporters) });
  }
  return [...new Set(moduleImporters.map(toSpecifier))];
}

function toSpecifier(moduleImporter: unknown): string {
  if (
    moduleImporter instanceof URL ||
    (typeof moduleImporter === 'string' && moduleImporter.startsWith('file:'))
  ) {
    return normalize(fileURLToPath(moduleImporter));
  }
  // The generated modules import the importer, so a relative path would resolve against them
  if (
    typeof moduleImporter !== 'string' ||
    moduleImporter === '' ||
    moduleImporter.startsWith('.')
  ) {
    throw new ViteModuleImporterPathError({ moduleImporter: String(moduleImporter) });
  }
  return isAbsolute(moduleImporter) ? normalize(moduleImporter) : moduleImporter;
}

/** Imports the `importModule` of each module importer as `importModule_<index>`. */
export function genModuleImporterImports(moduleImporters: string[]): string {
  return moduleImporters
    .map((specifier, index) =>
      genImport(specifier, [{ name: 'importModule', as: `importModule_${index}` }])
    )
    .join('\n');
}

/**
 * The expression that imports `importPath` through the module importers. The last importer is the
 * outermost: each one gets the importers before it, ending in `importFn`, as its `importFn`.
 */
export function genImportThroughModuleImporters(
  moduleImporters: string[],
  importPath: string,
  importFn: string
): string {
  let next = importFn;
  for (let index = 0; index < moduleImporters.length - 1; index++) {
    next = `(path) => importModule_${index}(path, ${next})`;
  }
  return `importModule_${moduleImporters.length - 1}(${importPath}, ${next})`;
}
