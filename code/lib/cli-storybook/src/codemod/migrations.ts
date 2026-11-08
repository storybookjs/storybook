/* eslint import-x/prefer-default-export: "off" */
import { readFile, rename as renameAsync, writeFile } from 'node:fs/promises';

import { normalize } from 'pathe';
import { glob as tinyglobby } from 'tinyglobby';

import type { FileInfo } from '../automigrate/codemod.ts';
import csf2To3 from './transforms/csf-2-to-3.ts';
import findImplicitSpies from './transforms/find-implicit-spies.ts';
import upgradeDeprecatedTypes from './transforms/upgrade-deprecated-types.ts';
import upgradeHierarchySeparators from './transforms/upgrade-hierarchy-separators.ts';

type Transform = (info: FileInfo) => string | void | Promise<string | void>;

const transforms: Record<string, Transform> = {
  'csf-2-to-3': csf2To3,
  'find-implicit-spies': findImplicitSpies,
  'upgrade-deprecated-types': upgradeDeprecatedTypes,
  'upgrade-hierarchy-separators': upgradeHierarchySeparators,
};

export function listCodemods() {
  return Object.keys(transforms);
}

async function renameFile(file: any, from: any, to: any, { logger }: any) {
  const newFile = file.replace(from, to);
  logger.log(`Rename: ${file} ${newFile}`);
  return renameAsync(file, newFile);
}

async function applyTransform(transform: Transform, files: string[], logger: any) {
  let ok = 0;
  let unmodified = 0;
  let errors = 0;

  for (const file of files) {
    try {
      const source = await readFile(file, 'utf-8');
      const output = await transform({ path: file, source });
      if (typeof output !== 'string' || output === source) {
        unmodified += 1;
      } else {
        await writeFile(file, output);
        ok += 1;
      }
    } catch (error) {
      logger.log(`Failed to transform ${file}: ${String(error)}`);
      errors += 1;
    }
  }

  logger.log(`Results: ${errors} errors, ${unmodified} unmodified, ${ok} ok`);
  return errors;
}

export async function runCodemod(
  codemod: any,
  { glob, logger, dryRun, rename }: { glob: any; logger: any; dryRun?: any; rename?: any }
) {
  if (!Object.hasOwn(transforms, codemod)) {
    throw new Error(`Unknown codemod ${codemod}. Run --list for options.`);
  }

  let renameParts = null;
  if (rename) {
    renameParts = rename.split(':');
    if (renameParts.length !== 2) {
      throw new Error(`Codemod rename: expected format "from:to", got "${rename}"`);
    }
  }

  // Normalize the glob pattern to use forward slashes (required for glob patterns on Windows)
  const files = await tinyglobby([normalize(glob), '!**/node_modules', '!**/dist']);

  logger.step(`Applying ${codemod}: ${files.length} files`);

  if (files.length === 0) {
    logger.step(`No matching files for glob: ${glob}`);
    return;
  }

  if (!dryRun && (await applyTransform(transforms[codemod], files, logger)) > 0) {
    logger.log('Skipped renaming because of errors.');
    return;
  }

  if (renameParts) {
    const [from, to] = renameParts;
    logger.step(`Renaming ${rename}: ${files.length} files`);
    await Promise.all(
      files.map((file) => renameFile(file, new RegExp(`${from}$`), to, { logger }))
    );
  }
}
