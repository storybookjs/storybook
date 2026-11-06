import { describe, expect, it } from 'vitest';

import { agentsNeeded, makespan, mergeTaskGraphs } from './selection.ts';

const task = (project: string, target: string, continuous = false) => ({
  target: { project, target },
  continuous,
});

describe('the selection of an NX DTE run', () => {
  it('leaves continuous tasks out and waits for what they wait for', () => {
    const selection = mergeTaskGraphs([
      {
        tasks: {
          'a:sandbox': task('a', 'sandbox'),
          'a:dev': task('a', 'dev', true),
          'a:e2e-tests-dev-1': task('a', 'e2e-tests-dev-1'),
          'scripts:run-registry': task('scripts', 'run-registry', true),
          'scripts:publish': task('scripts', 'publish'),
        },
        dependencies: { 'a:sandbox': [], 'a:e2e-tests-dev-1': [], 'scripts:publish': [] },
        continuousDependencies: {
          'a:sandbox': ['scripts:run-registry'],
          'a:dev': ['a:sandbox', 'scripts:run-registry'],
          'a:e2e-tests-dev-1': ['a:dev'],
          'scripts:run-registry': ['scripts:publish'],
        },
      },
    ]);

    expect(Object.keys(selection.tasks)).toEqual([
      'a:e2e-tests-dev-1',
      'a:sandbox',
      'scripts:publish',
    ]);
    expect(selection.dependencies).toEqual({
      'a:e2e-tests-dev-1': ['a:sandbox', 'scripts:publish'],
      'a:sandbox': ['scripts:publish'],
      'scripts:publish': [],
    });
  });

  it('merges the graphs of several commands', () => {
    const selection = mergeTaskGraphs([
      { tasks: { 'a:compile': task('a', 'compile') }, dependencies: { 'a:compile': [] } },
      {
        tasks: { 'a:compile': task('a', 'compile'), 'a:check': task('a', 'check') },
        dependencies: { 'a:compile': [], 'a:check': ['a:compile'] },
      },
    ]);
    expect(selection.dependencies).toEqual({ 'a:check': ['a:compile'], 'a:compile': [] });
  });

  const seconds = ({ target }: { target: string }) => Number(target);
  // `n` independent tasks of `length` seconds each.
  const flat = (n: number, length: number) => ({
    tasks: Object.fromEntries(
      Array.from({ length: n }, (_, i) => [
        `p${i}:${length}`,
        { project: `p${i}`, target: `${length}` },
      ])
    ),
    dependencies: {},
  });

  it('schedules ready tasks on the free agents, after what they wait for', () => {
    const chain = {
      tasks: { 'a:10': { project: 'a', target: '10' }, 'b:20': { project: 'b', target: '20' } },
      dependencies: { 'b:20': ['a:10'] },
    };
    expect(makespan(chain, 5, seconds)).toBe(30);
    expect(makespan(flat(4, 10), 1, seconds)).toBe(40);
    expect(makespan(flat(4, 10), 2, seconds)).toBe(20);
  });

  it('asks for the fewest agents that end the run about as soon as all of them would', () => {
    expect(agentsNeeded({ tasks: {}, dependencies: {} }, 44)).toBe(0);
    // Ten 100-second tasks: ten agents end at 100s, five at 200s (more than 10% or 30s later).
    expect(agentsNeeded(flat(10, 100), 44, { seconds })).toBe(10);
    // Never more agents than tasks, nor than the cap.
    expect(agentsNeeded(flat(3, 100), 44, { seconds })).toBe(3);
    expect(agentsNeeded(flat(10, 100), 4, { seconds })).toBe(4);
    // Short tasks share agents: ten 5-second tasks end within 30s on two agents.
    expect(agentsNeeded(flat(10, 5), 44, { seconds })).toBe(2);
  });
});
