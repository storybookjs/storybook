import { describe, expect, it } from 'vitest';

import { IssueItem, publishedAtFrom, qaIssuesFrom } from './github.ts';

const item = (extra: object = {}) => ({
  number: 5,
  title: 'Dev server crashes',
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
        title: 'Dev server crashes',
        state: 'closed',
        labels: ['bug', 'internal-qa'],
        body: 'fingerprint: 0123456789abcdef',
      },
    ]);
  });

  it('keeps when and why an issue was closed', () => {
    expect(
      listed([item({ closed_at: '2026-11-05T10:00:00Z', state_reason: 'completed' })])[0]
    ).toMatchObject({ closedAt: '2026-11-05T10:00:00Z', stateReason: 'completed' });
    expect(listed([item({ closed_at: null, state_reason: null })])[0]).not.toHaveProperty(
      'closedAt'
    );
  });

  it('turns a null body into an empty string', () => {
    expect(listed([item({ body: null })])[0]?.body).toBe('');
  });

  it('rejects a malformed item', () => {
    expect(() => listed([item({ state: 'merged' })])).toThrow();
  });
});

describe('publishedAtFrom', () => {
  it('reads the publish date of a release, and none for a draft', () => {
    expect(
      publishedAtFrom({ tag_name: 'v11.0.0-beta.0', published_at: '2026-11-03T19:32:47Z' })
    ).toBe('2026-11-03T19:32:47Z');
    expect(publishedAtFrom({ published_at: null })).toBeUndefined();
  });

  it('rejects a response that is not a release', () => {
    expect(() => publishedAtFrom({ message: 'Not Found' })).toThrow();
  });
});
