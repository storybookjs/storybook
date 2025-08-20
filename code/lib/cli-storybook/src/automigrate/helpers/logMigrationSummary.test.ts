import { describe, expect, it, vi } from 'vitest';

import { logger as loggerRaw } from 'storybook/internal/node-logger';

import { FixStatus } from '../types';
import { logMigrationSummary } from './logMigrationSummary';

vi.mock('picocolors', () => ({
  default: {
    yellow: (str: string) => str,
    cyan: (str: string) => str,
    bold: (str: string) => str,
    green: (str: string) => str,
    red: (str: string) => str,
  },
}));

const loggerMock = vi.mocked(loggerRaw);

// necessary for windows and unix output to match in the assertions
const normalizeLineBreaks = (str: string) => str.replace(/\r\n|\r|\n/g, '\n').trim();

describe('logMigrationSummary', () => {
  const fixResults = {
    'foo-package': FixStatus.SUCCEEDED,
    'bar-package': FixStatus.MANUAL_SUCCEEDED,
    'baz-package': FixStatus.CHECK_FAILED,
    'qux-package': FixStatus.FAILED,
    'quux-package': FixStatus.UNNECESSARY,
  };

  const fixSummary = {
    succeeded: ['foo-package'],
    failed: { 'baz-package': 'Some error message' },
    manual: ['bar-package'],
    skipped: ['quux-package'],
  };

  it('renders a summary with a "no migrations" message if all migrations were unnecessary', () => {
    logMigrationSummary({
      fixResults: { 'foo-package': FixStatus.UNNECESSARY },
      fixSummary: {
        succeeded: [],
        failed: {},
        manual: [],
        skipped: [],
      },
    });

    expect(loggerMock.logBox.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        title: 'No migrations were applicable to your project',
      })
    );
  });

  it('renders a summary with a "check failed" message if at least one migration completely failed', () => {
    logMigrationSummary({
      fixResults: {
        'foo-package': FixStatus.SUCCEEDED,
        'bar-package': FixStatus.MANUAL_SUCCEEDED,
        'baz-package': FixStatus.FAILED,
      },
      fixSummary: {
        succeeded: [],
        failed: { 'baz-package': 'Some error message' },
        manual: ['bar-package'],
        skipped: [],
      },
    });

    expect(loggerMock.logBox.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        title: 'Migration check ran with failures',
      })
    );
  });

  it('renders a summary with successful, manual, failed, and skipped migrations', () => {
    logMigrationSummary({
      fixResults,
      fixSummary,
    });

    expect(loggerMock.logBox.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        title: 'Migration check ran with failures',
      })
    );
    expect(normalizeLineBreaks(loggerMock.logBox.mock.calls[0][0])).toMatchInlineSnapshot(`
      "Successful migrations:

      foo-package

      Failed migrations:

      baz-package:
      Some error message

      Manual migrations:

      bar-package

      Skipped migrations:

      quux-package

      ─────────────────────────────────────────────────

      If you'd like to run the migrations again, you can do so by running 'npx storybook automigrate'

      The automigrations try to migrate common patterns in your project, but might not contain everything needed to migrate to the latest version of Storybook.

      Please check the changelog and migration guide for manual migrations and more information: https://storybook.js.org/docs/releases/migration-guide?ref=upgrade
      And reach out on Discord if you need help: https://discord.gg/storybook"
    `);
  });

  it('renders a summary with a warning if there are duplicated dependencies outside the allow list', () => {
    logMigrationSummary({
      fixResults: {},
      fixSummary: { succeeded: [], failed: {}, manual: [], skipped: [] },
    });

    expect(loggerMock.logBox.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        title: 'No migrations were applicable to your project',
      })
    );
    expect(normalizeLineBreaks(loggerMock.logBox.mock.calls[0][0])).toMatchInlineSnapshot(`
      "If you'd like to run the migrations again, you can do so by running 'npx storybook automigrate'

      The automigrations try to migrate common patterns in your project, but might not contain everything needed to migrate to the latest version of Storybook.

      Please check the changelog and migration guide for manual migrations and more information: https://storybook.js.org/docs/releases/migration-guide?ref=upgrade
      And reach out on Discord if you need help: https://discord.gg/storybook"
    `);
  });

  it('renders a basic summary if there are no duplicated dependencies or migrations', () => {
    logMigrationSummary({
      fixResults: {},
      fixSummary: { succeeded: [], failed: {}, manual: [], skipped: [] },
    });

    expect(loggerMock.logBox.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        title: 'No migrations were applicable to your project',
      })
    );
    expect(normalizeLineBreaks(loggerMock.logBox.mock.calls[0][0])).toMatchInlineSnapshot(`
      "If you'd like to run the migrations again, you can do so by running 'npx storybook automigrate'

      The automigrations try to migrate common patterns in your project, but might not contain everything needed to migrate to the latest version of Storybook.

      Please check the changelog and migration guide for manual migrations and more information: https://storybook.js.org/docs/releases/migration-guide?ref=upgrade
      And reach out on Discord if you need help: https://discord.gg/storybook"
    `);
  });
});
