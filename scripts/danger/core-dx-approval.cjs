/**
 * Pure helpers for requiring an approving review from Core or Developer Experience.
 *
 * Kept as `.cjs` so `scripts/dangerfile.js` can `require()` it inside Danger's constrained
 * runtime (no TS, no package deps, no Node builtin requires) even though `scripts/` is ESM.
 */

const ORG = 'storybookjs';
const TRUSTED_TEAM_SLUGS = ['core', 'developer-experience'];

const FAIL_MESSAGE =
  'This PR needs an approving review from a Storybook Core or Developer Experience team member before it can be merged.';

const WARN_MESSAGE =
  'Could not verify whether an approving reviewer is on the Core or Developer Experience team. Merging is allowed, but please confirm manually.';

/**
 * @typedef {{ user?: { login?: string }, state: string, submitted_at?: string | null, id?: number }} Review
 * @typedef {'yes' | 'no' | 'unknown'} MembershipResult
 * @typedef {'skip' | 'pass' | 'fail' | 'warn'} ApprovalDecision
 * @typedef {{ decision: ApprovalDecision, message?: string }} ApprovalResult
 */

/**
 * Keep the latest review per user (by submitted_at, then id).
 *
 * @param {ReadonlyArray<Review>} reviews
 * @returns {Map<string, Review>}
 */
function getLatestReviewsByUser(reviews) {
  /** @type {Map<string, Review>} */
  const latestByUser = new Map();

  for (const review of reviews) {
    const login = review.user?.login;
    if (!login) {
      continue;
    }

    const key = login.toLowerCase();
    const existing = latestByUser.get(key);
    if (!existing) {
      latestByUser.set(key, review);
      continue;
    }

    const existingTime = Date.parse(existing.submitted_at ?? '') || 0;
    const nextTime = Date.parse(review.submitted_at ?? '') || 0;
    if (
      nextTime > existingTime ||
      (nextTime === existingTime && (review.id ?? 0) > (existing.id ?? 0))
    ) {
      latestByUser.set(key, review);
    }
  }

  return latestByUser;
}

/**
 * Decide whether a non-draft PR has a trusted Core/DX approval.
 *
 * @param {{
 *   draft: boolean,
 *   authorLogin: string,
 *   reviews: ReadonlyArray<Review>,
 *   isTrustedReviewer: (login: string) => Promise<MembershipResult>,
 * }} options
 * @returns {Promise<ApprovalResult>}
 */
async function evaluateCoreDxApproval({ draft, authorLogin, reviews, isTrustedReviewer }) {
  if (draft) {
    return { decision: 'skip' };
  }

  const authorKey = authorLogin.toLowerCase();
  const latestByUser = getLatestReviewsByUser(reviews);
  const approvedLogins = [];

  for (const [loginKey, review] of latestByUser) {
    if (loginKey === authorKey) {
      continue;
    }
    if (review.state === 'APPROVED' && review.user?.login) {
      approvedLogins.push(review.user.login);
    }
  }

  if (approvedLogins.length === 0) {
    return { decision: 'fail', message: FAIL_MESSAGE };
  }

  let sawUnknown = false;
  for (const login of approvedLogins) {
    const result = await isTrustedReviewer(login);
    if (result === 'yes') {
      return { decision: 'pass' };
    }
    if (result === 'unknown') {
      sawUnknown = true;
    }
  }

  if (sawUnknown) {
    return { decision: 'warn', message: WARN_MESSAGE };
  }

  return { decision: 'fail', message: FAIL_MESSAGE };
}

/**
 * Build a membership checker for Core / Developer Experience teams.
 *
 * @param {{
 *   token?: string,
 *   fetchImpl?: typeof fetch,
 *   org?: string,
 *   teams?: ReadonlyArray<string>,
 * }} [options]
 * @returns {(login: string) => Promise<MembershipResult>}
 */
function createIsTrustedReviewer({
  token,
  fetchImpl = globalThis.fetch,
  org = ORG,
  teams = TRUSTED_TEAM_SLUGS,
} = {}) {
  return async function isTrustedReviewer(login) {
    if (!token) {
      return 'unknown';
    }
    if (typeof fetchImpl !== 'function') {
      return 'unknown';
    }

    try {
      for (const team of teams) {
        const response = await fetchImpl(
          `https://api.github.com/orgs/${org}/teams/${team}/memberships/${encodeURIComponent(login)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          }
        );

        if (response.status === 404) {
          continue;
        }

        if (!response.ok) {
          return 'unknown';
        }

        const body = await response.json();
        if (body?.state === 'active') {
          return 'yes';
        }
      }

      return 'no';
    } catch {
      return 'unknown';
    }
  };
}

module.exports = {
  ORG,
  TRUSTED_TEAM_SLUGS,
  FAIL_MESSAGE,
  WARN_MESSAGE,
  getLatestReviewsByUser,
  evaluateCoreDxApproval,
  createIsTrustedReviewer,
};
