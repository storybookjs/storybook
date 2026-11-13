import { describe, expect, it } from 'vitest';

import { harnessComments, IssueItem, publishedAtFrom, qaIssuesFrom } from './github.ts';

const item = (extra: object = {}) => ({
  number: 5,
  title: 'Dev server crashes',
  state: 'closed',
  labels: [{ name: 'bug' }, { name: 'internal-qa' }],
  body: 'fingerprint: 0123456789abcdef',
  comments: 0,
  ...extra,
});

const listed = (items: unknown[], commentsOf: (issue: number) => string[] = () => []) =>
  qaIssuesFrom(IssueItem.array().parse(items), commentsOf);

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
        comments: [],
      },
    ]);
  });

  it('asks for the comments only of an issue that has any', () => {
    const asked: number[] = [];
    const issues = listed([item(), item({ number: 6, comments: 2 })], (issue) => {
      asked.push(issue);
      return [`comment on ${issue}`];
    });

    expect(asked).toEqual([6]);
    expect(issues.map((issue) => issue.comments)).toEqual([[], ['comment on 6']]);
  });

  it('keeps when an issue was closed as completed, and nothing for any other reason', () => {
    const closedAt = '2026-11-05T10:00:00Z';
    const reasons = ['completed', 'not_planned', 'duplicate', null].map(
      (state_reason) => listed([item({ closed_at: closedAt, state_reason })])[0]?.completedAt
    );

    expect(reasons).toEqual([closedAt, undefined, undefined, undefined]);
    expect(
      listed([item({ state: 'open', closed_at: null, state_reason: 'reopened' })])[0]
    ).not.toHaveProperty('completedAt');
  });

  it('turns a null body into an empty string', () => {
    expect(listed([item({ body: null })])[0]?.body).toBe('');
  });

  it('rejects a malformed item', () => {
    expect(() => listed([item({ state: 'merged' })])).toThrow();
  });
});

describe('harnessComments', () => {
  it('keeps only what the workflow account wrote, in order', () => {
    const comment = (login: string | null, body: string) => ({
      body,
      user: login === null ? null : { login },
    });

    expect(
      harnessComments([
        comment('github-actions[bot]', 'first sighting'),
        comment('someone', 'fingerprint: 0123456789abcdef'),
        comment(null, 'from a deleted account'),
        comment('github-actions[bot]', 'second sighting'),
      ])
    ).toEqual(['first sighting', 'second sighting']);
  });
});

describe('publishedAtFrom', () => {
  const answer = (release: unknown) => ({ data: { repository: { release } } });

  it('reads the publish date of a release', () => {
    expect(publishedAtFrom(answer({ publishedAt: '2026-11-03T19:32:47Z' }))).toBe(
      '2026-11-03T19:32:47Z'
    );
  });

  it('returns nothing for a draft and for a tag without a release', () => {
    expect(publishedAtFrom(answer({ publishedAt: null }))).toBeUndefined();
    expect(publishedAtFrom(answer(null))).toBeUndefined();
  });

  it('rejects an answer that is not about a release', () => {
    expect(() => publishedAtFrom({ message: 'Not Found' })).toThrow();
  });
});
