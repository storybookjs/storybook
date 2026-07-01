/**
 * Shared msw setup for tests that exercise GitHub-API-talking code. Each test
 * file calls `setupMsw()` at the top of its describe block: the helper
 * registers vitest lifecycle hooks that start a single `setupServer` once,
 * reset handlers between tests, clear all GitHub-side memoization caches,
 * and tear it down at the end. Each spec starts with a clean slate.
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { resetGithubClient } from '../github/client.ts';
import { getIssueOrPrComments } from '../github/comments.ts';
import { fetchCrossRefs } from '../github/cross-refs.ts';
import { resolveOperator } from '../github/copilot.ts';
import { fetchIssue } from '../github/issue.ts';
import { resolveLinkedIssues } from '../github/linked-issues.ts';
import { fetchPr } from '../github/pr.ts';
import { getPrReviews } from '../github/reviews.ts';
import { isMaintainer, listTeamMembers } from '../github/teams.ts';

const server = setupServer();

// memoizerific exposes a Map-shaped `cache` on the returned function, but its
// public types don't declare it. Casting is contained to this single helper.
interface MemoizedFn {
  cache: { clear(): void };
}
const MEMOIZED_FNS: MemoizedFn[] = [
  fetchCrossRefs as unknown as MemoizedFn,
  fetchIssue as unknown as MemoizedFn,
  fetchPr as unknown as MemoizedFn,
  getIssueOrPrComments as unknown as MemoizedFn,
  getPrReviews as unknown as MemoizedFn,
  isMaintainer as unknown as MemoizedFn,
  listTeamMembers as unknown as MemoizedFn,
  resolveLinkedIssues as unknown as MemoizedFn,
  resolveOperator as unknown as MemoizedFn,
];

export function setupMsw() {
  beforeAll(() => {
    process.env.GH_TOKEN = process.env.GH_TOKEN || 'test-token';
    server.listen({ onUnhandledRequest: 'error' });
  });
  afterEach(() => {
    server.resetHandlers();
    resetGithubClient();
    for (const fn of MEMOIZED_FNS) fn.cache.clear();
  });
  afterAll(() => server.close());
  return { server, http, HttpResponse };
}
