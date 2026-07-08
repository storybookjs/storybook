import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import type { FixSummary } from '../types.ts';
import { FixStatus } from '../types.ts';
import { logMigrationSummary } from './logMigrationSummary.ts';

vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
  },
  CLI_COLORS: {
    success: vi.fn((text: string) => text),
    error: vi.fn((text: string) => text),
    warning: vi.fn((text: string) => text),
    info: vi.fn((text: string) => text),
    debug: vi.fn((text: string) => text),
    cta: vi.fn((text: string) => text),
    dimmed: vi.fn((text: string) => text),
  },
}));

describe('logMigrationSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not mention missed transformations when there are none', () => {
    const fixSummary: FixSummary = {
      succeeded: ['my-fix'],
      failed: {},
      manual: [],
      skipped: [],
    };

    logMigrationSummary({
      fixResults: { 'my-fix': FixStatus.SUCCEEDED },
      fixSummary,
    });

    const loggedMessage = vi.mocked(logger.log).mock.calls[0][0];
    expect(loggedMessage).not.toContain('Possible missed transformations');
  });

  it('does not mention missed transformations when the list is empty', () => {
    const fixSummary: FixSummary = {
      succeeded: ['my-fix'],
      failed: {},
      manual: [],
      skipped: [],
      missedTransformations: [],
    };

    logMigrationSummary({
      fixResults: { 'my-fix': FixStatus.SUCCEEDED },
      fixSummary,
    });

    const loggedMessage = vi.mocked(logger.log).mock.calls[0][0];
    expect(loggedMessage).not.toContain('Possible missed transformations');
  });

  it('mentions missed transformations with the fix id and label when matches exist', () => {
    const fixSummary: FixSummary = {
      succeeded: ['my-fix'],
      failed: {},
      manual: [],
      skipped: [],
      missedTransformations: [
        {
          file: '/project/src/some-file.ts',
          fixId: 'my-fix',
          label: '@storybook/old-package',
        },
      ],
    };

    logMigrationSummary({
      fixResults: { 'my-fix': FixStatus.SUCCEEDED },
      fixSummary,
    });

    const loggedMessage = vi.mocked(logger.log).mock.calls[0][0];
    expect(loggedMessage).toContain('Possible missed transformations');
    expect(loggedMessage).toContain('my-fix');
    expect(loggedMessage).toContain('@storybook/old-package');
  });
});
