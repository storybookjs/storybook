import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  describeStoredRun,
  groupComparableRuns,
  isCurrentRun,
  isCurrentSample,
  parseResultTimestamp,
  readSampleMeasurement,
} from './comparability.ts';
import { EVALS_DIR } from './constants.ts';
import { currentMeasurement } from './identity.ts';

import type { Comparability } from './comparability.ts';
import type { Measurement } from './identity.ts';

const CELL = { experiment: 'agentic-ref-cc-full-opus-high', evalName: '701-new-ui-flow' };

describe('parseResultTimestamp', () => {
  it('dates a result directory from its name', () => {
    expect(parseResultTimestamp('2026-08-15T13-20-41.492Z')?.toISOString()).toBe(
      '2026-08-15T13:20:41.492Z'
    );
  });

  it('reads a directory that is not a timestamp as undatable', () => {
    expect(parseResultTimestamp('run-plan-2026-08-15.json')).toBeNull();
    expect(parseResultTimestamp('opus')).toBeNull();
  });
});

describe('reading a stored sample', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'comparability-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** An eval directory of runs pinned to `ref`, carrying the fixture as it stands. */
  function writeSample(ref: string, runs = 2): string {
    const evalDir = join(root, 'sample');
    for (let run = 1; run <= runs; run++) {
      const runDir = join(evalDir, `run-${run}`);
      mkdirSync(join(runDir, 'project'), { recursive: true });
      writeFileSync(
        join(runDir, 'result.json'),
        JSON.stringify({
          model: 'opus',
          analysis: {
            provider: currentProvider(),
            externalRepo: { repo: 'yannbf/mealdrop', ref },
            case: {
              integration: 'mcp',
              storybookMcpPackage: { repo: 'yannbf/droppy-ds', branch: 'experiment/full' },
              editPrompt: true,
            },
          },
        })
      );
      for (const file of ['PROMPT.md', 'EVAL.ts']) {
        writeFileSync(
          join(runDir, 'project', file),
          readFileSync(join(EVALS_DIR, CELL.evalName, file), 'utf8')
        );
      }
    }
    return evalDir;
  }

  /** The ref the fixture pins today, as it appears in a result.json. */
  function currentRef(): string {
    const label = currentMeasurement(CELL.experiment, CELL.evalName)!.pin.split('@')[1]!;
    return `refs/tags/agentic-reference/${label}-v4`;
  }

  /** The provider the cell records today, as it appears in a result.json. */
  function currentProvider(): string {
    return currentMeasurement(CELL.experiment, CELL.evalName)!.provider;
  }

  it('reads the measurement its runs recorded', () => {
    expect(
      readSampleMeasurement(writeSample('refs/tags/agentic-reference/droppy-v2'), CELL)
    ).toMatchObject({
      pin: 'yannbf/mealdrop@droppy-v2',
      mcp: 'yannbf/droppy-ds#experiment/full',
    });
  });

  it('reads a directory that does not exist as holding no measurement', () => {
    expect(readSampleMeasurement(join(root, 'nowhere'), CELL)).toBeNull();
  });

  it('reads a sample that measures what its cell measures today as current', () => {
    const sample = writeSample(currentRef(), 3);
    expect(isCurrentSample(sample, CELL)).toBe(true);
  });

  // The whole point of the bundle: a re-tag of one tree is not a new tree.
  it('reads a sample pinned to a bundled ref as current', () => {
    expect(isCurrentSample(writeSample('refs/tags/agentic-reference/droppy-70pc-v2'), CELL)).toBe(
      true
    );
  });

  it('reads a sample pinned to another tree as superseded', () => {
    const sample = writeSample('refs/tags/agentic-reference/base-ui-v1', 4);
    expect(isCurrentSample(sample, CELL)).toBe(false);
  });

  it('reads a run of the current measurement as current', () => {
    const runDir = join(writeSample(currentRef()), 'run-1');
    expect(isCurrentRun(runDir, CELL)).toBe(true);
  });

  it('reads a run pinned to another tree as not current', () => {
    const sample = writeSample('refs/tags/agentic-reference/base-ui-v1');
    expect(isCurrentRun(join(sample, 'run-1'), CELL)).toBe(false);
  });

  it('describes a run with the measurement it recorded', () => {
    const described = describeStoredRun(join(writeSample(currentRef()), 'run-1'), CELL);
    expect(described.current).toBe(true);
    expect(described.measurement).toMatchObject({
      mcp: 'yannbf/droppy-ds#experiment/full',
    });
  });

  it('describes a run whose result.json is unreadable as recording no measurement', () => {
    const runDir = join(writeSample(currentRef()), 'run-1');
    writeFileSync(join(runDir, 'result.json'), '{not json');
    expect(describeStoredRun(runDir, CELL)).toEqual({ measurement: null, current: false });
  });
});

