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

export const VERDICT_LABELS = {
  pass: 'mvc:success',
  fail: 'mvc:failed',
} as const;

export const MANAGED_LABELS = ['mvc:success', 'mvc:failed', 'mvc:skip', 'mvc:pending'] as const;

export const SKIP_LABELS = ['mvc:success', 'mvc:failed', 'mvc:skip'] as const;

/**
 * PR-author logins that mean "this is a release / automation PR, not a
 * contribution to assess". Mostly GitHub Actions's bot account that authors
 * Storybook's version-bump / patch-release PRs. Copilot-driven PRs aren't in
 * this list — operator detection (see `resolveOperator`) rewrites their
 * author to the human who tasked the agent, so they reach `evaluateSkip`
 * with a human login.
 */
export const SKIP_BOT_AUTHORS = ['github-actions[bot]'] as const;
