import { ORG } from '../config.ts';
import type { LinkedIssue } from '../types.ts';
import type { GithubClient } from './client.ts';

export interface IssueRef {
  owner: string;
  repo: string;
  number: number;
}

const SAME_REPO_RE = /(?<![A-Za-z0-9_/-])#(\d+)\b/g;
const CROSS_REPO_RE = /\b(storybookjs)\/([A-Za-z0-9_.-]+)#(\d+)\b/g;
const URL_RE = /\bhttps:\/\/github\.com\/(storybookjs)\/([A-Za-z0-9_.-]+)\/issues\/(\d+)\b/g;

export function parseBodyReferences(prOwner: string, prRepo: string, body: string): IssueRef[] {
  const refs: IssueRef[] = [];
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

function dedupe(refs: IssueRef[]): IssueRef[] {
  const seen = new Set<string>();
  const out: IssueRef[] = [];
  for (const r of refs) {
    const key = `${r.owner}/${r.repo}#${r.number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

async function fetchClosingRefs(
  client: GithubClient,
  owner: string,
  repo: string,
  number: number
): Promise<IssueRef[]> {
  const data = await client.graphql<any>(
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
  return nodes.map((n: any) => ({
    owner: n.repository.owner.login,
    repo: n.repository.name,
    number: n.number,
  }));
}

export async function resolveLinkedIssues(
  client: GithubClient,
  pr: { owner: string; repo: string; number: number; body: string }
): Promise<{ issues: LinkedIssue[]; broken: string[] }> {
  const closing = await fetchClosingRefs(client, pr.owner, pr.repo, pr.number);
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
        labels: (data.labels ?? []).map((l: any) => (typeof l === 'string' ? l : l.name)),
      });
    } catch (err: any) {
      if (err?.status === 404 || err?.status === 410) {
        broken.push(`${ref.owner}/${ref.repo}#${ref.number}`);
      } else {
        throw err;
      }
    }
  }
  return { issues, broken };
}
