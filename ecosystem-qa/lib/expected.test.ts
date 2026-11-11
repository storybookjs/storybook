import { describe, expect, it } from 'vitest';

import { compareExpected, loadExpected, renderExpectReport } from './expected.ts';
import { finding } from './fixtures.ts';
import type { FindingGroup } from './proposals.ts';

const group = (fingerprint: string, title: string): FindingGroup =>
  ({ fingerprint, finding: finding({ title }), occurrences: [] }) as unknown as FindingGroup;

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
    expect(report.extra.map((item) => item.fingerprint)).toEqual(['d'.repeat(16)]);
  });

  it('renders the counts and names each missed and extra finding', () => {
    const text = renderExpectReport(
      compareExpected(expected, [group('d'.repeat(16), 'something new')], new Set(['mealdrop']))
    );
    expect(text).toBe(
      [
        'Expected findings: 0/2 found, 1 not expected.',
        `  missed ${'a'.repeat(16)} known crash (#1)`,
        `  missed ${'b'.repeat(16)} known flag`,
        `  extra  ${'d'.repeat(16)} something new`,
      ].join('\n')
    );
  });
});

describe('expected-findings.json', () => {
  it('parses and names only catalog repos', () => {
    const items = loadExpected(new URL('../expected-findings.json', import.meta.url).pathname);
    expect(items.length).toBeGreaterThan(0);
    expect(new Set(items.map((item) => item.fingerprint)).size).toBe(items.length);
    expect(items.every((item) => item.repo === 'mealdrop')).toBe(true);
  });
});
