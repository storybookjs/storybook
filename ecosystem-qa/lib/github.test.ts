import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ghJson } from '../../scripts/utils/gh.ts';
import {
  addDiscussionComment,
  byHarness,
  createDiscussion,
  discussionPlaceFrom,
  harnessComments,
  IssueItem,
  listDiscussionComments,
  publishedAtFrom,
  qaIssuesFrom,
  updateDiscussionComment,
} from './github.ts';

vi.mock('../../scripts/utils/gh.ts', () => ({ gh: vi.fn(), ghJson: vi.fn() }));

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

describe('byHarness', () => {
  it('knows the workflow account by the name GraphQL gives it, and only as an app', () => {
    expect(byHarness({ __typename: 'Bot', login: 'github-actions' })).toBe(true);
    expect(byHarness({ __typename: 'User', login: 'github-actions' })).toBe(false);
    expect(byHarness({ __typename: 'Bot', login: 'dependabot' })).toBe(false);
    expect(byHarness(null)).toBe(false);
  });
});

describe('discussionPlaceFrom', () => {
  const answer = (names: string[]) => ({
    data: {
      repository: {
        id: 'R_1',
        discussionCategories: { nodes: names.map((name, index) => ({ id: `DIC_${index}`, name })) },
      },
    },
  });

  it('reads the ids of the repository and of the named category', () => {
    expect(discussionPlaceFrom(answer(['General', 'QA sweeps']), 'o/r', 'QA sweeps')).toEqual({
      repositoryId: 'R_1',
      categoryId: 'DIC_1',
    });
  });

  it('names the missing category instead of writing anywhere else', () => {
    expect(() => discussionPlaceFrom(answer(['General']), 'o/r', 'QA sweeps')).toThrow(
      'o/r has no discussion category named "QA sweeps".'
    );
  });
});

describe('the discussion calls', () => {
  const written = { id: 'DC_1', url: 'https://github.com/o/r/discussions/1' };
  const sent = () => vi.mocked(ghJson).mock.lastCall?.[0] ?? [];
  const field = (name: string) =>
    sent()
      .filter((arg, index, all) => all[index - 1] === '-f' && arg.startsWith(`${name}=`))
      .map((arg) => arg.slice(name.length + 1));

  beforeEach(() => {
    vi.mocked(ghJson).mockReset();
  });

  it('creates a discussion in the category with a body that is sent as raw text', () => {
    vi.mocked(ghJson).mockReturnValue({ data: { createDiscussion: { discussion: written } } });
    const body = '@./secrets.txt\n<!-- sb-qa-plan 3f9c2a7b10de 11.0.md -->';

    expect(createDiscussion({ repositoryId: 'R_1', categoryId: 'DIC_1' }, 'Title', body)).toEqual(
      written
    );
    expect(sent().slice(0, 2)).toEqual(['api', 'graphql']);
    expect(field('query')[0]).toMatch(/^mutation\(.*\)\{createDiscussion\(input:/);
    expect([field('repositoryId'), field('categoryId'), field('title'), field('body')]).toEqual([
      ['R_1'],
      ['DIC_1'],
      ['Title'],
      [body],
    ]);
  });

  it('adds a comment to a discussion and edits a comment by its id', () => {
    vi.mocked(ghJson).mockReturnValue({ data: { addDiscussionComment: { comment: written } } });
    expect(addDiscussionComment('D_1', 'text')).toEqual(written);
    expect(field('query')[0]).toContain(
      '{addDiscussionComment(input:{discussionId:$discussionId,body:$body})'
    );
    expect([field('discussionId'), field('body')]).toEqual([['D_1'], ['text']]);

    vi.mocked(ghJson).mockReturnValue({ data: { updateDiscussionComment: { comment: written } } });
    expect(updateDiscussionComment('DC_1', 'new text')).toEqual(written);
    expect(field('query')[0]).toContain(
      '{updateDiscussionComment(input:{commentId:$commentId,body:$body})'
    );
    expect([field('commentId'), field('body')]).toEqual([['DC_1'], ['new text']]);
  });

  it('reads every page of the comments of a discussion', () => {
    const page = (id: string) => ({
      data: {
        node: { comments: { nodes: [{ id, url: id, body: '', author: null, editor: null }] } },
      },
    });
    vi.mocked(ghJson).mockReturnValue([page('DC_1'), page('DC_2')]);

    expect(listDiscussionComments('D_1').map(({ id }) => id)).toEqual(['DC_1', 'DC_2']);
    expect(sent()).toContain('--paginate');
    expect(field('query')[0]).toContain('$endCursor:String');
  });
});
