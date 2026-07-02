/**
 * Shared test fixtures + msw handler builders for MVC check tests.
 *
 * Two goals:
 *   1. Stop redefining `pr()` / `issue()` in every check test.
 *   2. Make the GraphQL/REST response shapes available behind helpers that
 *      take our internal types (`CrossRefEvent`, `Issue`, `PrContext`) —
 *      tests describe the world in our domain language, the helper handles
 *      the API-shape translation.
 */
import { http, HttpResponse } from 'msw';

import type { CrossRefEvent } from '../../../utils/github/cross-refs.ts';
import type { Issue } from '../../../utils/github/issue.ts';
import type { PrContext } from '../types.ts';

const ZERO_REACTIONS: Issue['reactions'] = {
  total_count: 0,
  '+1': 0,
  '-1': 0,
  laugh: 0,
  confused: 0,
  heart: 0,
  hooray: 0,
  eyes: 0,
  rocket: 0,
};

/** Linked issue with sensible defaults. */
export function mvcIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    owner: 'storybookjs',
    repo: 'storybook',
    number: 100,
    url: 'https://github.com/storybookjs/storybook/issues/100',
    title: 'Issue',
    body: '',
    state: 'open',
    labels: [],
    author: 'someone',
    reactions: ZERO_REACTIONS,
    ...overrides,
  };
}

/** PR context with sensible defaults (eligible community PR, no linked refs). */
export function mvcPr(overrides: Partial<PrContext> = {}): PrContext {
  return {
    owner: 'storybookjs',
    repo: 'storybook',
    number: 1,
    url: 'https://github.com/storybookjs/storybook/pull/1',
    title: 'PR title',
    body: '',
    state: 'open',
    author: 'someone',
    isDraft: false,
    headSha: 'sha',
    labels: ['agent-scan:human'],
    files: [],
    linkedIssues: [],
    otherIssues: [],
    unresolved: [],
    ...overrides,
  };
}

/**
 * msw handler for the `closingIssuesReferences` / cross-refs GraphQL query.
 * Takes our internal `CrossRefEvent` (lowercase state) and constructs the
 * GraphQL `nodes[].source` shape (uppercase state) GitHub returns.
 */
export function crossRefsHandler(refs: CrossRefEvent[] = []) {
  return http.post('https://api.github.com/graphql', () =>
    HttpResponse.json({
      data: {
        repository: {
          issue: {
            timelineItems: {
              nodes: refs.map((r) => ({
                source: {
                  number: r.prNumber,
                  state: r.prState === 'open' ? 'OPEN' : 'CLOSED',
                  merged: r.merged,
                },
              })),
            },
          },
        },
      },
    })
  );
}

/**
 * msw handler for `/issues/{n}/comments`. Takes a list of `{ login, type? }`
 * entries (one per comment) and emits the minimal REST shape consumed by
 * `getIssueOrPrComments`. `type` defaults to `'User'`; pass `'Bot'` to
 * exercise the bot-detection path. Returns a single un-paginated page; pass
 * at most 99 entries to avoid the helper looking for a next page.
 */
export function commentsHandler(
  issue: { owner: string; repo: string; number: number },
  comments: Array<{ login: string | null; type?: 'User' | 'Bot' }> = []
) {
  return http.get(
    `https://api.github.com/repos/${issue.owner}/${issue.repo}/issues/${issue.number}/comments`,
    () =>
      HttpResponse.json(
        comments.map((c, i) => ({
          id: i + 1,
          user: c.login ? { login: c.login, type: c.type ?? 'User' } : null,
          created_at: new Date(0).toISOString(),
          body: '',
        }))
      )
  );
}

/**
 * msw handler for `/pulls/{n}/reviews`. Takes `{ login, state, body?, type? }`
 * entries and emits the minimal REST shape consumed by `getPrReviews`.
 * Defaults: `state` = `COMMENTED`, `body` = '', `type` = `'User'`.
 */
export function reviewsHandler(
  pr: { owner: string; repo: string; number: number },
  reviews: Array<{
    login: string | null;
    state?: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED';
    body?: string;
    type?: 'User' | 'Bot';
    submittedAt?: string;
  }> = []
) {
  return http.get(
    `https://api.github.com/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/reviews`,
    () =>
      HttpResponse.json(
        reviews.map((r, i) => ({
          id: i + 1,
          user: r.login ? { login: r.login, type: r.type ?? 'User' } : null,
          state: r.state ?? 'COMMENTED',
          body: r.body ?? '',
          submitted_at: r.submittedAt ?? new Date(0).toISOString(),
        }))
      )
  );
}

/**
 * msw handler for `/orgs/{org}/teams/{slug}/members`. Returns the given
 * logins as a single-page response.
 */
export function teamMembersHandler(team: { org: string; slug: string }, logins: string[]) {
  return http.get(`https://api.github.com/orgs/${team.org}/teams/${team.slug}/members`, () =>
    HttpResponse.json(logins.map((login, i) => ({ id: i + 1, login })))
  );
}
