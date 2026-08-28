/**
 * `vue-component-meta` checker construction.
 *
 * Both docgen paths build their checkers from {@link CHECKER_OPTIONS} so legacy and server
 * extraction see identical meta. The Vite plugin creates one checker up front through
 * {@link createVueComponentMetaChecker}; the docgen worker keeps one per matched tsconfig, see
 * `./project-manager.ts`.
 */
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';

import {
  createChecker,
  createCheckerByJson,
  type ComponentMetaChecker,
  type MetaCheckerOptions,
} from 'vue-component-meta';

/** Checker options shared by every path so legacy and server extraction produce identical meta. */
export const CHECKER_OPTIONS: MetaCheckerOptions = {
  forceUseTs: true,
  noDeclarations: true,
  printer: { newLine: 1 },
  schema: true,
};

/**
 * Creates the `vue-component-meta` checker to use for extracting component meta/docs. Considers the
 * given tsconfig file (will use a fallback checker if it does not exist or is not supported).
 */
export async function createVueComponentMetaChecker(
  tsconfigPath = 'tsconfig.json'
): Promise<ComponentMetaChecker> {
  const projectRoot = getProjectRoot();

  const projectTsConfigPath = join(projectRoot, tsconfigPath);

  const defaultChecker = createCheckerByJson(projectRoot, { include: ['**/*'] }, CHECKER_OPTIONS);

  // prefer the tsconfig.json file of the project to support alias resolution etc.
  if (await fileExists(projectTsConfigPath)) {
    // vue-component-meta does currently not resolve tsconfig references (see https://github.com/vuejs/language-tools/issues/3896)
    // so we will return the defaultChecker if references are used.
    // Otherwise vue-component-meta might not work at all for the Storybook docgen.
    const references = await getTsConfigReferences(projectTsConfigPath);

    if (references.length > 0) {
      return defaultChecker;
    }
    return createChecker(projectTsConfigPath, CHECKER_OPTIONS);
  }

  return defaultChecker;
}

/** Checks whether the given file path exists. */
async function fileExists(fullPath: string) {
  try {
    await stat(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets a list of tsconfig references for the given tsconfig This is only needed for the temporary
 * workaround/fix for: https://github.com/vuejs/language-tools/issues/3896
 */
async function getTsConfigReferences(tsConfigPath: string) {
  try {
    const content = JSON.parse(await readFile(tsConfigPath, 'utf-8'));

    if (!('references' in content) || !Array.isArray(content.references)) {
      return [];
    }
    return content.references as unknown[];
  } catch {
    // invalid project tsconfig
    return [];
  }
}
