import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { FixStatus } from '../types.ts';
import { logMigrationSummary } from './logMigrationSummary.ts';

const summary = { succeeded: [], failed: {}, manual: [], skipped: ['some-fix'] };
const fixResults = { 'some-fix': FixStatus.SKIPPED };

describe('logMigrationSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists what a run would do instead of the statuses, and says nothing changed, in a dry run', () => {
    logMigrationSummary({
      fixResults,
      fixSummary: summary,
      dryRun: true,
      dryRunReport: { apply: ['some-fix'], fail: [], skip: [], manual: [] },
    });

    const output = vi.mocked(logger.log).mock.calls[0][0];
    expect(output).toContain('Would apply: some-fix');
    expect(output).not.toContain('Skipped migrations:');
    expect(vi.mocked(logger.step)).toHaveBeenCalledWith(
      expect.stringContaining('Dry run finished: no files were changed.')
    );
  });

  it('lists skipped migrations outside a dry run', () => {
    logMigrationSummary({ fixResults, fixSummary: summary });

    expect(vi.mocked(logger.log).mock.calls[0][0]).toContain('Skipped migrations:');
  });
});
