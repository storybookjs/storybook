import { readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';

import type { FileFailure } from '../pipeline.ts';

export const REPORT_FILE_NAME = 'automigrations-summary.md';

export const pluralFiles = (count: number) => `${count} file${count === 1 ? '' : 's'}`;

export type FixFileFailure = FileFailure & { fixId: string };

const cell = (text: string) => text.replaceAll('|', '\\|').replace(/\s*\n\s*/g, ' ');

const HEADER = [
  '# Automigrations summary',
  '',
  'These files could not be migrated automatically.',
  'Update them by hand.',
  'A section disappears once its migration runs again without failures.',
  'Delete this file when you are done.',
].join('\n');

const renderSections = (failures: FixFileFailure[], root: string) =>
  [...Map.groupBy(failures, ({ fixId }) => fixId)].map(([fixId, fixFailures]) =>
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

const readSections = async (reportPath: string) => {
  const report = await readFile(reportPath, 'utf-8').catch(() => '');
  return report
    .split(/\n(?=## )/)
    .filter((section) => section.startsWith('## '))
    .map((section) => ({
      fixId: section.slice(3, section.indexOf('\n')).trim(),
      text: section.trim(),
    }));
};

/**
 * Update `automigrations-summary.md` in the project root with the files that the fixes in `ran`
 * could not transform, and point the user to it. Sections of fixes that did not run are kept, since
 * nothing checked whether their files were fixed; the file is removed once no section is left.
 */
export const reportFileFailures = async (failures: FixFileFailure[], ran: Iterable<string>) => {
  const root = getProjectRoot();
  const reportPath = join(root, REPORT_FILE_NAME);
  const ranIds = new Set(ran);
  const kept = (await readSections(reportPath)).filter(({ fixId }) => !ranIds.has(fixId));
  const sections = [...kept.map(({ text }) => text), ...renderSections(failures, root)];
  if (sections.length === 0) {
    await rm(reportPath, { force: true });
    return;
  }
  await writeFile(reportPath, [HEADER, ...sections].join('\n\n') + '\n');
  const count = failures.length;
  logger.warn(
    count > 0
      ? `${pluralFiles(count)} could not be migrated automatically. See ${picocolors.cyan(relative(process.cwd(), reportPath))} for which ones and why.`
      : `${picocolors.cyan(relative(process.cwd(), reportPath))} still lists files that earlier runs could not migrate.`
  );
};
