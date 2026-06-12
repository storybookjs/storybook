/**
 * Changelog-rendering shape: turns an associated PR + its commit into the
 * markdown-friendly `PullRequestInfo` used by the release flow's changelog
 * generators (commit/pull/user links, label list, etc).
 *
 * This file used to ship its own GraphQL machinery (DataLoader + raw fetch);
 * it now delegates to `utils/github/associated-prs.ts` so there's a single
 * code path through the standard `getGithubClient` for every GitHub call.
 * The output shape is preserved for back-compat with downstream consumers
 * (`is-pr-frozen.ts`, `get-changes.ts`).
 */
import {
  getAssociatedPrs,
  pickLatestMergedPr,
  type AssociatedPr,
} from '../../utils/github/associated-prs.ts';

export type PullRequestInfo = {
  user: string | null;
  id: string | null;
  title: string | null;
  state: string | null;
  commit: string | null;
  pull: number | null;
  labels: string[] | null;
  links: {
    commit: string | null;
    pull: string | null;
    user: string | null;
  };
};

function asPullRequestInfo(
  commit: string,
  commitUrl: string | null,
  commitAuthor: { login: string; url: string } | null,
  pr: AssociatedPr | null
): PullRequestInfo {
  // The PR author wins when there's an associated PR; we fall back to the
  // commit's user-author (if any) so changelog entries credit the right
  // person for PR-less commits.
  const user = pr?.author ?? commitAuthor;
  return {
    user: user?.login ?? null,
    id: pr?.id ?? null,
    pull: pr?.number ?? null,
    commit,
    title: pr?.title ?? null,
    state: pr?.state ?? null,
    labels: pr?.labels ?? null,
    links: {
      commit: commitUrl ? `[\`${commit}\`](${commitUrl})` : `\`${commit}\``,
      pull: pr ? `[#${pr.number}](${pr.url})` : null,
      user: user ? `[@${user.login}](${user.url})` : null,
    },
  };
}

/**
 * Look up the PR most likely to "be" a commit and return it as the legacy
 * `PullRequestInfo` shape used by changelog generators. When a commit is
 * associated with multiple PRs (e.g., original + backport), the most-recently
 * merged one wins (see `pickLatestMergedPr`).
 */
export async function getPullInfoFromCommit(request: {
  commit: string;
  repo: string;
}): Promise<PullRequestInfo> {
  const { commitUrl, commitAuthor, associatedPrs } = await getAssociatedPrs(request);
  const winner = pickLatestMergedPr(associatedPrs);
  return asPullRequestInfo(request.commit, commitUrl, commitAuthor, winner);
}
