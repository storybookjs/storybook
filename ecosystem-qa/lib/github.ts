import type { ExecFileSyncOptions } from 'node:child_process';

import { z } from 'zod';

import { gh, ghJson } from '../../scripts/utils/gh.ts';
import type { QaIssue } from './proposals.ts';

const QUIET: ExecFileSyncOptions = { stdio: ['ignore', 'pipe', 'inherit'] };

export const IssueItem = z.object({
  number: z.number(),
  title: z.string(),
  state: z.enum(['open', 'closed']),
  labels: z.array(z.object({ name: z.string() })),
  body: z.string().nullable(),
  comments: z.number(),
  closed_at: z.string().nullable().optional(),
  state_reason: z.string().nullable().optional(),
  pull_request: z.unknown().optional(),
});

export const ghText = (args: string[]): string => gh(args, QUIET).toString();

export const ghParse = <T>(schema: z.ZodType<T>, args: string[]): T =>
  schema.parse(ghJson<unknown>(args, QUIET));

export const pages = <T extends z.ZodType>(item: T, path: string): z.infer<T>[] =>
  ghParse(z.array(z.array(item)), ['api', '--paginate', '--slurp', path]).flat();

// The filing job writes with the workflow token, so its comments come from this account. Anyone can
// comment on an issue, so no other comment may tie a fingerprint to it.
const HARNESS_LOGIN = 'github-actions[bot]';

export const IssueComment = z.object({
  body: z.string(),
  user: z.object({ login: z.string() }).nullable(),
});

export const harnessComments = (comments: z.infer<typeof IssueComment>[]): string[] =>
  comments
    .filter((comment) => comment.user?.login === HARNESS_LOGIN)
    .map((comment) => comment.body);

export const qaIssuesFrom = (
  items: z.infer<typeof IssueItem>[],
  commentsOf: (issue: number) => string[]
): QaIssue[] =>
  items
    .filter((item) => item.pull_request === undefined)
    .map((item) => ({
      number: item.number,
      title: item.title,
      state: item.state,
      labels: item.labels.map((label) => label.name),
      body: item.body ?? '',
      comments: item.comments > 0 ? commentsOf(item.number) : [],
      ...(item.closed_at ? { closedAt: item.closed_at } : {}),
      ...(item.state_reason ? { stateReason: item.state_reason } : {}),
    }));

/**
 * List every issue of `repo` that carries `label`, with the comments the harness wrote on it.
 *
 * One listing replaces a search per fingerprint, which the search rate limit of 30 a minute cannot
 * serve for a whole sweep, and a listing sees an issue the moment it exists while the search index lags.
 * The comments take one more request for each issue that has any.
 */
export const listQaIssues = (repo: string, label: string): QaIssue[] =>
  qaIssuesFrom(
    pages(IssueItem, `repos/${repo}/issues?labels=${label}&state=all&per_page=100`),
    (issue) =>
      harnessComments(pages(IssueComment, `repos/${repo}/issues/${issue}/comments?per_page=100`))
  );

const Release = z.object({ published_at: z.string().nullable() });

export const publishedAtFrom = (release: unknown): string | undefined =>
  Release.parse(release).published_at ?? undefined;

/** Return when the GitHub release `v<version>` of `repo` was published, or nothing when there is no such release. */
export const releasePublishedAt = (repo: string, version: string): string | undefined => {
  try {
    return publishedAtFrom(
      ghJson(['api', `repos/${repo}/releases/tags/v${version}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    );
  } catch (error) {
    if (String((error as { stderr?: unknown }).stderr).includes('(HTTP 404)')) {
      return undefined;
    }
    throw error;
  }
};
