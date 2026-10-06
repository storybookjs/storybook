import { expect, test } from 'vitest';

import { syncStatus, type PullRequest, type Status } from './core-dx-approval.ts';

function pullRequest(reviews: Record<string, string>, reportedState?: string): PullRequest {
  return {
    author: { login: 'Author' },
    headRefOid: 'abc123',
    latestOpinionatedReviews: {
      nodes: Object.entries(reviews).map(([login, state]) => ({ state, author: { login } })),
    },
    commits: {
      nodes: [{ commit: { status: reportedState ? { context: { state: reportedState } } : null } }],
    },
  };
}

async function postedStates(
  pr: PullRequest,
  isTrusted: (login: string) => Promise<boolean> = async (login) => login.startsWith('core')
): Promise<string[]> {
  const posted: Status[] = [];
  await syncStatus(pr, isTrusted, (status) => posted.push(status)).catch(() => {});
  return posted.map(({ state }) => state);
}

test('reports success when a Core or DX member approved', async () => {
  const pr = pullRequest({ maintainer: 'APPROVED', 'core-member': 'APPROVED' });
  expect(await postedStates(pr)).toEqual(['success']);
});

test('reports nothing when only writers outside Core and DX approved', async () => {
  expect(await postedStates(pullRequest({ maintainer: 'APPROVED' }))).toEqual([]);
});

test('ignores an approval by the pull request author', async () => {
  const pr = pullRequest({ author: 'APPROVED' });
  expect(await postedStates(pr, async () => true)).toEqual([]);
});

test('ignores a Core or DX member whose latest review requests changes', async () => {
  expect(await postedStates(pullRequest({ 'core-member': 'CHANGES_REQUESTED' }))).toEqual([]);
});

test('does not repeat a success that is already reported', async () => {
  expect(await postedStates(pullRequest({ 'core-member': 'APPROVED' }, 'SUCCESS'))).toEqual([]);
});

test('downgrades a reported success when the approval no longer stands', async () => {
  expect(await postedStates(pullRequest({}, 'SUCCESS'))).toEqual(['pending']);
});

const failingLookup = async () => {
  throw new Error('membership lookup failed');
};

test('reports nothing and fails when team membership cannot be verified', async () => {
  const pr = pullRequest({ 'core-member': 'APPROVED' });
  expect(await postedStates(pr, failingLookup)).toEqual([]);
  await expect(syncStatus(pr, failingLookup, () => {})).rejects.toThrow();
});

test('downgrades a reported success when team membership cannot be verified', async () => {
  const pr = pullRequest({ 'core-member': 'APPROVED' }, 'SUCCESS');
  expect(await postedStates(pr, failingLookup)).toEqual(['pending']);
});
