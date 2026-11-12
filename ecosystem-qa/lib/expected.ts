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

type SeenFinding = Pick<ExpectedFinding, 'repo' | 'fingerprint' | 'title'>;

export interface ExpectReport {
  found: ExpectedFinding[];
  missed: ExpectedFinding[];
  extra: SeenFinding[];
}

// A fingerprint hashes the class of the repo, not the repo, so two repos can share one.
const key = ({ repo, fingerprint }: SeenFinding) => `${repo} ${fingerprint}`;

/** Which expected findings the groups cover, repo by repo, counted only for the repos that ran. */
export const compareExpected = (
  expected: ExpectedFinding[],
  groups: FindingGroup[],
  ranRepos: Set<string>
): ExpectReport => {
  const relevant = expected.filter((item) => ranRepos.has(item.repo));
  const seen = groups.flatMap(({ fingerprint, finding, occurrences }) =>
    [...new Set(occurrences.map(({ result }) => result.request.entry.id))].map(
      (repo): SeenFinding => ({ repo, fingerprint, title: finding.title })
    )
  );
  const seenKeys = new Set(seen.map(key));
  const knownKeys = new Set(relevant.map(key));
  return {
    found: relevant.filter((item) => seenKeys.has(key(item))),
    missed: relevant.filter((item) => !seenKeys.has(key(item))),
    extra: seen.filter((item) => !knownKeys.has(key(item))),
  };
};

export const renderExpectReport = (report: ExpectReport): string => {
  const total = report.found.length + report.missed.length;
  const lines = [
    `Expected findings: ${report.found.length}/${total} found, ${report.extra.length} not expected.`,
    ...report.missed.map(
      (item) =>
        `  missed ${item.repo} ${item.fingerprint} ${item.title}${item.issue ? ` (#${item.issue})` : ''}`
    ),
    ...report.extra.map((item) => `  extra  ${item.repo} ${item.fingerprint} ${item.title}`),
  ];
  return lines.join('\n');
};
