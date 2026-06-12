import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';
import {
  CROSS_REPO_PR_OR_ISSUE_SHORTHAND_RE,
  ORG,
  SAME_REPO_PR_OR_ISSUE_SHORTHAND_RE,
  PR_OR_ISSUE_URL_RE,
} from './constants.ts';
import type { IssueOrPrId } from './types.ts';
import { fetchIssue, type Issue } from './issue.ts';
import { canonical } from './utils.ts';

/**
 * Where a linked-ref came from. `api` = the GitHub-recognized
 * `closingIssuesReferences` GraphQL edge (i.e., a properly-formatted "Fixes
 * #N" / "Closes org/repo#N" in the PR body that GitHub itself indexed);
 * `body` = our looser body-text scan that catches references GitHub didn't
 * pick up (other-section #N mentions, full URLs, cross-repo refs).
 */
export type LinkedIssueSource = 'api' | 'body';

/**
 * Hint extracted from how a reference was written in the PR body. URL
 * references unambiguously identify themselves as issue / pull; bare `#N` /
 * `org/repo#N` references could be either.
 */
type BodyRefHint = 'issue' | 'pull' | 'ambiguous';

interface BodyRef extends IssueOrPrId {
  hint: BodyRefHint;
}

export interface ResolvedRefs {
  /** API-confirmed via `closingIssuesReferences` (strongest "linked" signal). */
  linkedIssues: Issue[];
  /** Body-found references that resolve to real issues but aren't in the API set. */
  otherIssues: Issue[];
  /** Body-found numbers that exist as neither issue nor PR (likely typos). */
  unresolved: string[];
}

/**
 * Extract `storybookjs/*` issue/PR references from a PR body.
 *
 * Three forms accepted: `#NNN` (same-repo only — bare `#NNN` outside
 * storybookjs would be ambiguous), `storybookjs/repo#NNN`, and full GitHub
 * URLs (`/issues/N` or `/pull/N`). URL refs carry an unambiguous hint;
 * shortform refs are marked `ambiguous` and the resolver determines what
 * they are at fetch time.
 */
export function parseBodyReferences({
  owner,
  repo,
  body,
}: IssueOrPrId & { body: string }): BodyRef[] {
  const refs: BodyRef[] = [];
  for (const m of body.matchAll(PR_OR_ISSUE_URL_RE)) {
    refs.push({
      owner: m[1],
      repo: m[2],
      number: Number(m[4]),
      hint: m[3] === 'issues' ? 'issue' : 'pull',
    });
  }
  for (const m of body.matchAll(CROSS_REPO_PR_OR_ISSUE_SHORTHAND_RE)) {
    refs.push({ owner: m[1], repo: m[2], number: Number(m[3]), hint: 'ambiguous' });
  }
  if (owner === ORG) {
    for (const m of body.matchAll(SAME_REPO_PR_OR_ISSUE_SHORTHAND_RE)) {
      refs.push({ owner, repo, number: Number(m[1]), hint: 'ambiguous' });
    }
  }
  return dedupeBodyRefs(refs).filter((r) => r.owner === ORG);
}

function dedupeBodyRefs(refs: BodyRef[]): BodyRef[] {
  const seen = new Map<string, BodyRef>();
  for (const r of refs) {
    const key = `${r.owner}/${r.repo}#${r.number}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, r);
    } else if (existing.hint === 'ambiguous' && r.hint !== 'ambiguous') {
      // Prefer a definitive URL hint over an ambiguous shortform.
      seen.set(key, r);
    }
  }
  return [...seen.values()];
}

interface ClosingRefsResponse {
  repository?: {
    pullRequest?: {
      closingIssuesReferences?: {
        nodes?: Array<{
          number: number;
          repository: { owner: { login: string }; name: string };
        }>;
      };
    };
  };
}

async function fetchClosingRefs({ owner, repo, number }: IssueOrPrId): Promise<IssueOrPrId[]> {
  const client = getGithubClient();
  const data = await client.graphql<ClosingRefsResponse>(
    `query($owner:String!,$repo:String!,$num:Int!){
      repository(owner:$owner,name:$repo){
        pullRequest(number:$num){
          closingIssuesReferences(first:50){
            nodes{ number repository{ owner{login} name } }
          }
        }
      }
    }`,
    { owner, repo, num: number }
  );
  const nodes = data.repository?.pullRequest?.closingIssuesReferences?.nodes ?? [];
  return nodes.map((n) => ({
    owner: n.repository.owner.login,
    repo: n.repository.name,
    number: n.number,
  }));
}

async function resolveLinkedIssuesImpl(pr: IssueOrPrId & { body: string }): Promise<ResolvedRefs> {
  const apiRefs = (await fetchClosingRefs(pr)).filter((r) => r.owner === ORG);
  const bodyRefs = parseBodyReferences(pr);

  const linkedIssues: Issue[] = [];
  for (const ref of apiRefs) {
    const resolved = await fetchIssue(ref);
    // If an issue is not found, it may have been deleted; that's not a cause for throwing errors.
    if (resolved) {
      linkedIssues.push(resolved);
    }
  }

  const otherIssues: Issue[] = [];
  const unresolved: string[] = [];

  for (const ref of bodyRefs) {
    const resolved = await fetchIssue(ref);
    if (resolved) {
      otherIssues.push(resolved);
    } else {
      unresolved.push(canonical(ref));
    }
  }

  return { linkedIssues, otherIssues, unresolved };
}

/**
 * Resolve every reference for a PR into four buckets:
 *   - `linkedIssues` — strongest signal; GitHub-confirmed via the
 *     `closingIssuesReferences` GraphQL edge (i.e., the PR body's
 *     "Fixes #N" / "Closes org/repo#N" was indexed).
 *   - `otherIssues` — body-found refs that resolve to real issues but
 *     aren't in the API set (the body mentions an issue without a
 *     close-keyword).
 *   - `otherPrs` — body-found refs that turn out to be other PRs.
 *     Informational; they shouldn't drive the duplicate / real-problem
 *     checks.
 *   - `unresolved` — body-found numbers that exist as neither issue nor PR
 *     (typos, deleted refs). Surfaced as debug info; doesn't fail the run.
 *
 * Memoized by `pr` identity.
 */
export const resolveLinkedIssues = memoize(1000)(resolveLinkedIssuesImpl);
