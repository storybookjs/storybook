import { describe, expect, it, vi } from 'vitest';

import {
  FAIL_MESSAGE,
  WARN_MESSAGE,
  createIsTrustedReviewer,
  evaluateCoreDxApproval,
  getLatestReviewsByUser,
} from './core-dx-approval.cjs';

describe('getLatestReviewsByUser', () => {
  it('keeps the latest review per user by submitted_at then id', () => {
    const latest = getLatestReviewsByUser([
      {
        id: 1,
        state: 'COMMENTED',
        submitted_at: '2026-01-01T00:00:00Z',
        user: { login: 'alice' },
      },
      {
        id: 2,
        state: 'APPROVED',
        submitted_at: '2026-01-02T00:00:00Z',
        user: { login: 'Alice' },
      },
      {
        id: 3,
        state: 'CHANGES_REQUESTED',
        submitted_at: '2026-01-02T00:00:00Z',
        user: { login: 'alice' },
      },
      {
        id: 4,
        state: 'APPROVED',
        submitted_at: '2026-01-01T00:00:00Z',
        user: { login: 'bob' },
      },
    ]);

    expect(latest.get('alice')?.state).toBe('CHANGES_REQUESTED');
    expect(latest.get('alice')?.id).toBe(3);
    expect(latest.get('bob')?.state).toBe('APPROVED');
  });
});

describe('evaluateCoreDxApproval', () => {
  it('skips draft PRs', async () => {
    const isTrustedReviewer = vi.fn();
    const result = await evaluateCoreDxApproval({
      draft: true,
      authorLogin: 'author',
      reviews: [{ state: 'APPROVED', user: { login: 'core-dev' } }],
      isTrustedReviewer,
    });

    expect(result).toEqual({ decision: 'skip' });
    expect(isTrustedReviewer).not.toHaveBeenCalled();
  });

  it('fails when there are no approvals', async () => {
    const result = await evaluateCoreDxApproval({
      draft: false,
      authorLogin: 'author',
      reviews: [
        { state: 'COMMENTED', user: { login: 'core-dev' } },
        { state: 'CHANGES_REQUESTED', user: { login: 'dx-dev' } },
      ],
      isTrustedReviewer: async () => 'yes',
    });

    expect(result).toEqual({ decision: 'fail', message: FAIL_MESSAGE });
  });

  it('ignores self-approvals from the PR author', async () => {
    const isTrustedReviewer = vi.fn(async () => 'yes');
    const result = await evaluateCoreDxApproval({
      draft: false,
      authorLogin: 'core-dev',
      reviews: [{ state: 'APPROVED', user: { login: 'Core-Dev' } }],
      isTrustedReviewer,
    });

    expect(result).toEqual({ decision: 'fail', message: FAIL_MESSAGE });
    expect(isTrustedReviewer).not.toHaveBeenCalled();
  });

  it('passes when a Core/DX member approved', async () => {
    const result = await evaluateCoreDxApproval({
      draft: false,
      authorLogin: 'author',
      reviews: [
        { state: 'CHANGES_REQUESTED', user: { login: 'other-core' } },
        { state: 'APPROVED', user: { login: 'dx-dev' } },
      ],
      isTrustedReviewer: async (login) => (login === 'dx-dev' ? 'yes' : 'no'),
    });

    expect(result).toEqual({ decision: 'pass' });
  });

  it('does not let CHANGES_REQUESTED from others block an existing Core/DX approval', async () => {
    const result = await evaluateCoreDxApproval({
      draft: false,
      authorLogin: 'author',
      reviews: [
        {
          id: 1,
          state: 'APPROVED',
          submitted_at: '2026-01-01T00:00:00Z',
          user: { login: 'core-dev' },
        },
        {
          id: 2,
          state: 'CHANGES_REQUESTED',
          submitted_at: '2026-01-02T00:00:00Z',
          user: { login: 'other-core' },
        },
      ],
      isTrustedReviewer: async (login) => (login === 'core-dev' ? 'yes' : 'no'),
    });

    expect(result).toEqual({ decision: 'pass' });
  });

  it('fails when approvals are only from non-trusted reviewers', async () => {
    const result = await evaluateCoreDxApproval({
      draft: false,
      authorLogin: 'author',
      reviews: [{ state: 'APPROVED', user: { login: 'maintainer' } }],
      isTrustedReviewer: async () => 'no',
    });

    expect(result).toEqual({ decision: 'fail', message: FAIL_MESSAGE });
  });

  it('warns and allows when membership cannot be verified', async () => {
    const result = await evaluateCoreDxApproval({
      draft: false,
      authorLogin: 'author',
      reviews: [{ state: 'APPROVED', user: { login: 'maybe-core' } }],
      isTrustedReviewer: async () => 'unknown',
    });

    expect(result).toEqual({ decision: 'warn', message: WARN_MESSAGE });
  });

  it('ignores dismissed reviews when deciding approvals', async () => {
    const result = await evaluateCoreDxApproval({
      draft: false,
      authorLogin: 'author',
      reviews: [{ state: 'DISMISSED', user: { login: 'core-dev' } }],
      isTrustedReviewer: async () => 'yes',
    });

    expect(result).toEqual({ decision: 'fail', message: FAIL_MESSAGE });
  });

  it('uses the latest review state per user', async () => {
    const isTrustedReviewer = vi.fn(async () => 'yes');
    const result = await evaluateCoreDxApproval({
      draft: false,
      authorLogin: 'author',
      reviews: [
        {
          id: 1,
          state: 'APPROVED',
          submitted_at: '2026-01-01T00:00:00Z',
          user: { login: 'core-dev' },
        },
        {
          id: 2,
          state: 'CHANGES_REQUESTED',
          submitted_at: '2026-01-02T00:00:00Z',
          user: { login: 'core-dev' },
        },
      ],
      isTrustedReviewer,
    });

    expect(result).toEqual({ decision: 'fail', message: FAIL_MESSAGE });
    expect(isTrustedReviewer).not.toHaveBeenCalled();
  });
});

describe('createIsTrustedReviewer', () => {
  it('returns unknown when no token is available', async () => {
    const isTrustedReviewer = createIsTrustedReviewer({ token: undefined });
    await expect(isTrustedReviewer('someone')).resolves.toBe('unknown');
  });

  it('returns yes for an active Core or DX membership', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('/teams/core/memberships/')) {
        return {
          status: 404,
          ok: false,
          json: async () => ({}),
        };
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({ state: 'active' }),
      };
    });

    const isTrustedReviewer = createIsTrustedReviewer({
      token: 'test-token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(isTrustedReviewer('dx-dev')).resolves.toBe('yes');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns no when the user is not on Core or DX', async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 404,
      ok: false,
      json: async () => ({}),
    }));

    const isTrustedReviewer = createIsTrustedReviewer({
      token: 'test-token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(isTrustedReviewer('maintainer')).resolves.toBe('no');
  });

  it('returns unknown on non-404 API failures', async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 403,
      ok: false,
      json: async () => ({ message: 'Forbidden' }),
    }));

    const isTrustedReviewer = createIsTrustedReviewer({
      token: 'test-token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(isTrustedReviewer('someone')).resolves.toBe('unknown');
  });

  it('returns unknown when fetch throws', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });

    const isTrustedReviewer = createIsTrustedReviewer({
      token: 'test-token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(isTrustedReviewer('someone')).resolves.toBe('unknown');
  });
});
