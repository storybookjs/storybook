import { once } from 'storybook/internal/node-logger';

import { redirectTypeScriptRequires } from './redirect-typescript.ts';

type ModuleImporter = () => Promise<unknown>;

interface TypeScriptLike {
  version?: unknown;
  sys?: { fileExists?: unknown };
}

const MISSING_COMPILER_API_WARNING =
  'TypeScript 7 does not include the compiler API that Storybook uses to extract component ' +
  'metadata for Controls, the Docs args table and the component manifest. Install ' +
  '`@typescript/typescript6` as a dev dependency to enable it.';

const importModule = async (importer: ModuleImporter): Promise<TypeScriptLike | undefined> => {
  try {
    const imported = (await importer()) as { default?: TypeScriptLike } & TypeScriptLike;
    return imported.default ?? imported;
  } catch {
    return undefined;
  }
};

const hasCompilerApi = (typescript: TypeScriptLike) =>
  typeof typescript.sys?.fileExists === 'function';

// TypeScript 7.1 may expose a compiler API under the same names but with a different design, so
// only versions before 7 count as compatible.
const isCompatibleProjectTypeScript = (typescript: TypeScriptLike) =>
  Number.parseInt(String(typescript.version), 10) < 7 && hasCompilerApi(typescript);

/**
 * Load a TypeScript module that has the compiler API used to extract component metadata.
 *
 * Uses the project's own `typescript` before version 7, and `@typescript/typescript6` otherwise.
 * Pass importers from the calling package, so both modules resolve where they are declared as
 * dependencies. Resolves to `undefined` when neither is usable, and warns once when the project's
 * `typescript` is installed but `@typescript/typescript6` is missing.
 */
export async function loadTypeScriptCompilerApi<TypeScript>(importers: {
  typescript: ModuleImporter;
  typescript6: ModuleImporter;
}): Promise<TypeScript | undefined> {
  const projectTypeScript = await importModule(importers.typescript);
  if (projectTypeScript && isCompatibleProjectTypeScript(projectTypeScript)) {
    return projectTypeScript as TypeScript;
  }

  const typescript6 = await importModule(importers.typescript6);
  if (typescript6 && hasCompilerApi(typescript6)) {
    return typescript6 as TypeScript;
  }

  if (projectTypeScript) {
    once.warn(MISSING_COMPILER_API_WARNING);
  }
  return undefined;
}

/**
 * When the compiler API comes from `@typescript/typescript6`, redirect `typescript` loads inside
 * `packageDir` to that same module.
 */
export async function shareTypeScriptCompilerApi(
  packageDir: string,
  importers: {
    typescript: ModuleImporter;
    typescript6: ModuleImporter;
  },
  typescript6Entry: () => string
): Promise<void> {
  const [typescript, typescript6] = await Promise.all([
    loadTypeScriptCompilerApi(importers),
    importModule(importers.typescript6),
  ]);
  if (typescript && typescript === typescript6) {
    redirectTypeScriptRequires(packageDir, typescript6Entry());
  }
}
