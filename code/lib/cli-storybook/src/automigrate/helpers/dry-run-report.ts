import { CLI_COLORS } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';

import type { SimulatedOutcome } from '../pipeline.ts';
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
      report.fail.push({ fixId, reason: fileFailures.map(({ message }) => message).join('; ') });
    } else if (fileFailures.length > 0) {
      report.fail.push({ fixId, reason: `could not migrate ${pluralFiles(fileFailures.length)}` });
    } else {
      report.apply.push(fixId);
    }
  }
};

/** The report as grouped lists, one line for each group that has fixes. */
export const formatDryRunReport = ({ apply, fail, skip, manual }: DryRunReport) => {
  const ids = (list: string[], color = picocolors.cyan) =>
    list.map((fixId) => color(fixId)).join(', ');
  const withReasons = (list: ReasonedFix[]) =>
    list.map(({ fixId, reason }) => `${picocolors.cyan(fixId)} (${reason})`).join(', ');
  return [
    apply.length > 0 && `Would apply: ${ids(apply, CLI_COLORS.change)}`,
    fail.length > 0 && `Would fail: ${withReasons(fail)}`,
    skip.length > 0 && `Would skip: ${withReasons(skip)}`,
    manual.length > 0 && `Would need manual changes: ${ids(manual)}`,
  ]
    .filter(Boolean)
    .join('\n');
};
