import { ORG } from '../../utils/github/constants.ts';
import { teamMembership } from '../../utils/github/teams.ts';
import { MAINTAINER_TEAM_SLUGS, SKIP_BOT_AUTHORS } from './config.ts';

/**
 * Skip-rule evaluation. Each reason exists because of a real failure mode:
 *
 *   - `release-pr` — PRs authored by `github-actions[bot]` or another known
 *     release/automation bot. These are version bumps and infra PRs, not
 *     contributions to assess. Copilot PRs are NOT skipped here because
 *     operator detection rewrites the author to the human tasker.
 *   - `already-assessed` — a previous run already produced a verdict; re-
 *     running would just re-post and re-toggle labels with no new information.
 *     Bypass with `--reassess`.
 *   - `draft` — drafts are work-in-progress; assessing them just creates noise
 *     and contributes nothing for the author. Bypass with `--force`.
 *   - `explicit-skip` — `mvc:skip` lets a maintainer override the bot for
 *     cases the rules don't cover (experimental branches, dependabot, etc).
 *     Bypass with `--force`.
 *   - `maintainer` — PRs from maintainer-team authors don't need MVC coaching;
 *     they're trusted contributors and the checks (e.g. "link an issue")
 *     would be inappropriate. Bypass with `--force`.
 *
 * Order matters: the cheapest, most local checks come first; the team-
 * membership probe is the expensive one and is reached last (and only when
 * other rules didn't already short-circuit).
 */
export type SkipReason =
  | 'release-pr'
  | 'already-assessed'
  | 'draft'
  | 'explicit-skip'
  | 'maintainer';

export interface SkipDecision {
  skip: boolean;
  reason?: SkipReason;
}

export interface EvaluateSkipOpts {
  force: boolean;
  reassess: boolean;
}

export async function evaluateSkip(
  pr: { isDraft: boolean; labels: string[]; author: string },
  opts: EvaluateSkipOpts
): Promise<SkipDecision> {
  if (opts.force) {
    return { skip: false };
  }

  if ((SKIP_BOT_AUTHORS as readonly string[]).includes(pr.author)) {
    return { skip: true, reason: 'release-pr' };
  }

  if (!opts.reassess && (pr.labels.includes('mvc:success') || pr.labels.includes('mvc:failed'))) {
    return { skip: true, reason: 'already-assessed' };
  }

  if (pr.isDraft) {
    return { skip: true, reason: 'draft' };
  }

  if (pr.labels.includes('mvc:skip')) {
    return { skip: true, reason: 'explicit-skip' };
  }

  if (await teamMembership(ORG, MAINTAINER_TEAM_SLUGS).isMaintainer(pr.author)) {
    return { skip: true, reason: 'maintainer' };
  }

  return { skip: false };
}
