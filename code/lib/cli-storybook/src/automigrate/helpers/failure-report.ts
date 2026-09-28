import { rm, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';

import type { FileFailure } from '../pipeline.ts';

export const REPORT_FILE_NAME = 'automigrations-summary.md';

export const pluralFiles = (count: number) => `${count} file${count === 1 ? '' : 's'}`;

export type FixFileFailure = FileFailure & { fixId: string };

const cell = (text: string) => text.replaceAll('|', '\\|').replace(/\s*\n\s*/g, ' ');

export const renderFailureReport = (failures: FixFileFailure[], root: string) => {
  const byFix = Map.groupBy(failures, ({ fixId }) => fixId);
  const sections = [...byFix].map(([fixId, fixFailures]) =>
    [
      `## ${fixId}`,
      '',
      '| File | Reason |',
      '| ---- | ------ |',
      ...fixFailures.map(
        ({ file, message }) =>
          `| \`${cell(relative(root, file))}\` | ${cell(message.replaceAll(`${root}${sep}`, ''))} |`
      ),
    ].join('\n')
  );
  return [
    '# Automigrations summary',
    '',
    'These files could not be migrated automatically.',
    'Update them by hand, then run `npx storybook automigrate` to check that nothing is left.',
    '',
    sections.join('\n\n'),
    '',
  ].join('\n');
};

/**
 * Write the files automigrations could not transform to `automigrations-summary.md` in the project
 * root and point the user to it, or remove a summary left by an earlier run when nothing failed. A
 * dry run only logs the list.
 */
export const reportFileFailures = async (failures: FixFileFailure[], { dryRun = false } = {}) => {
  const root = getProjectRoot();
  const reportPath = join(root, REPORT_FILE_NAME);
  if (dryRun) {
    if (failures.length > 0) {
      logger.warn(
        `Some files could not be migrated automatically:\n\n${renderFailureReport(failures, root)}`
      );
    }
    return;
  }
  if (failures.length === 0) {
    await rm(reportPath, { force: true });
    return;
  }
  await writeFile(reportPath, renderFailureReport(failures, root));
  logger.warn(
    `${pluralFiles(failures.length)} could not be migrated automatically. See ${picocolors.cyan(relative(process.cwd(), reportPath))} for which ones and why.`
  );
};
