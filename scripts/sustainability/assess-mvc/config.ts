export const MARKER = '<!-- mvc-check:v1 -->';

/**
 * GitHub scopes required by the assess-mvc CLI. Surfaced in the missing-token
 * error message; the actual scope enforcement happens at GitHub.
 */
export const ASSESS_MVC_SCOPES = Object.freeze([
  'pull_requests:read+write',
  'issues:read+write',
  'contents:read',
  'members:read (org)',
]);

export const VERDICT_LABELS = {
  pass: 'mvc:success',
  fail: 'mvc:failed',
} as const;

export const MANAGED_LABELS = ['mvc:success', 'mvc:failed', 'mvc:skip', 'mvc:pending'] as const;

export const SKIP_LABELS = ['mvc:success', 'mvc:failed', 'mvc:skip'] as const;

// Maintainer team slugs queried for `--skip-internal-prs`. Confirm with org admin
// before enabling triggers in the workflow (spec section 12 open decision).
export const MAINTAINER_TEAM_SLUGS = ['core', 'dx', 'maintainers'] as const;
