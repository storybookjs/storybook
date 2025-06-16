import { logger } from 'storybook/internal/node-logger';

import { listCodemods, runCodemod } from '@storybook/codemod';

type CLIOptions = {
  glob: string;
  configDir?: string;
  dryRun?: boolean;
  list?: string[];
  /** Rename suffix of matching files after codemod has been applied, e.g. `".js:.ts"` */
  rename?: string;
  /** `jscodeshift` parser */
  parser?: 'babel' | 'babylon' | 'flow' | 'ts' | 'tsx';
};

export async function migrate(migration: any, { glob, dryRun, list, rename, parser }: CLIOptions) {
  if (list) {
    listCodemods().forEach((key: any) => logger.log(key));
  } else if (migration) {
    await runCodemod(migration, { glob, dryRun, logger, rename, parser });
  } else {
    throw new Error('Migrate: please specify a migration name or --list');
  }
}
