import { describe, expect, it } from 'vitest';

import { IssueItem, qaIssuesFrom } from './github.ts';

const item = (extra: object = {}) => ({
  number: 5,
  state: 'closed',
  labels: [{ name: 'bug' }, { name: 'internal-qa' }],
  body: 'fingerprint: 0123456789abcdef',
  ...extra,
});

const listed = (items: unknown[]) => qaIssuesFrom(IssueItem.array().parse(items));

describe('qaIssuesFrom', () => {
  it('keeps the label names and drops pull requests', () => {
    const issues = listed([item(), item({ number: 6, pull_request: { url: 'x' } })]);

    expect(issues).toEqual([
      {
        number: 5,
        state: 'closed',
        labels: ['bug', 'internal-qa'],
        body: 'fingerprint: 0123456789abcdef',
      },
    ]);
  });

  it('turns a null body into an empty string', () => {
    expect(listed([item({ body: null })])[0]?.body).toBe('');
  });

  it('rejects a malformed item', () => {
    expect(() => listed([item({ state: 'merged' })])).toThrow();
  });
});
