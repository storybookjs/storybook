import { stripVTControlCharacters } from 'node:util';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { FixStatus } from '../types.ts';
import { logMigrationSummary } from './logMigrationSummary.ts';

const summary = { succeeded: [], failed: {}, manual: [], skipped: ['some-fix'] };
const fixResults = { 'some-fix': FixStatus.SKIPPED };

// The summary of the first `logger.log` call, without colors.
const logged = () => stripVTControlCharacters(vi.mocked(logger.log).mock.calls[0][0]);

describe('logMigrationSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const dryRunReport = (fail: { fixId: string; reason: string }[] = []) => ({
    apply: ['some-fix'],
    fail,
    skip: [{ fixId: 'opt-in-fix', reason: 'opt-in' }],
    manual: ['manual-fix'],
  });

  it('lists what a run would do instead of the statuses, and says nothing changed, in a dry run', () => {
    logMigrationSummary({
      fixResults,
      fixSummary: summary,
      dryRun: true,
      dryRunReport: dryRunReport(),
    });

    const output = logged();
    expect(output).toContain('Migrations that would succeed:\n\nsome-fix');
    expect(output).toContain('Migrations that would be skipped:\n\nopt-in-fix (opt-in)');
    expect(output).toContain('Migrations that would need manual changes:\n\nmanual-fix');
    expect(output).not.toContain('Skipped migrations:');
    expect(stripVTControlCharacters(vi.mocked(logger.step).mock.calls.flat().join('\n'))).toContain(
      'Dry run finished: no files were changed.'
    );
  });

  it('says that some automigrations would fail, as a failing run does, in a dry run', () => {
    logMigrationSummary({
      fixResults,
      fixSummary: summary,
      dryRun: true,
      dryRunReport: dryRunReport([{ fixId: 'failing-fix', reason: 'cannot migrate main' }]),
    });

    expect(vi.mocked(logger.error)).toHaveBeenCalledWith('Some automigrations would fail');
    expect(vi.mocked(logger.step)).not.toHaveBeenCalledWith(
      expect.stringContaining('Dry run finished')
    );
    expect(logged()).toContain('Migrations that would fail:\n\nfailing-fix:\ncannot migrate main');
  });

  it('lists skipped migrations outside a dry run', () => {
    logMigrationSummary({ fixResults, fixSummary: summary });

    expect(logged()).toContain('Skipped migrations:');
  });
});
