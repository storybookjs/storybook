import { afterEach, describe, expect, it, vi } from 'vitest';

import { writeStepSummary } from './step-summary.ts';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('writeStepSummary', () => {
  it('prints the summary outside Actions, without a credential that an agent wrote into it', () => {
    vi.stubEnv('GITHUB_STEP_SUMMARY', '');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    writeStepSummary(`- \`core.dev-server\`: fail (token github_pat_${'A1b2'.repeat(10)})`);

    expect(log).toHaveBeenCalledWith('- `core.dev-server`: fail (token [redacted])');
  });
});
