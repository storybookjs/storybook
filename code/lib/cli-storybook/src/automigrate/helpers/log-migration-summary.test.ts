import { stripVTControlCharacters } from 'node:util';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { effects } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { FixStatus, type FixSummary } from '../types.ts';
import { logMigrationSummary } from './logMigrationSummary.ts';

const summary = (overrides: Partial<FixSummary> = {}): FixSummary => ({
  succeeded: [],
  failed: {},
  manual: [],
  skipped: [],
  ...overrides,
});

const logged = () =>
  stripVTControlCharacters(
    [logger.log, logger.step, logger.warn, logger.error]
      .flatMap((method) => vi.mocked(method).mock.calls.flat())
      .join('\n')
  );

describe('logMigrationSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    effects.setDryRun(false);
  });

  it('lists skipped migrations outside a dry run', () => {
    logMigrationSummary({
      fixResults: { 'some-fix': FixStatus.SKIPPED },
      fixSummary: summary({ skipped: ['some-fix'] }),
    });

    expect(logged()).toContain('Skipped migrations:');
  });

  describe('in a dry run', () => {
    beforeEach(() => {
      effects.setDryRun(true);
    });

    it('words the summary of a run as what the run would do', () => {
      logMigrationSummary({
        fixResults: {
          applied: FixStatus.SUCCEEDED,
          manual: FixStatus.MANUAL_SUCCEEDED,
          declined: FixStatus.SKIPPED,
        },
        fixSummary: summary({ succeeded: ['applied'], manual: ['manual'], skipped: ['declined'] }),
      });

      expect(logged()).toContain('Dry run finished: no files were changed.');
      expect(logged()).toContain('Migrations that would succeed:\n\napplied');
      expect(logged()).toContain('Migrations that would need manual changes:\n\nmanual');
      expect(logged()).toContain('Migrations that would be skipped:\n\ndeclined');
    });

    it('says that some automigrations would fail, as a failing run does', () => {
      logMigrationSummary({
        fixResults: { failing: FixStatus.FAILED },
        fixSummary: summary({ failed: { failing: 'cannot migrate main' } }),
      });

      expect(logger.error).toHaveBeenCalledWith('Some automigrations would fail');
      expect(logged()).toContain('Migrations that would fail:\n\nfailing:\ncannot migrate main');
      expect(logged()).not.toContain('Dry run finished');
    });

    it('does not say that no migration applies when only a manual migration does', () => {
      logMigrationSummary({
        fixResults: { manual: FixStatus.MANUAL_SUCCEEDED },
        fixSummary: summary({ manual: ['manual'] }),
      });

      expect(logged()).not.toContain('No migrations were applicable');
      expect(logged()).toContain('Migrations that would need manual changes:\n\nmanual');
    });
  });
});
