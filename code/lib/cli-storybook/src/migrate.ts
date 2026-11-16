import { rename as renameFile } from 'node:fs/promises';

import { logger } from 'storybook/internal/node-logger';

import { type FileInfo, runCodemod } from './automigrate/codemod.ts';
import csf2To3 from './codemod/transforms/csf-2-to-3.ts';
import findImplicitSpies from './codemod/transforms/find-implicit-spies.ts';
import upgradeDeprecatedTypes from './codemod/transforms/upgrade-deprecated-types.ts';

const codemods: Record<string, (info: FileInfo) => string | Promise<string>> = {
  'csf-2-to-3': csf2To3,
  'find-implicit-spies': findImplicitSpies,
  'upgrade-deprecated-types': upgradeDeprecatedTypes,
};

type CLIOptions = {
  glob: string;
  configDir?: string;
  dryRun?: boolean;
  list?: string[];
  /** Rename suffix of matching files after codemod has been applied, e.g. `".js:.ts"` */
  rename?: string;
};

export async function migrate(
  migration: string | undefined,
  { glob, dryRun, list, rename }: CLIOptions
) {
  if (list) {
    Object.keys(codemods).forEach((key) => logger.log(key));
    return;
  }
  if (!migration) {
    throw new Error('Migrate: please specify a migration name or --list');
  }
  if (!Object.hasOwn(codemods, migration)) {
    throw new Error(`Unknown codemod ${migration}. Run --list for options.`);
  }
  const renameParts = rename?.split(':');
  if (renameParts && renameParts.length !== 2) {
    throw new Error(`Codemod rename: expected format "from:to", got "${rename}"`);
  }

  logger.step(`Applying ${migration}`);
  // The transforms format what they change themselves.
  const { files, errorCount } = await runCodemod(glob, codemods[migration], {
    dryRun,
    skipFormatting: true,
  });

  if (!renameParts || dryRun) {
    return;
  }
  if (errorCount > 0) {
    logger.log('Skipped renaming because of errors.');
    return;
  }

  const [from, to] = renameParts;
  // `from` is a suffix, not a pattern, so `.js` doesn't match `.mjs`.
  const renamed = files.filter((file) => file.endsWith(from));
  logger.step(`Renaming ${rename}: ${renamed.length} files`);
  await Promise.all(
    renamed.map((file) => {
      // Not `slice(0, -from.length)`: with an empty `from`, that would be `slice(0, 0)`.
      const newFile = file.slice(0, file.length - from.length) + to;
      logger.log(`Rename: ${file} ${newFile}`);
      return renameFile(file, newFile);
    })
  );
}
