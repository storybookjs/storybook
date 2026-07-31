import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCliOptions } from './cli.ts';
import { DEFAULT_ENGINE_IDS } from './registry.ts';

const workRoot = path.resolve('docgen-perf-test');

describe('parseCliOptions', () => {
  it('preserves the descriptive command defaults and repeatable engine selection', () => {
    expect(parseCliOptions([], workRoot)).toMatchObject({
      quick: false,
      engines: DEFAULT_ENGINE_IDS,
      jsonOut: path.join(workRoot, 'results.json'),
    });
    expect(
      parseCliOptions(['--engine', 'react-legacy', '--engine', 'react-osa', '--quick'], workRoot)
    ).toMatchObject({ quick: true, engines: ['react-legacy', 'react-osa'] });
  });

  it('selects exactly one pair and validates the explicit gate configuration', () => {
    expect(
      parseCliOptions(
        [
          '--compare',
          'vue-component-meta-version',
          '--seed',
          '42',
          '--repetitions',
          '10',
          '--max-regression',
          '0.05',
        ],
        workRoot
      )
    ).toMatchObject({
      engines: ['vue-component-meta', 'vue-component-meta-next'],
      seed: 42,
      repetitions: 10,
      maxRegression: 0.05,
    });
    expect(() =>
      parseCliOptions(
        ['--compare', 'vue', '--max-regression', '0.1', '--repetitions', '9'],
        workRoot
      )
    ).toThrow('even --repetitions');
    expect(() => parseCliOptions(['--compare', 'vue'], workRoot)).toThrow(
      'explicit --max-regression'
    );
  });

  it('rejects gate-only flags on a descriptive run', () => {
    expect(() => parseCliOptions(['--seed', '1'], workRoot)).toThrow('require --compare');
    expect(() => parseCliOptions(['--repetitions', '4'], workRoot)).toThrow('require --compare');
  });
});
