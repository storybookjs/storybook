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

  it('lists skipped migrations', () => {
    logMigrationSummary({ fixResults, fixSummary: summary });

    expect(vi.mocked(logger.log).mock.calls[0][0]).toContain('Skipped migrations:');
  });
});
