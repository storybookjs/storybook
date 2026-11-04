import { fileURLToPath } from 'node:url';

import {
  ViteModuleImporterPathError,
  ViteModuleImportersNotArrayError,
} from 'storybook/internal/server-errors';
import type { Options } from 'storybook/internal/types';

import { genImport } from 'knitwork';
import { isAbsolute, normalize } from 'pathe';

/**
 * The module specifiers of the `experimental_moduleImporters` preset, in preset order: absolute paths
 * (normalized, also from a `file:` URL) or package specifiers. A module listed twice is kept at its
 * last place, so the main config, which presets apply last, can move a framework's importer.
 */
export async function getModuleImporters(options: Options): Promise<string[]> {
  const moduleImporters = await options.presets.apply<unknown>('experimental_moduleImporters', []);
  if (!Array.isArray(moduleImporters)) {
    throw new ViteModuleImportersNotArrayError({ moduleImporters: String(moduleImporters) });
  }
  const specifiers = moduleImporters.map(toSpecifier);
  return specifiers.filter((specifier, index) => specifiers.lastIndexOf(specifier) === index);
}

function toSpecifier(moduleImporter: unknown): string {
  if (typeof moduleImporter !== 'string' || moduleImporter === '') {
    throw new ViteModuleImporterPathError({ moduleImporter: String(moduleImporter) });
  }
  if (moduleImporter.startsWith('file:')) {
    return normalize(fileURLToPath(moduleImporter));
  }
  if (isAbsolute(moduleImporter)) {
    return normalize(moduleImporter);
  }
  // The generated modules import the importer, so a relative path would resolve against them, and
  // a URL other than `file:` is not a module of the project
  if (moduleImporter.startsWith('.') || /^[a-z][a-z\d+.-]+:/i.test(moduleImporter)) {
    throw new ViteModuleImporterPathError({ moduleImporter });
  }
  return moduleImporter;
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
 * outermost: each one gets the importers before it, ending in `importFn`, as its `importFn`. Every
 * link is async, so an importer can rely on a promise even when the one before it returns a module
 * or throws.
 */
export function genImportThroughModuleImporters(
  moduleImporters: string[],
  importPath: string,
  importFn: string
): string {
  let next = importFn;
  for (let index = 0; index < moduleImporters.length - 1; index++) {
    next = `async (path) => importModule_${index}(path, ${next})`;
  }
  return `importModule_${moduleImporters.length - 1}(${importPath}, ${next})`;
}
