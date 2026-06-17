import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';
import { ORG } from './constants.ts';
import type { GithubRefCoords } from './pr.ts';

/**
 * Where a linked-ref came from. `api` = the GitHub-recognized
 * `closingIssuesReferences` GraphQL edge (i.e., a properly-formatted "Fixes
 * #N" / "Closes org/repo#N" in the PR body that GitHub itself indexed);
 * `body` = our looser body-text scan that catches references GitHub didn't
 * pick up (other-section #N mentions, full URLs, cross-repo refs).
 */
export type LinkedIssueSource = 'api' | 'body';

/**
 * A resolved GitHub issue OR pull request (the GitHub REST `/issues/{n}`
 * endpoint covers both; the array it ends up in tells you which it is). We
 * surface only the fields downstream checks actually consume.
 */
export interface LinkedIssue {
  owner: string;
  repo: string;
  number: number;
  url: string;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  sources?: readonly LinkedIssueSource[];
}

/**
 * Hint extracted from how a reference was written in the PR body. URL
 * references unambiguously identify themselves as issue / pull; bare `#N` /
 * `org/repo#N` references could be either.
 */
type BodyRefHint = 'issue' | 'pull' | 'ambiguous';

interface BodyRef extends GithubRefCoords {
  hint: BodyRefHint;
}

export interface ResolvedRefs {
  /** API-confirmed via `closingIssuesReferences` (strongest "linked" signal). */
  linkedIssues: LinkedIssue[];
  /** Body-found references that resolve to real issues but aren't in the API set. */
  otherIssues: LinkedIssue[];
  /** Body-found references that turn out to be PRs (informational only). */
  otherPrs: LinkedIssue[];
  /** Body-found numbers that exist as neither issue nor PR (likely typos). */
  unresolved: string[];
}

const SAME_REPO_RE = /(?<![A-Za-z0-9_/-])#(\d+)\b/g;
const CROSS_REPO_RE = /\b(storybookjs)\/([A-Za-z0-9_.-]+)#(\d+)\b/g;
const URL_RE = /\bhttps:\/\/github\.com\/(storybookjs)\/([A-Za-z0-9_.-]+)\/(issues|pull)\/(\d+)\b/g;

/**
 * Extract `storybookjs/*` issue/PR references from a PR body.
 *
 * Three forms accepted: `#NNN` (same-repo only — bare `#NNN` outside
 * storybookjs would be ambiguous), `storybookjs/repo#NNN`, and full GitHub
 * URLs (`/issues/N` or `/pull/N`). URL refs carry an unambiguous hint;
 * shortform refs are marked `ambiguous` and the resolver determines what
 * they are at fetch time.
 */
export function parseBodyReferences(prOwner: string, prRepo: string, body: string): BodyRef[] {
  const refs: BodyRef[] = [];
  for (const m of body.matchAll(URL_RE)) {
    refs.push({
      owner: m[1],
      repo: m[2],
      number: Number(m[4]),
      hint: m[3] === 'issues' ? 'issue' : 'pull',
    });
  }
  for (const m of body.matchAll(CROSS_REPO_RE)) {
    refs.push({ owner: m[1], repo: m[2], number: Number(m[3]), hint: 'ambiguous' });
  }
  if (prOwner === ORG) {
    for (const m of body.matchAll(SAME_REPO_RE)) {
      refs.push({ owner: prOwner, repo: prRepo, number: Number(m[1]), hint: 'ambiguous' });
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

async function fetchClosingRefs(
  owner: string,
  repo: string,
  number: number
): Promise<GithubRefCoords[]> {
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

function isHttpError(err: unknown, status: number): boolean {
  if (!err || typeof err !== 'object' || !('status' in err)) return false;
  return (err as { status: unknown }).status === status;
}

const canonical = (r: GithubRefCoords): string => `${r.owner}/${r.repo}#${r.number}`;

interface ResolvedEntity {
  base: LinkedIssue;
  isPr: boolean;
}

/**
 * Fetch a number via REST `/issues/{n}` and classify it as issue vs PR. The
 * endpoint returns both kinds; PRs carry a `pull_request` sub-object. 404 /
 * 410 means the number is neither.
 */
async function fetchIssueOrPr(ref: GithubRefCoords): Promise<ResolvedEntity | null> {
  const client = getGithubClient();
  try {
    const { data } = await client.rest('GET /repos/{owner}/{repo}/issues/{issue_number}', {
      owner: ref.owner,
      repo: ref.repo,
      issue_number: ref.number,
    });
    return {
      base: {
        owner: ref.owner,
        repo: ref.repo,
        number: ref.number,
        url: data.html_url,
        title: data.title,
        body: data.body ?? '',
        state: data.state === 'open' ? 'open' : 'closed',
        labels: data.labels.map((l) => (typeof l === 'string' ? l : (l.name ?? ''))),
      },
      isPr: Boolean((data as { pull_request?: unknown }).pull_request),
    };
  } catch (err: unknown) {
    if (isHttpError(err, 404) || isHttpError(err, 410)) return null;
    throw err;
  }
}

async function resolveLinkedIssuesImpl(
  pr: { owner: string; repo: string; number: number; body: string }
): Promise<ResolvedRefs> {
  const apiRefs = (await fetchClosingRefs(pr.owner, pr.repo, pr.number)).filter(
    (r) => r.owner === ORG
  );
  const bodyRefs = parseBodyReferences(pr.owner, pr.repo, pr.body);

  const linkedIssues: LinkedIssue[] = [];
  const linkedIssuesKeys = new Set<string>();
  for (const ref of apiRefs) {
    const resolved = await fetchIssueOrPr(ref);
    if (!resolved) continue; // API said it was closing but the issue is gone — skip silently
    if (resolved.isPr) continue; // closingIssuesReferences should only return issues; defensive
    linkedIssues.push({ ...resolved.base, sources: ['api'] });
    linkedIssuesKeys.add(canonical(ref));
  }

  const otherIssues: LinkedIssue[] = [];
  const otherPrs: LinkedIssue[] = [];
  const unresolved: string[] = [];

  for (const ref of bodyRefs) {
    const key = canonical(ref);
    // Already promoted to linkedIssues via the API — annotate that we also
    // found it in the body, then skip re-fetching.
    if (linkedIssuesKeys.has(key)) {
      const existing = linkedIssues.find((i) => canonical(i) === key);
      if (existing) existing.sources = [...(existing.sources ?? []), 'body'];
      continue;
    }
    const resolved = await fetchIssueOrPr(ref);
    if (!resolved) {
      unresolved.push(key);
      continue;
    }
    const entry: LinkedIssue = { ...resolved.base, sources: ['body'] };
    if (resolved.isPr) otherPrs.push(entry);
    else otherIssues.push(entry);
  }

  return { linkedIssues, otherIssues, otherPrs, unresolved };
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
