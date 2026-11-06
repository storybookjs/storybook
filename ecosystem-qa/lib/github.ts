import { execFileSync } from 'node:child_process';

import { z } from 'zod';

import type { IssueHit } from './proposals.ts';

const SearchResults = z.array(
  z.object({ number: z.number(), labels: z.array(z.object({ name: z.string() })) })
);

export const gh = (...args: string[]) =>
  execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

export const searchFingerprint = (repo: string, fingerprint: string): IssueHit[] =>
  SearchResults.parse(
    JSON.parse(
      gh(
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
        '5'
      )
    )
  ).map((hit) => ({ number: hit.number, labels: hit.labels.map((label) => label.name) }));
