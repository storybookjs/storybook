import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { plannedRun, planScopeOf, type PlanScope } from './plan-scope.ts';

const PATH = 'ecosystem-qa/lib/plan.fixture.md';
const FIXTURE = readFileSync(new URL('./plan.fixture.md', import.meta.url));

const scopeOf = (flags: { batch?: string; tier?: string }, bytes: Uint8Array = FIXTURE) =>
  planScopeOf(PATH, bytes, flags);

const batchOne = scopeOf({ batch: '1' }) as PlanScope;

describe('planScopeOf', () => {
  it('names the plan by its file and the hash of its bytes, at the tier gate unless told', () => {
    expect(batchOne).toMatchObject({
      file: 'plan.fixture.md',
      hash: 'd3e42ee99ad0',
      batch: 1,
      tier: 'gate',
    });
    expect(scopeOf({ batch: '1', tier: 'must' })).toMatchObject({ tier: 'must' });
  });

  it.each(['0', '-1', '1.5', '1e0', '0x1', '01', ' 1', 'one'])(
    'refuses the batch "%s"',
    (batch) => {
      expect(scopeOf({ batch })).toBe(`--batch must be a whole number from 1, found "${batch}".`);
    }
  );

  it('refuses a plan without a batch', () => {
    expect(scopeOf({})).toBe('--plan needs --batch.');
  });

  it('refuses a batch the plan does not have', () => {
    expect(scopeOf({ batch: '4' })).toBe(`${PATH} has no batch 4, only 1 to 3.`);
  });

  it('refuses an unknown tier', () => {
    expect(scopeOf({ batch: '1', tier: 'bogus' })).toMatch(/^--tier "bogus": Invalid option/);
  });

  it('refuses a plan that fails its check, with the first problem', () => {
    const text = FIXTURE.toString('utf8').replace(
      'fetch `http://localhost:6006/index.json`',
      'fetch `https://example.com/index.json`'
    );

    expect(scopeOf({ batch: '1' }, Buffer.from(text))).toMatch(
      new RegExp(`^${PATH} is not a plan that can run, line 57: `)
    );
  });

  it('refuses a plan file whose name a run record cannot hold', () => {
    expect(planScopeOf('plans/my plan.md', FIXTURE, { batch: '1' })).toBe(
      'plans/my plan.md cannot name a run record: use letters, digits, dots and hyphens, ending in .md.'
    );
  });
});

describe('plannedRun', () => {
  it('gives a part the entries of the plan with their PRs', () => {
    expect(plannedRun(batchOne, { repo: 'mealdrop', version: '11.0.0-beta.3' })).toMatchObject({
      record: {
        file: 'plan.fixture.md',
        hash: 'd3e42ee99ad0',
        batch: 1,
        part: 1,
        entries: [
          { id: 'story-sort-in-main', prs: [36137] },
          { id: 'preview-animations', prs: [31900] },
        ],
      },
    });
  });

  it('refuses a version on another line than the plan', () => {
    expect(plannedRun(batchOne, { repo: 'mealdrop', version: '10.6.0' })).toBe(
      'plan.fixture.md plans line 11.0, and --version 10.6.0 is on line 10.6.'
    );
  });

  it('names the commit of a build whose version is on another line than the plan', () => {
    const build = 'a'.repeat(40);
    expect(plannedRun(batchOne, { repo: 'mealdrop', version: '10.6.0', build })).toBe(
      `plan.fixture.md plans line 11.0, and --build ${build} installs 10.6.0, which is on line 10.6.`
    );
  });

  it('refuses a repo that the batch does not list', () => {
    expect(plannedRun(batchOne, { repo: 'primer-react', version: '11.0.0-beta.3' })).toBe(
      'Batch 1 of plan.fixture.md lists no entry for primer-react.'
    );
  });

  it('refuses a part that the batch does not have for the repo', () => {
    expect(plannedRun(batchOne, { repo: 'mealdrop', version: '11.0.0-beta.3', part: '3' })).toBe(
      'Batch 1 of plan.fixture.md has 2 part(s) for mealdrop, not part 3.'
    );
    expect(plannedRun(batchOne, { repo: 'mealdrop', version: '11.0.0-beta.3', part: '1e0' })).toBe(
      '--part must be a whole number from 1, found "1e0".'
    );
  });
});
