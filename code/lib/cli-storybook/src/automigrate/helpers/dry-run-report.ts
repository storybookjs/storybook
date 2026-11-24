import { CLI_COLORS } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';

import { type SimulatedOutcome, describeFileFailures } from '../pipeline.ts';
import { pluralFiles } from './failure-report.ts';

type ReasonedFix = { fixId: string; reason: string };

/** What a run would do with the automigrations of a project, as a dry run predicts it. */
export interface DryRunReport {
  apply: string[];
  fail: ReasonedFix[];
  skip: ReasonedFix[];
  /** Manual migrations and notifications, which leave the changes to the user. */
  manual: string[];
}

export const createDryRunReport = (): DryRunReport => ({
  apply: [],
  fail: [],
  skip: [],
  manual: [],
});

/**
 * Sort the simulated outcomes of the fixes a run would apply into the report. A fix that would skip
 * files fails the run, so it is reported as failing.
 */
export const addSimulatedOutcomes = (
  report: DryRunReport,
  outcomes: Map<string, SimulatedOutcome>
) => {
  for (const [fixId, { status, fileFailures }] of outcomes) {
    if (status === 'fail') {
      report.fail.push({ fixId, reason: describeFileFailures(fileFailures) });
    } else if (fileFailures.length > 0) {
      report.fail.push({ fixId, reason: `could not migrate ${pluralFiles(fileFailures.length)}` });
    } else {
      report.apply.push(fixId);
    }
  }
};

/**
 * The report laid out like the summary of a run: a header and a list for each group that has fixes.
 * Fixes that would succeed have the color of a change, fixes that would fail the color of an error.
 */
export const formatDryRunReport = ({ apply, fail, skip, manual }: DryRunReport) => {
  const sections: [title: string, list: string][] = [];
  if (apply.length > 0) {
    sections.push([
      'Migrations that would succeed:',
      apply.map((fixId) => CLI_COLORS.change(fixId)).join(', '),
    ]);
  }
  if (fail.length > 0) {
    sections.push([
      'Migrations that would fail:',
      fail
        .map(({ fixId, reason }) => `${picocolors.bold(CLI_COLORS.error(fixId))}:\n${reason}`)
        .join('\n'),
    ]);
  }
  if (skip.length > 0) {
    sections.push([
      'Migrations that would be skipped:',
      skip.map(({ fixId, reason }) => `${picocolors.cyan(fixId)} (${reason})`).join(', '),
    ]);
  }
  if (manual.length > 0) {
    sections.push([
      'Migrations that would need manual changes:',
      manual.map((fixId) => picocolors.cyan(fixId)).join(', '),
    ]);
  }
  return sections.flatMap(([title, list]) => [picocolors.bold(title), list]).join('\n\n');
};
