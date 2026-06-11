import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';
import { ORG } from './constants.ts';
import type { GithubRefCoords } from './pr.ts';

/**
 * Where a linked-issue reference was found. `api` = the GitHub-recognized
 * `closingIssuesReferences` GraphQL edge (i.e., a properly-formatted "Fixes
 * #N" / "Closes org/repo#N" in the PR body that GitHub itself indexed); `body`
 * = our looser body-text scan that catches references GitHub didn't pick up
 * (other-section #N mentions, full URLs, cross-repo refs).
 *
 * Surfacing this in the CLI lets a reviewer tell at a glance whether a
 * linked issue is "officially" tracked by GitHub or only inferred by us.
 */
export type LinkedIssueSource = 'api' | 'body';

/**
 * A resolved GitHub issue, hydrated from `closingIssuesReferences` + PR body
 * parsing. We surface only the fields downstream checks actually consume.
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

const SAME_REPO_RE = /(?<![A-Za-z0-9_/-])#(\d+)\b/g;
const CROSS_REPO_RE = /\b(storybookjs)\/([A-Za-z0-9_.-]+)#(\d+)\b/g;
const URL_RE = /\bhttps:\/\/github\.com\/(storybookjs)\/([A-Za-z0-9_.-]+)\/issues\/(\d+)\b/g;

/**
 * Extract `storybookjs/*` issue references from a PR body.
 *
 * Three forms accepted: `#NNN` (same-repo only, since `#NNN` outside
 * storybookjs would be ambiguous), `storybookjs/repo#NNN`, and full issue
 * URLs. References outside the `storybookjs` org are filtered out — the rest
 * of the pipeline (label management, team-membership checks) assumes
 * storybookjs.
 */
export function parseBodyReferences(prOwner: string, prRepo: string, body: string): GithubRefCoords[] {
  const refs: GithubRefCoords[] = [];
  for (const m of body.matchAll(CROSS_REPO_RE)) {
    refs.push({ owner: m[1], repo: m[2], number: Number(m[3]) });
  }
  for (const m of body.matchAll(URL_RE)) {
    refs.push({ owner: m[1], repo: m[2], number: Number(m[3]) });
  }
  if (prOwner === ORG) {
    for (const m of body.matchAll(SAME_REPO_RE)) {
      refs.push({ owner: prOwner, repo: prRepo, number: Number(m[1]) });
    }
  }
  return dedupe(refs).filter((r) => r.owner === ORG);
}

function dedupe(refs: GithubRefCoords[]): GithubRefCoords[] {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const key = `${r.owner}/${r.repo}#${r.number}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

async function fetchClosingRefs(owner: string, repo: string, number: number): Promise<GithubRefCoords[]> {
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

async function resolveLinkedIssuesImpl(
  pr: { owner: string; repo: string; number: number; body: string }
): Promise<{ issues: LinkedIssue[]; broken: string[] }> {
  const client = getGithubClient();
  const apiRefs = (await fetchClosingRefs(pr.owner, pr.repo, pr.number)).filter(
    (r) => r.owner === ORG
  );
  const bodyRefs = parseBodyReferences(pr.owner, pr.repo, pr.body);

  // Combine the two ref streams, tracking which source(s) each ref came from
  // and preserving insertion order (API refs first, then body-only refs).
  const sourceMap = new Map<string, Set<LinkedIssueSource>>();
  const refByKey = new Map<string, GithubRefCoords>();
  const orderedKeys: string[] = [];
  const track = (ref: GithubRefCoords, source: LinkedIssueSource) => {
    const key = canonical(ref);
    if (!sourceMap.has(key)) {
      sourceMap.set(key, new Set());
      refByKey.set(key, ref);
      orderedKeys.push(key);
    }
    sourceMap.get(key)?.add(source);
  };
  for (const ref of apiRefs) track(ref, 'api');
  for (const ref of bodyRefs) track(ref, 'body');

  const issues: LinkedIssue[] = [];
  const broken: string[] = [];
  for (const key of orderedKeys) {
    const ref = refByKey.get(key);
    const sources = sourceMap.get(key);
    if (!ref || !sources) continue;
    try {
      const { data } = await client.rest('GET /repos/{owner}/{repo}/issues/{issue_number}', {
        owner: ref.owner,
        repo: ref.repo,
        issue_number: ref.number,
      });
      issues.push({
        owner: ref.owner,
        repo: ref.repo,
        number: ref.number,
        url: data.html_url,
        title: data.title,
        body: data.body ?? '',
        state: data.state === 'open' ? 'open' : 'closed',
        labels: data.labels.map((l) => (typeof l === 'string' ? l : (l.name ?? ''))),
        sources: Array.from(sources),
      });
    } catch (err: unknown) {
      if (isHttpError(err, 404) || isHttpError(err, 410)) {
        broken.push(key);
      } else {
        throw err;
      }
    }
  }
  return { issues, broken };
}

/**
 * Resolve every linked issue for a PR: GraphQL `closingIssuesReferences`
 * (which covers properly-formatted `Fixes #N` / `Closes org/repo#N` mentions)
 * plus the looser body-text references. Issues that 404/410 are reported as
 * `broken` rather than failing the resolution — a typo in a PR body shouldn't
 * count as "no linked issue" for Check 2; we surface it as `warn` instead.
 *
 * Each returned `LinkedIssue` carries a `sources` array describing where the
 * reference was found — `api` (GitHub's `closingIssuesReferences`) and/or
 * `body` (our body-text scan). Memoized by `pr` identity for the process
 * lifetime.
 */
export const resolveLinkedIssues = memoize(1000)(resolveLinkedIssuesImpl);
