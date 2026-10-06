import assert from 'node:assert/strict';
import test from 'node:test';

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
  assert.deepEqual(await postedStates(pr), ['success']);
});

test('reports nothing when only writers outside Core and DX approved', async () => {
  assert.deepEqual(await postedStates(pullRequest({ maintainer: 'APPROVED' })), []);
});

test('ignores an approval by the pull request author', async () => {
  const pr = pullRequest({ author: 'APPROVED' });
  assert.deepEqual(await postedStates(pr, async () => true), []);
});

test('ignores a Core or DX member whose latest review requests changes', async () => {
  assert.deepEqual(await postedStates(pullRequest({ 'core-member': 'CHANGES_REQUESTED' })), []);
});

test('does not repeat a success that is already reported', async () => {
  assert.deepEqual(await postedStates(pullRequest({ 'core-member': 'APPROVED' }, 'SUCCESS')), []);
});

test('downgrades a reported success when the approval no longer stands', async () => {
  assert.deepEqual(await postedStates(pullRequest({}, 'SUCCESS')), ['pending']);
});

const failingLookup = async () => {
  throw new Error('membership lookup failed');
};

test('reports nothing and fails when team membership cannot be verified', async () => {
  const pr = pullRequest({ 'core-member': 'APPROVED' });
  assert.deepEqual(await postedStates(pr, failingLookup), []);
  await assert.rejects(syncStatus(pr, failingLookup, () => {}));
});

test('downgrades a reported success when team membership cannot be verified', async () => {
  const pr = pullRequest({ 'core-member': 'APPROVED' }, 'SUCCESS');
  assert.deepEqual(await postedStates(pr, failingLookup), ['pending']);
});
