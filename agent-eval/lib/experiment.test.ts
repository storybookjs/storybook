import { describe, expect, it } from 'vitest';

import type { RunCompleteContext } from '@vercel/agent-eval';

import { DEFAULT_EXPERIMENT_CONFIG, onlyWhenNamed } from './experiment.ts';

describe('the run-complete hook', () => {
  it('records the checkout commit next to the existing metadata', async () => {
    const context = {
      runData: { result: { status: 'passed', duration: 1, metadata: { note: 'kept' } } },
    } as unknown as RunCompleteContext;

    const runData = await DEFAULT_EXPERIMENT_CONFIG.onRunComplete(context);

    expect(runData.result.metadata).toEqual({
      note: 'kept',
      checkout: { commit: expect.stringMatching(/^[0-9a-f]{40}$/), dirty: expect.any(Boolean) },
    });
  });
});

describe('an experiment outside the default set', () => {
  const experimentUrl = 'file:///repo/agent-eval/experiments/codex-plugin-gpt-6-luna-low.ts';
  const evals = ['801-create-accessible-component' as const];

  it('runs no evals when the command line does not name it', () => {
    expect(onlyWhenNamed(experimentUrl, evals, ['node', 'agent-eval'])).toEqual([]);
  });

  it('runs its evals when the command line names it', () => {
    expect(
      onlyWhenNamed(experimentUrl, evals, ['node', 'agent-eval', 'codex-plugin-gpt-6-luna-low'])
    ).toEqual(evals);
  });

  it('does not run for another experiment whose name starts the same', () => {
    expect(
      onlyWhenNamed(experimentUrl, evals, ['node', 'agent-eval', 'codex-plugin-gpt-6-luna-low-x3'])
    ).toEqual([]);
  });
});
