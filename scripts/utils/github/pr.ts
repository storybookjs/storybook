import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';
import { ORG, PR_URL_RE, PRIMARY_REPO } from './constants.ts';
import { resolveOperator } from './copilot.ts';
import type { FetchedIssueOrPr, IssueOrPrId } from './types.ts';
import { stripHtmlComments } from './utils.ts';

export interface PrFile {
  path: string;
  additions: number;
  deletions: number;
  patch?: string;
  status: string;
}

/**
 * The github-side shape of a fetched PR. Downstream tools compose this with
 * domain-specific data (e.g., assess-mvc adds `linkedIssues` and
 * `otherIssues`, `otherPrs`, `unresolved`) to build a richer context.
 */
export interface PrWithFiles extends FetchedIssueOrPr {
  isDraft: boolean;
  headSha: string;
  files: PrFile[];
}

/**
 * Normalize a CLI argument into PR coordinates and enforce that the PR
 * belongs to the storybookjs org. Accepts a bare PR number (defaults to
 * `storybookjs/storybook`) or a full PR URL. URLs outside the org or
 * repo are rejected unless `undefined` is passed to the relevant args.
 */
export function normalizeStorybookPr(
  arg: string,
  expectedOwner: string | undefined = ORG,
  expectedRepo: string | undefined = PRIMARY_REPO
): IssueOrPrId {
  const trimmed = (arg ?? '').trim();
  if (trimmed === '') {
    throw new Error('PR argument required (number or URL).');
  }

  if (/^\d+$/.test(trimmed)) {
    return {
      owner: expectedOwner ?? ORG,
      repo: expectedRepo ?? PRIMARY_REPO,
      number: Number(trimmed),
    };
  }

  const match = PR_URL_RE.exec(trimmed);
  if (!match) {
    throw new Error(`Could not parse PR from "${trimmed}". Expect a number or full PR URL.`);
  }
  const [, owner, repo, number] = match;
  if (expectedOwner && owner !== expectedOwner) {
    throw new Error(`PR must be in the ${expectedOwner} org; got ${owner}/${repo}.`);
  }
  if (expectedRepo && repo !== expectedRepo) {
    throw new Error(
      `PR must be in the ${expectedOwner}/${expectedRepo} repo; got ${owner}/${repo}.`
    );
  }
  return { owner, repo, number: Number(number) };
}

async function fetchPrImpl(coords: IssueOrPrId): Promise<PrWithFiles> {
  const client = getGithubClient();
  const { data: pr } = await client.rest('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner: coords.owner,
    repo: coords.repo,
    pull_number: coords.number,
  });

  const files: PrFile[] = [];
  let page = 1;
  // FIXME/TODO: why on earth are we using infinite loops with breaks.
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

  // For agent-authored PRs (Copilot et al.), `pr.user.login` is the bot
  // account. The human operator's identity lives in the timeline's
  // `copilot_work_started` event. We attribute to the operator when found so
  // skip-rule maintainer checks and display credit the right person.
  const operator = await resolveOperator(coords);

  return {
    owner: coords.owner,
    repo: coords.repo,
    number: pr.number,
    url: pr.html_url,
    title: pr.title,
    state: pr.state,
    body: stripHtmlComments(pr.body ?? ''),
    author: operator ?? pr.user?.login ?? '',
    isDraft: Boolean(pr.draft),
    headSha: pr.head.sha,
    labels: pr.labels.map((l) => l.name),
    files,
  };
}

/**
 * Fetch PR metadata + the full file list (paginated). Memoized by `coords`
 * identity for the process lifetime. Callers compose this with
 * `resolveLinkedIssues` to build a richer PR context.
 */
export const fetchPr = memoize(1000)(fetchPrImpl);
