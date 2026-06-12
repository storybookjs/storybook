/**
 * Shared test fixtures + msw handler builders for MVC check tests.
 *
 * Two goals:
 *   1. Stop redefining `pr()` / `issue()` in every check test.
 *   2. Make the GraphQL/REST response shapes available behind helpers that
 *      take our internal types (`CrossRefEvent`, `TimelineEvent`,
 *      `LinkedIssue`, `PrContext`) — tests describe the world in our domain
 *      language, the helper handles the API-shape translation.
 */
import { http, HttpResponse } from 'msw';

import type { CrossRefEvent } from '../../../utils/github/cross-refs.ts';
import type { LinkedIssue } from '../../../utils/github/linked-issues.ts';
import type { TimelineEvent } from '../../../utils/github/timeline.ts';
import type { PrContext } from '../types.ts';

/** Linked issue with sensible defaults. */
export function mvcIssue(overrides: Partial<LinkedIssue> = {}): LinkedIssue {
  return {
    owner: 'storybookjs',
    repo: 'storybook',
    number: 100,
    url: 'https://github.com/storybookjs/storybook/issues/100',
    title: 'Issue',
    body: '',
    state: 'open',
    labels: [],
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
    author: 'someone',
    isDraft: false,
    headSha: 'sha',
    labels: ['agent-scan:human'],
    files: [],
    linkedIssues: [],
    otherIssues: [],
    otherPrs: [],
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
 * msw handler for REST `/repos/{org}/storybook/issues/{n}/timeline`. Takes
 * our internal `TimelineEvent` ({ type, at }) and serializes as the API
 * shape ({ event, created_at }). Pass `'*'` (the default) to match any
 * issue number — useful as a catch-all in integration tests.
 */
export function timelineHandler(
  issueNumber: number | '*' = '*',
  events: TimelineEvent[] = []
) {
  const segment = issueNumber === '*' ? ':n' : String(issueNumber);
  return http.get(
    `https://api.github.com/repos/storybookjs/storybook/issues/${segment}/timeline`,
    () => HttpResponse.json(events.map((e) => ({ event: e.type, created_at: e.at })))
  );
}
