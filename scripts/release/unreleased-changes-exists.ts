import { setOutput } from '@actions/core';
import chalk from 'chalk';
import { program } from 'commander';
import { intersection } from 'es-toolkit';
import { z } from 'zod';

import { esMain } from '../utils/esmain';
import { getCurrentVersion } from './get-current-version';
import type { Change } from './utils/get-changes';
import { RELEASED_LABELS, getChanges } from './utils/get-changes';

program
  .name('are-changes-unreleased')
  .description('check if any changes since a release should be released')
  .option(
    '-F, --from <version>',
    'Which version/tag/commit to go back and check changes from. Defaults to latest release tag'
  )
  .option('-P, --unpicked-patches', 'Set to only consider PRs labeled with "patch:yes" label')
  .option('-V, --verbose', 'Enable verbose logging', false);

const optionsSchema = z.object({
  from: z.string().optional(),
  unpickedPatches: z.boolean().optional(),
  verbose: z.boolean().optional(),
});

type Options = {
  from?: string;
  unpickedPatches?: boolean;
  verbose: boolean;
};

const validateOptions = (options: { [key: string]: any }): options is Options => {
  optionsSchema.parse(options);
  return true;
};

export const run = async (
  options: unknown
): Promise<{ changesToRelease: Change[]; hasChangesToRelease: boolean }> => {
  if (!validateOptions(options)) {
    // this will never return because the validator throws
    return { changesToRelease: [], hasChangesToRelease: false };
  }
  const { from, unpickedPatches, verbose } = options;

  const currentVersion = await getCurrentVersion();

  console.log(`📐 Checking if there are any unreleased changes...`);

  const { changes } = await getChanges({
    version: currentVersion,
    from: from || currentVersion,
    to: 'HEAD',
    unpickedPatches,
    verbose,
  });

  const changesToRelease = changes.filter(
    ({ labels }) => intersection(Object.keys(RELEASED_LABELS), labels).length > 0
  );

  const hasChangesToRelease = changesToRelease.length > 0;

  if (process.env.GITHUB_ACTIONS === 'true') {
    setOutput('has-changes-to-release', hasChangesToRelease);
  }
  if (hasChangesToRelease) {
    console.log(
      `${chalk.green('🦋 The following changes are releasable')}:
${chalk.blue(changesToRelease.map(({ title, pull }) => `  #${pull}: ${title}`).join('\n'))}`
    );
  } else {
    console.log(chalk.red('🫙 No changes to release!'));
  }

  return { changesToRelease, hasChangesToRelease };
};

if (esMain(import.meta.url)) {
  const parsed = program.parse();
  run(parsed.opts()).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
