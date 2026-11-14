import { readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';
// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';

import type { FileFailure } from '../pipeline.ts';
import { FixStatus } from '../types.ts';

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
          `| \`${cell(slash(relative(root, file)))}\` | ${cell(slash(message).replaceAll(`${slash(root)}/`, ''))} |`
      ),
    ].join('\n')
  );

const readSections = async (reportPath: string) => {
  const report = (await readFile(reportPath, 'utf-8').catch(() => '')).replaceAll('\r\n', '\n');
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

const MAX_LISTED_FILES = 5;
const MAX_REASON_LENGTH = 200;

const firstLine = (text: string) => text.split('\n')[0];

const shorten = (text: string) =>
  text.length > MAX_REASON_LENGTH ? `${text.slice(0, MAX_REASON_LENGTH - 1)}…` : text;

/**
 * Describe, for the end of an upgrade, what the fixes of one project left undone: each fix that
 * failed or whose check failed, and per fix the first files it could not migrate, with why. The
 * report file lists every file.
 */
export const describeUnfinishedMigrations = ({
  automigrationStatuses,
  automigrationErrors,
  fileFailures,
}: {
  automigrationStatuses: Record<string, FixStatus>;
  automigrationErrors: Record<string, string>;
  fileFailures: FixFileFailure[];
}): string[] => {
  const root = getProjectRoot();
  const byFix = Map.groupBy(fileFailures, ({ fixId }) => fixId);
  const lines: string[] = [];
  for (const [fixId, status] of Object.entries(automigrationStatuses)) {
    if (status === FixStatus.CHECK_FAILED) {
      lines.push(`${picocolors.cyan(fixId)}: its check failed. Run with --debug for details.`);
    } else if (status === FixStatus.FAILED && !byFix.has(fixId)) {
      const error = automigrationErrors[fixId];
      lines.push(
        `${picocolors.cyan(fixId)} failed${error ? `: ${shorten(firstLine(error))}` : ''}`
      );
    }
  }
  for (const [fixId, failures] of byFix) {
    lines.push(`${picocolors.cyan(fixId)} could not migrate ${pluralFiles(failures.length)}:`);
    for (const { file, message } of failures.slice(0, MAX_LISTED_FILES)) {
      const reason = slash(message).replaceAll(`${slash(root)}/`, '');
      lines.push(`  ${slash(relative(root, file))}: ${shorten(firstLine(reason))}`);
    }
    if (failures.length > MAX_LISTED_FILES) {
      lines.push(`  and ${pluralFiles(failures.length - MAX_LISTED_FILES)} more`);
    }
  }
  if (fileFailures.length > 0) {
    lines.push(`Every file and why: ${picocolors.cyan(REPORT_FILE_NAME)}`);
  }
  return lines;
};
