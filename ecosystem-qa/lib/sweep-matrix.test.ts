import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ENTRY } from './fixtures.ts';
import { parsePlan } from './qa-plan.ts';
import type { CatalogEntry } from './schema.ts';
import { planMatrix, sweepMatrix, withoutResult } from './sweep-matrix.ts';

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
      notes: [],
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

  it('plans a system and an engine once when the list repeats them', () => {
    expect(jobs('n8n', 'linux,linux', 'claude, claude')).toEqual(['n8n linux claude']);
  });

  it('says which named repo it leaves off Windows, and which class is empty', () => {
    expect(
      sweepMatrix(CATALOG, {
        repos: 'n8n,mealdrop,tier2',
        oses: 'linux,windows',
        engines: 'claude',
      })
    ).toMatchObject({
      notes: [
        'n8n is not marked for windows in the catalog, so it does not run there',
        'No catalog entry has the class tier2',
      ],
    });
  });

  it('has nothing to say about a repo that a class brought in and that stays off Windows', () => {
    expect(
      sweepMatrix(CATALOG, { repos: 'tier1', oses: 'linux,windows', engines: 'claude' })
    ).toMatchObject({
      notes: [],
    });
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

describe('planMatrix', () => {
  const plan = parsePlan(readFileSync(new URL('./plan.fixture.md', import.meta.url), 'utf8'));
  const jobsOf = (batch: number, engines = 'claude') => {
    const matrix = planMatrix(plan, batch, engines);
    return 'include' in matrix
      ? matrix.include.map((job) => `${job.repo} part ${job.part} ${job.os} ${job.engine}`)
      : matrix;
  };

  it('plans one Linux job in the Docker sandbox for each repo and part of the batch', () => {
    expect(planMatrix(plan, 2, 'claude')).toEqual({
      include: [
        {
          repo: 'mealdrop',
          part: 1,
          os: 'linux',
          engine: 'claude',
          runner: 'ubuntu-latest',
          sandbox: 'docker',
        },
        {
          repo: 'primer-react',
          part: 1,
          os: 'linux',
          engine: 'claude',
          runner: 'ubuntu-latest',
          sandbox: 'docker',
        },
      ],
    });
  });

  it('gives a repo with more entries than one run holds a job for each part, with every engine', () => {
    expect(jobsOf(1, 'claude,codex')).toEqual([
      'mealdrop part 1 linux claude',
      'mealdrop part 1 linux codex',
      'mealdrop part 2 linux claude',
      'mealdrop part 2 linux codex',
      'mantine part 1 linux claude',
      'mantine part 1 linux codex',
    ]);
  });

  it('names the batches the plan has when asked for another', () => {
    expect(jobsOf(99)).toEqual({ problems: ['The plan has no batch 99, only 1 to 3'] });
    expect(jobsOf(0)).toEqual({ problems: ['The plan has no batch 0, only 1 to 3'] });
  });

  it('refuses an engine the workflow has no runner for, and no engine at all', () => {
    expect(jobsOf(1, 'gemini')).toEqual({ problems: ['"gemini" is not one of claude, codex'] });
    expect(jobsOf(1, ' ')).toEqual({ problems: ['No engine was named'] });
  });
});

describe('withoutResult', () => {
  const run = (repo: string, os: string, engine = 'claude') => ({ repo, os, engine });
  const planned = [run('mealdrop', 'linux'), run('mealdrop', 'windows'), run('gutenberg', 'linux')];

  it('names the planned jobs that left no result', () => {
    expect(withoutResult(planned, [run('mealdrop', 'linux')])).toEqual([
      'mealdrop on windows with claude',
      'gutenberg on linux with claude',
    ]);
  });

  it('tells the same repo apart by system and by engine', () => {
    const results = [run('mealdrop', 'linux', 'codex'), run('mealdrop', 'windows')];

    expect(withoutResult(planned, results)).toEqual([
      'mealdrop on linux with claude',
      'gutenberg on linux with claude',
    ]);
  });

  it('names a missing part of a plan run by its repo and part', () => {
    const part = (number: number) => ({ ...run('mealdrop', 'linux'), part: number });

    expect(withoutResult([part(1), part(2)], [part(1), run('mealdrop', 'linux')])).toEqual([
      'mealdrop part 2 on linux with claude',
    ]);
  });

  it('names nothing when every planned job has a result, or nothing was planned', () => {
    expect(withoutResult(planned, planned)).toEqual([]);
    expect(withoutResult([], [run('mealdrop', 'linux')])).toEqual([]);
  });
});
