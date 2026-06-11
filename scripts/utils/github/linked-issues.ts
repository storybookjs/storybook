import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';
import { ORG } from './constants.ts';
import type { GithubRefCoords } from './pr.ts';

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
  return Boolean(err) && typeof err === 'object' && (err as { status?: number }).status === status;
}

async function resolveLinkedIssuesImpl(
  pr: { owner: string; repo: string; number: number; body: string }
): Promise<{ issues: LinkedIssue[]; broken: string[] }> {
  const client = getGithubClient();
  const closing = await fetchClosingRefs(pr.owner, pr.repo, pr.number);
  const bodyRefs = parseBodyReferences(pr.owner, pr.repo, pr.body);
  const candidates = dedupe([...closing, ...bodyRefs]).filter((r) => r.owner === ORG);
  const issues: LinkedIssue[] = [];
  const broken: string[] = [];
  for (const ref of candidates) {
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
      });
    } catch (err: unknown) {
      if (isHttpError(err, 404) || isHttpError(err, 410)) {
        broken.push(`${ref.owner}/${ref.repo}#${ref.number}`);
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
 * Memoized by `pr` identity for the process lifetime.
 */
export const resolveLinkedIssues = memoize(1000)(resolveLinkedIssuesImpl);
