import type { PrContext } from '../../sustainability/assess-mvc/types.ts';
import type { GithubClient } from './client.ts';
import { ORG, PRIMARY_REPO } from './constants.ts';

export interface PrCoords {
  owner: string;
  repo: string;
  number: number;
}

const URL_RE = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/;

/**
 * Parse the CLI argument into PR coordinates. Accepts a bare PR number (which
 * defaults to `storybookjs/storybook`) or a full PR URL. URLs outside the
 * `storybookjs` org are rejected — we don't want a typo to point us at an
 * unrelated repo and produce a confusing review on the wrong PR.
 */
export function parsePrArg(arg: string): PrCoords {
  const trimmed = (arg ?? '').trim();
  if (trimmed === '') throw new Error('PR argument required (number or URL).');
  if (/^\d+$/.test(trimmed)) {
    return { owner: ORG, repo: PRIMARY_REPO, number: Number(trimmed) };
  }
  const match = URL_RE.exec(trimmed);
  if (!match) {
    throw new Error(`Could not parse PR from "${trimmed}". Expect a number or full PR URL.`);
  }
  const [, owner, repo, number] = match;
  if (owner !== ORG) {
    throw new Error(`PR must be in the ${ORG} org; got ${owner}/${repo}.`);
  }
  return { owner, repo, number: Number(number) };
}

/**
 * Fetch PR metadata + the full file list (paginated). Returns everything we
 * know about the PR before linked-issue resolution kicks in. Callers compose
 * this with `resolveLinkedIssues` to build a complete `PrContext`.
 */
export async function fetchPr(
  client: GithubClient,
  coords: PrCoords
): Promise<Omit<PrContext, 'linkedIssues' | 'brokenLinkRefs'>> {
  const { data: pr } = await client.rest('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner: coords.owner,
    repo: coords.repo,
    pull_number: coords.number,
  });

  const files: PrContext['files'] = [];
  let page = 1;
  while (true) {
    const { data } = await client.rest('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
      owner: coords.owner,
      repo: coords.repo,
      pull_number: coords.number,
      per_page: 100,
      page,
    });
    if (data.length === 0) break;
    for (const file of data) {
      files.push({
        path: file.filename,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
        status: file.status,
      });
    }
    if (data.length < 100) break;
    page += 1;
  }

  return {
    owner: coords.owner,
    repo: coords.repo,
    number: pr.number,
    url: pr.html_url,
    title: pr.title,
    body: pr.body ?? '',
    author: pr.user?.login ?? '',
    isDraft: Boolean(pr.draft),
    headSha: pr.head.sha,
    labels: (pr.labels ?? []).map((l: any) => l.name),
    files,
  };
}
