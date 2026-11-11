import type { ExecFileSyncOptions } from 'node:child_process';

import { z } from 'zod';

import { gh, ghJson } from '../../scripts/utils/gh.ts';
import type { IssueHit } from './proposals.ts';

const QUIET: ExecFileSyncOptions = { stdio: ['ignore', 'pipe', 'inherit'] };

const SearchResults = z.array(
  z.object({
    number: z.number(),
    labels: z.array(z.object({ name: z.string() })),
    state: z.enum(['open', 'closed']),
  })
);

export const ghText = (args: string[]): string => gh(args, QUIET).toString();

export const ghParse = <T>(schema: z.ZodType<T>, args: string[]): T =>
  schema.parse(ghJson<unknown>(args, QUIET));

// GitHub allows 30 search requests a minute. A sweep searches once per fingerprint and has more than
// that, and a rejected search would end the collector with nothing written.
const SEARCH_INTERVAL_MS = 2_500;
let nextSearchAt = 0;

const waitForSearchSlot = () => {
  const wait = nextSearchAt - Date.now();
  if (wait > 0) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
  }
  nextSearchAt = Date.now() + SEARCH_INTERVAL_MS;
};

export const searchFingerprint = (repo: string, fingerprint: string): IssueHit[] => {
  waitForSearchSlot();
  return ghParse(SearchResults, [
    'search',
    'issues',
    fingerprint,
    '--repo',
    repo,
    '--match',
    'body',
    '--json',
    'number,labels,state',
    '--limit',
    '5',
  ]).map((hit) => ({
    number: hit.number,
    labels: hit.labels.map((label) => label.name),
    state: hit.state,
  }));
};
