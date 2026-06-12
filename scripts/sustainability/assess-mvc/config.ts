export const MARKER = '<!-- mvc-check:v1 -->';

/**
 * Deterministic footer appended to every submitted review. Tells the author
 * the review was automated and where to appeal. Kept out of the LLM prompt
 * so the wording never drifts — the author always sees the same disclaimer
 * and the same appeal channel.
 */
export const REVIEW_FOOTER = [
  '---',
  '',
  "_This review was performed automatically and partially uses AI. If you'd like to appeal the review, please reach out to the Storybook team on [Discord](https://discord.gg/invite/storybook) in the `#contributing` channel._",
].join('\n');

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
