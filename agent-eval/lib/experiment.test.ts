import { describe, expect, it } from 'vitest';

import type { RunCompleteContext } from '@vercel/agent-eval';

import { DEFAULT_EXPERIMENT_CONFIG } from './experiment.ts';

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
