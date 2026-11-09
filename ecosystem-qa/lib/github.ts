import type { ExecFileSyncOptions } from 'node:child_process';

import { z } from 'zod';

import { gh, ghJson } from '../../scripts/utils/gh.ts';
import type { IssueHit } from './proposals.ts';

const QUIET: ExecFileSyncOptions = { stdio: ['ignore', 'pipe', 'inherit'] };

const SearchResults = z.array(
  z.object({ number: z.number(), labels: z.array(z.object({ name: z.string() })) })
);

export const ghText = (args: string[]): string =>
  gh(args, { ...QUIET, encoding: 'utf8' }) as string;

export const ghParse = <T>(schema: z.ZodType<T>, args: string[]): T =>
  schema.parse(ghJson<unknown>(args, QUIET));

export const searchFingerprint = (repo: string, fingerprint: string): IssueHit[] =>
  ghParse(SearchResults, [
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
  ]).map((hit) => ({ number: hit.number, labels: hit.labels.map((label) => label.name) }));
