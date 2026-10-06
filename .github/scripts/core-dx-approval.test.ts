import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findPullRequests,
  STATUS_CONTEXT,
  syncApprovalStatus,
  type GitHub,
} from './core-dx-approval.ts';

const REPOSITORY = 'storybookjs/storybook';
const PULL_REQUEST = { number: 1, user: { login: 'Author' }, head: { sha: 'abc123' } };

function createGitHub(options: {
  reviews: { login: string; state: 'APPROVED' | 'CHANGES_REQUESTED' }[];
  trusted: string[];
  currentState?: string;
}) {
  const posted: { state: string; context: string }[] = [];
  const requested: string[] = [];
  const github: GitHub = {
    rest: async <Response>(path: string, body?: unknown) => {
      requested.push(path);
      if (body) {
        posted.push(body as { state: string; context: string });
        return {} as Response;
      }
      return {
        statuses: options.currentState
          ? [{ context: STATUS_CONTEXT, state: options.currentState }]
          : [{ context: 'Danger', state: 'success' }],
      } as Response;
    },
    graphql: async <Response>() =>
      ({
        repository: {
          pullRequest: {
            latestOpinionatedReviews: {
              nodes: options.reviews.map(({ login, state }) => ({ author: { login }, state })),
            },
          },
        },
      }) as Response,
    isTrustedReviewer: async (login) => options.trusted.includes(login),
  };
  return { github, posted, requested };
}

test('posts success when a Core or DX member approved', async () => {
  const { github, posted } = createGitHub({
    reviews: [
      { login: 'maintainer', state: 'APPROVED' },
      { login: 'core-member', state: 'APPROVED' },
    ],
    trusted: ['core-member'],
  });

  assert.equal(await syncApprovalStatus(github, REPOSITORY, PULL_REQUEST), 'approved');
  assert.deepEqual(
    posted.map(({ state, context }) => ({ state, context })),
    [{ state: 'success', context: STATUS_CONTEXT }]
  );
});

test('posts nothing when only writers outside Core and DX approved', async () => {
  const { github, posted } = createGitHub({
    reviews: [{ login: 'maintainer', state: 'APPROVED' }],
    trusted: [],
  });

  assert.equal(await syncApprovalStatus(github, REPOSITORY, PULL_REQUEST), 'unchanged');
  assert.deepEqual(posted, []);
});

test('ignores an approval by the pull request author', async () => {
  const { github, posted } = createGitHub({
    reviews: [{ login: 'author', state: 'APPROVED' }],
    trusted: ['author'],
  });

  assert.equal(await syncApprovalStatus(github, REPOSITORY, PULL_REQUEST), 'unchanged');
  assert.deepEqual(posted, []);
});

test('ignores a trusted reviewer whose latest review requests changes', async () => {
  const { github, posted } = createGitHub({
    reviews: [{ login: 'core-member', state: 'CHANGES_REQUESTED' }],
    trusted: ['core-member'],
  });

  assert.equal(await syncApprovalStatus(github, REPOSITORY, PULL_REQUEST), 'unchanged');
  assert.deepEqual(posted, []);
});

test('downgrades a success status to pending when the approval no longer stands', async () => {
  const { github, posted } = createGitHub({ reviews: [], trusted: [], currentState: 'success' });

  assert.equal(await syncApprovalStatus(github, REPOSITORY, PULL_REQUEST), 'revoked');
  assert.deepEqual(
    posted.map(({ state }) => state),
    ['pending']
  );
});

test('does not repost a success status that is already set', async () => {
  const { github, posted } = createGitHub({
    reviews: [{ login: 'core-member', state: 'APPROVED' }],
    trusted: ['core-member'],
    currentState: 'success',
  });

  assert.equal(await syncApprovalStatus(github, REPOSITORY, PULL_REQUEST), 'approved');
  assert.deepEqual(posted, []);
});

test('propagates a failing team membership lookup instead of approving', async () => {
  const { github, posted } = createGitHub({
    reviews: [{ login: 'core-member', state: 'APPROVED' }],
    trusted: [],
  });
  github.isTrustedReviewer = async () => {
    throw new Error('membership lookup failed');
  };

  await assert.rejects(syncApprovalStatus(github, REPOSITORY, PULL_REQUEST));
  assert.deepEqual(posted, []);
});

test('downgrades a success status to pending when the approval cannot be verified', async () => {
  const { github, posted } = createGitHub({
    reviews: [{ login: 'maintainer', state: 'APPROVED' }],
    trusted: [],
    currentState: 'success',
  });
  github.isTrustedReviewer = async () => {
    throw new Error('membership lookup failed');
  };

  await assert.rejects(syncApprovalStatus(github, REPOSITORY, PULL_REQUEST));
  assert.deepEqual(
    posted.map(({ state }) => state),
    ['pending']
  );
});

test('looks up fork pull requests by head owner and branch', async () => {
  const { github, requested } = createGitHub({ reviews: [], trusted: [] });

  await findPullRequests(github, REPOSITORY, { headOwner: 'fork-owner', headBranch: 'fix/a b' });
  assert.deepEqual(requested, [
    '/repos/storybookjs/storybook/pulls?state=open&head=fork-owner%3Afix%2Fa%20b',
  ]);
});
