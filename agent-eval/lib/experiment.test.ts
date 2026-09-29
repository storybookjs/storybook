import { describe, expect, it } from 'vitest';

import type { RunCompleteContext } from '@vercel/agent-eval';

import { DEFAULT_EXPERIMENT_CONFIG } from './experiment.ts';

describe('the run-complete hook', () => {
  it('keeps the checkout tarballs out of the saved files and records the checkout commit', async () => {
    const context = {
      runData: {
        result: { status: 'passed', duration: 1, metadata: { note: 'kept' } },
        generatedFiles: {
          'src/Button.tsx': Buffer.from('export {}'),
          'package-lock.json': Buffer.from('{}'),
          'local-packages/storybook.tgz': Buffer.from('tarball'),
          'local-packages/packages.json': Buffer.from('[]'),
        },
      },
    } as unknown as RunCompleteContext;

    const runData = await DEFAULT_EXPERIMENT_CONFIG.onRunComplete(context);

    expect(Object.keys(runData.generatedFiles ?? {})).toEqual([
      'src/Button.tsx',
      'package-lock.json',
    ]);
    expect(runData.result.metadata).toEqual({
      note: 'kept',
      checkout: { commit: expect.stringMatching(/^[0-9a-f]{40}$/), dirty: expect.any(Boolean) },
    });
  });
});
