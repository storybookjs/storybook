import { logger } from 'storybook/internal/node-logger';

import { listCodemods, runCodemod } from '@storybook/codemod';

type CLIOptions = {
  glob: string;
  configDir?: string;
  dryRun?: boolean;
  list?: string[];
  /** Rename suffix of matching files after codemod has been applied, e.g. `".js:.ts"` */
  rename?: string;
};

export async function migrate(migration: any, { glob, dryRun, list, rename }: CLIOptions) {
  if (list) {
    listCodemods().forEach((key: any) => logger.log(key));
  } else if (migration) {
    await runCodemod(migration, { glob, dryRun, logger, rename });
  } else {
    throw new Error('Migrate: please specify a migration name or --list');
  }
}
