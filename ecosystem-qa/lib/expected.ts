import { readFileSync } from 'node:fs';

import { z } from 'zod';

import type { FindingGroup } from './proposals.ts';

const ExpectedFinding = z.strictObject({
  repo: z.string().regex(/^[a-z0-9-]+$/),
  fingerprint: z.string().regex(/^[0-9a-f]{16}$/),
  issue: z.number().int().optional(),
  title: z.string().min(1),
});
export type ExpectedFinding = z.infer<typeof ExpectedFinding>;

export const loadExpected = (file: string): ExpectedFinding[] =>
  z.array(ExpectedFinding).parse(JSON.parse(readFileSync(file, 'utf8')));

export interface ExpectReport {
  found: ExpectedFinding[];
  missed: ExpectedFinding[];
  extra: FindingGroup[];
}

/** Which expected findings the groups cover, counted only for the repos that ran. */
export const compareExpected = (
  expected: ExpectedFinding[],
  groups: FindingGroup[],
  ranRepos: Set<string>
): ExpectReport => {
  const relevant = expected.filter((item) => ranRepos.has(item.repo));
  const seen = new Set(groups.map((group) => group.fingerprint));
  const known = new Set(relevant.map((item) => item.fingerprint));
  return {
    found: relevant.filter((item) => seen.has(item.fingerprint)),
    missed: relevant.filter((item) => !seen.has(item.fingerprint)),
    extra: groups.filter((group) => !known.has(group.fingerprint)),
  };
};

export const renderExpectReport = (report: ExpectReport): string => {
  const total = report.found.length + report.missed.length;
  const lines = [
    `Expected findings: ${report.found.length}/${total} found, ${report.extra.length} not expected.`,
    ...report.missed.map(
      (item) => `  missed ${item.fingerprint} ${item.title}${item.issue ? ` (#${item.issue})` : ''}`
    ),
    ...report.extra.map((group) => `  extra  ${group.fingerprint} ${group.finding.title}`),
  ];
  return lines.join('\n');
};
