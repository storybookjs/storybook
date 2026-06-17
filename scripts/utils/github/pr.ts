import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';
import { ORG, PRIMARY_REPO } from './constants.ts';
import { resolveOperator } from './operator.ts';

/**
 * Coordinates for a PR or an issue. The GitHub REST and GraphQL APIs use the
 * same `{owner, repo, number}` shape for both — they share an ID space within
 * a repo — so there's one type for both.
 */
export interface GithubRefCoords {
  owner: string;
  repo: string;
  number: number;
}

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
export interface PrSnapshot {
  owner: string;
  repo: string;
  number: number;
  url: string;
  title: string;
  body: string;
  author: string;
  isDraft: boolean;
  headSha: string;
  labels: string[];
  files: PrFile[];
}

const URL_RE = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/;

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;

/**
 * Strip `<!-- ... -->` blocks from a PR body. The Storybook PR template
 * embeds example issue references (e.g. `#1000`, `#1001`) inside comment
 * blocks; without stripping those, every assessment would attribute the
 * template examples as real linked issues. Applied at the fetch boundary so
 * every downstream consumer (linked-issue parser, LLM prompts) sees the
 * cleaned body.
 */
function stripHtmlComments(body: string): string {
  return body.replace(HTML_COMMENT_RE, '');
}

/**
 * Normalize a CLI argument into PR coordinates and enforce that the PR
 * belongs to the storybookjs org. Accepts a bare PR number (defaults to
 * `storybookjs/storybook`) or a full PR URL. URLs outside the org are
 * rejected — we don't want a typo to point us at an unrelated repo and
 * produce a confusing review on the wrong PR.
 */
export function normalizeStorybookPr(arg: string): GithubRefCoords {
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

async function fetchPrImpl(coords: GithubRefCoords): Promise<PrSnapshot> {
  const client = getGithubClient();
  const { data: pr } = await client.rest('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner: coords.owner,
    repo: coords.repo,
    pull_number: coords.number,
  });

  const files: PrFile[] = [];
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
