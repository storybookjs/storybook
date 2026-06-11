/**
 * Skip-rule evaluation for `--skip-internal-prs`.
 *
 * Purpose: in batch / automation runs we don't want to spend tokens or trip
 * over our own labels when the PR isn't eligible for MVC review. Each reason
 * exists because of a real failure mode:
 *
 *   - `draft` — drafts are work-in-progress; assessing them just creates noise
 *     and contributes nothing for the author.
 *   - `already-assessed` — a previous run already produced a verdict; re-running
 *     would just re-post and re-toggle labels with no new information.
 *   - `explicit-skip` — `mvc:skip` lets a maintainer override the bot for cases
 *     the rules don't cover (experimental branches, dependabot, etc).
 *   - `maintainer` — PRs from maintainer-team authors don't need MVC coaching;
 *     they're trusted contributors and the checks (e.g. "link an issue") would
 *     be inappropriate.
 *
 * Order matters: the cheapest, most local checks come first; the team-membership
 * probe is the expensive one and is reached last (and only when other rules
 * didn't already short-circuit). The `--no-skip-internal-prs` flag bypasses
 * this entirely so a maintainer can force an assessment of any PR they want.
 */
export type SkipReason = 'draft' | 'already-assessed' | 'explicit-skip' | 'maintainer';

export interface SkipDecision {
  skip: boolean;
  reason?: SkipReason;
}

export interface SkipDeps {
  isMaintainer(login: string): Promise<boolean>;
}

export async function evaluateSkip(
  pr: { isDraft: boolean; labels: string[]; author: string },
  deps: SkipDeps
): Promise<SkipDecision> {
  if (pr.isDraft) return { skip: true, reason: 'draft' };
  if (pr.labels.includes('mvc:success') || pr.labels.includes('mvc:failed')) {
    return { skip: true, reason: 'already-assessed' };
  }
  if (pr.labels.includes('mvc:skip')) return { skip: true, reason: 'explicit-skip' };
  if (await deps.isMaintainer(pr.author)) return { skip: true, reason: 'maintainer' };
  return { skip: false };
}
