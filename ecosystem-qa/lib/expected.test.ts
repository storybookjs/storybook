import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { compareExpected, loadExpected, renderExpectReport } from './expected.ts';
import { ENTRY, finding, loaded } from './fixtures.ts';
import type { FindingGroup } from './proposals.ts';
import type { LoadedResult } from './results.ts';

const resultOf = (repo: string): LoadedResult => {
  const base = loaded('linux', 'claude', []);
  const request = { ...base.result.request, entry: { ...ENTRY, id: repo } };
  return { ...base, result: { ...base.result, request } };
};

const group = (
  fingerprint: string,
  title: string,
  repo = 'mealdrop',
  ...moreRepos: string[]
): FindingGroup => {
  const primary = resultOf(repo);
  return {
    fingerprint,
    finding: finding({ title }),
    primary,
    occurrences: [primary, ...moreRepos.map(resultOf)],
  };
};

const expected = [
  { repo: 'mealdrop', fingerprint: 'a'.repeat(16), issue: 1, title: 'known crash' },
  { repo: 'mealdrop', fingerprint: 'b'.repeat(16), title: 'known flag' },
  { repo: 'other', fingerprint: 'c'.repeat(16), title: 'another repo' },
];

describe('compareExpected', () => {
  it('splits a run into found, missed and extra for the repos that ran', () => {
    const report = compareExpected(
      expected,
      [group('a'.repeat(16), 'known crash'), group('d'.repeat(16), 'something new')],
      new Set(['mealdrop'])
    );
    expect(report.found.map((item) => item.fingerprint)).toEqual(['a'.repeat(16)]);
    expect(report.missed.map((item) => item.fingerprint)).toEqual(['b'.repeat(16)]);
    expect(report.extra).toEqual([
      { repo: 'mealdrop', fingerprint: 'd'.repeat(16), title: 'something new' },
    ]);
  });

  it('counts a finding only for the repo that produced it', () => {
    const inBothRepos = [
      { repo: 'mealdrop', fingerprint: 'a'.repeat(16), title: 'known crash' },
      { repo: 'other', fingerprint: 'a'.repeat(16), title: 'known crash' },
    ];
    const report = compareExpected(
      inBothRepos,
      [group('a'.repeat(16), 'known crash', 'other')],
      new Set(['mealdrop', 'other'])
    );
    expect(report.found.map((item) => item.repo)).toEqual(['other']);
    expect(report.missed.map((item) => item.repo)).toEqual(['mealdrop']);
    expect(report.extra).toEqual([]);
  });

  it('reports a known finding as extra in a repo that does not expect it', () => {
    const report = compareExpected(
      [{ repo: 'mealdrop', fingerprint: 'a'.repeat(16), title: 'known crash' }],
      [group('a'.repeat(16), 'known crash', 'mealdrop', 'other')],
      new Set(['mealdrop', 'other'])
    );
    expect(report.found.map((item) => item.repo)).toEqual(['mealdrop']);
    expect(report.extra).toEqual([
      { repo: 'other', fingerprint: 'a'.repeat(16), title: 'known crash' },
    ]);
  });

  it('renders the counts and names each missed and extra finding with its repo', () => {
    const text = renderExpectReport(
      compareExpected(expected, [group('d'.repeat(16), 'something new')], new Set(['mealdrop']))
    );
    expect(text).toBe(
      [
        'Expected findings: 0/2 found, 1 not expected.',
        `  missed mealdrop ${'a'.repeat(16)} known crash (#1)`,
        `  missed mealdrop ${'b'.repeat(16)} known flag`,
        `  extra  mealdrop ${'d'.repeat(16)} something new`,
      ].join('\n')
    );
  });
});

describe('expected-findings.json', () => {
  it('parses and names only catalog repos', () => {
    const items = loadExpected(
      fileURLToPath(new URL('../expected-findings.json', import.meta.url))
    );
    expect(items.length).toBeGreaterThan(0);
    expect(new Set(items.map((item) => item.fingerprint)).size).toBe(items.length);
    expect(items.every((item) => item.repo === 'mealdrop')).toBe(true);
  });
});
