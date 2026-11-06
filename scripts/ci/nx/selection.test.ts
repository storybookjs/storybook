import { describe, expect, it } from 'vitest';

import { mergeTaskGraphs } from './selection.ts';

const task = (project: string, target: string, continuous = false) => ({
  target: { project, target },
  continuous,
});

describe('the selection of an NX DTE run', () => {
  it('keeps the tasks of every command, without the continuous ones', () => {
    const selection = mergeTaskGraphs([
      {
        tasks: {
          'a:sandbox': task('a', 'sandbox'),
          'a:dev': task('a', 'dev', true),
          'a:e2e-tests-dev-1': task('a', 'e2e-tests-dev-1'),
        },
      },
      { tasks: { 'a:sandbox': task('a', 'sandbox'), 'b:check': task('b', 'check') } },
    ]);

    expect(Object.keys(selection.tasks)).toEqual(['a:e2e-tests-dev-1', 'a:sandbox', 'b:check']);
    expect(selection.tasks['b:check']).toEqual({ project: 'b', target: 'check' });
  });
});
