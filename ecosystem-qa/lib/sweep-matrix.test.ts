import { describe, expect, it } from 'vitest';

import { ENTRY } from './fixtures.ts';
import type { CatalogEntry } from './schema.ts';
import { sweepMatrix } from './sweep-matrix.ts';

const CATALOG: CatalogEntry[] = [
  ENTRY,
  { ...ENTRY, id: 'mantine', class: 'tier1', pushTo: 'storybook-tmp/mantine' },
  { ...ENTRY, id: 'n8n', class: 'tier1', pushTo: 'storybook-tmp/n8n', windows: false },
];

const jobs = (repos: string, oses = 'linux', engines = 'claude') => {
  const matrix = sweepMatrix(CATALOG, { repos, oses, engines });
  return 'include' in matrix
    ? matrix.include.map((job) => `${job.repo} ${job.os} ${job.engine}`)
    : matrix;
};

describe('sweepMatrix', () => {
  it('plans one job for one repo, on the runner and in the sandbox of its system', () => {
    expect(
      sweepMatrix(CATALOG, { repos: 'mealdrop', oses: 'linux,windows', engines: 'claude' })
    ).toEqual({
      include: [
        {
          repo: 'mealdrop',
          os: 'linux',
          engine: 'claude',
          runner: 'ubuntu-latest',
          sandbox: 'docker',
        },
        {
          repo: 'mealdrop',
          os: 'windows',
          engine: 'claude',
          runner: 'windows-latest',
          sandbox: 'none',
        },
      ],
    });
  });

  it('plans every named repo with every engine', () => {
    expect(jobs('n8n,mantine', 'linux', 'claude,codex')).toEqual([
      'n8n linux claude',
      'n8n linux codex',
      'mantine linux claude',
      'mantine linux codex',
    ]);
  });

  it('takes a repo class for every entry of that class', () => {
    expect(jobs('owned,tier1')).toEqual([
      'mealdrop linux claude',
      'mantine linux claude',
      'n8n linux claude',
    ]);
  });

  it('runs on Windows only the repos the catalog marks for it', () => {
    expect(jobs('owned,tier1', 'linux,windows')).toEqual([
      'mealdrop linux claude',
      'mealdrop windows claude',
      'mantine linux claude',
      'mantine windows claude',
      'n8n linux claude',
    ]);
  });

  it('plans a repo once when it is named twice or also through its class', () => {
    expect(jobs('n8n, tier1,n8n')).toEqual(['n8n linux claude', 'mantine linux claude']);
  });

  it('names what is neither a catalog id nor a repo class', () => {
    expect(jobs('mealdrop,nine,tier9')).toEqual({
      problems: [
        '"nine" is neither a catalog id nor a repo class. Known: mealdrop, mantine, n8n, owned, tier1, tier2',
        '"tier9" is neither a catalog id nor a repo class. Known: mealdrop, mantine, n8n, owned, tier1, tier2',
      ],
    });
  });

  it('refuses a system or an engine the workflow has no runner for', () => {
    expect(jobs('mealdrop', 'linux,macos', 'claude,gemini')).toEqual({
      problems: ['"macos" is not one of linux, windows', '"gemini" is not one of claude, codex'],
    });
  });

  it('says so when nothing is left to run', () => {
    expect(jobs('n8n', 'windows')).toEqual({
      problems: ['Nothing to run for n8n on windows with claude'],
    });
    expect(jobs(' , ')).toEqual({ problems: ['No repo was named'] });
  });
});