describe('groupComparableRuns', () => {
  function measurement(overrides: Partial<Measurement> = {}): Measurement {
    return {
      experiment: 'exp',
      evalName: '701',
      model: 'opus',
      pin: 'repo@v4',
      mcp: 'ds#full',
      editedPrompt: true,
      provider: 'anthropic',
      task: 'abc',
      ...overrides,
    };
  }

  function run(name: string, overrides: Partial<Comparability> = {}) {
    const comparability: Comparability = {
      experiment: 'exp',
      model: '',
      evalName: '701',
      measurement: measurement(),
      current: true,
      ...overrides,
    };
    return { name, comparability };
  }

  function names(items: ReturnType<typeof run>[]): string[][] {
    return groupComparableRuns(items, (item) => item.comparability).map((group) =>
      group.members.map((member) => member.name)
    );
  }

  // Two collections of one cell are one sample, whatever result directories
  // they arrived in.
  it('puts runs of one measurement together', () => {
    expect(names([run('monday'), run('friday')])).toEqual([['monday', 'friday']]);
  });

  it('keeps different experiments, models and evals apart', () => {
    expect(
      names([
        run('a'),
        run('b', { experiment: 'other' }),
        run('c', { evalName: '702' }),
        run('d', { model: 'sonnet' }),
      ])
    ).toEqual([['a'], ['c'], ['d'], ['b']]);
  });

  it('separates runs whose measurement its cell no longer makes', () => {
    expect(
      names([
        run('now'),
        run('before', { current: false, measurement: measurement({ pin: 'repo@v1' }) }),
      ])
    ).toEqual([['now'], ['before']]);
  });

  it('separates two superseded generations of one cell from each other', () => {
    expect(
      names([
        run('older', { current: false, measurement: measurement({ pin: 'repo@v1' }) }),
        run('newer', { current: false, measurement: measurement({ pin: 'repo@v2' }) }),
        run('older-again', { current: false, measurement: measurement({ pin: 'repo@v1' }) }),
      ])
    ).toEqual([['older', 'older-again'], ['newer']]);
  });

  it('groups runs whose measurement could not be read together', () => {
    expect(
      names([
        run('a', { current: false, measurement: null }),
        run('b', { current: false, measurement: null }),
      ])
    ).toEqual([['a', 'b']]);
  });

  it('orders groups by experiment, then eval, then current first', () => {
    const ordered = groupComparableRuns(
      [
        run('b-old', {
          experiment: 'b',
          current: false,
          measurement: measurement({ pin: 'repo@v1' }),
        }),
        run('a-702', { experiment: 'a', evalName: '702' }),
        run('b-now', { experiment: 'b' }),
        run('a-701', { experiment: 'a' }),
      ],
      (item) => item.comparability
    );
    expect(ordered.map((group) => group.members[0]?.name)).toEqual([
      'a-701',
      'a-702',
      'b-now',
      'b-old',
    ]);
  });
});
