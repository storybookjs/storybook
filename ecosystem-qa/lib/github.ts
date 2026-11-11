import type { ExecFileSyncOptions } from 'node:child_process';

import { z } from 'zod';

import { gh, ghJson } from '../../scripts/utils/gh.ts';
import { QA_LABEL, type QaIssue } from './proposals.ts';

const QUIET: ExecFileSyncOptions = { stdio: ['ignore', 'pipe', 'inherit'] };

const IssueListing = z.array(
  z.object({
    number: z.number(),
    title: z.string(),
    state: z.enum(['open', 'closed']),
    labels: z.array(z.object({ name: z.string() })),
    body: z.string().nullable(),
    closed_at: z.string().nullable().optional(),
    state_reason: z.string().nullable().optional(),
    pull_request: z.unknown().optional(),
  })
);

export const ghText = (args: string[]): string => gh(args, QUIET).toString();

export const ghParse = <T>(schema: z.ZodType<T>, args: string[]): T =>
  schema.parse(ghJson<unknown>(args, QUIET));

export const pages = <T extends z.ZodType>(item: T, path: string): z.infer<T>[] =>
  ghParse(z.array(z.array(item)), ['api', '--paginate', '--slurp', path]).flat();

export const qaIssuesFrom = (items: unknown): QaIssue[] =>
  IssueListing.parse(items)
    .filter((item) => item.pull_request === undefined)
    .map((item) => ({
      number: item.number,
      title: item.title,
      state: item.state,
      labels: item.labels.map((label) => label.name),
      body: item.body ?? '',
      ...(item.closed_at ? { closedAt: item.closed_at } : {}),
      ...(item.state_reason ? { stateReason: item.state_reason } : {}),
    }));

/**
 * List every issue of `repo` that carries the QA label.
 *
 * One listing replaces a search per fingerprint, which the search rate limit of 30 a minute cannot
 * serve for a whole sweep, and a listing sees an issue the moment it exists while the search index lags.
 */
export const listQaIssues = (repo: string): QaIssue[] =>
  qaIssuesFrom(
    pages(z.unknown(), `repos/${repo}/issues?labels=${QA_LABEL}&state=all&per_page=100`)
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
