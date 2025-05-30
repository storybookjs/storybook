import { describe, expect, it, vi } from 'vitest';

import { type InstallationMetadata } from 'storybook/internal/common';
import { prompt as promptRaw } from 'storybook/internal/node-logger';

import { FixStatus } from '../types';
import { logMigrationSummary } from './logMigrationSummary';

vi.mock('picocolors');
vi.mock('storybook/internal/node-logger', () => ({
  prompt: {
    logBox: vi.fn(),
  },
}));

const prompt = vi.mocked(promptRaw);

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

  const installationMetadata: InstallationMetadata = {
    duplicatedDependencies: {
      '@storybook/addon-essentials': ['7.0.0', '7.1.0'],
    },
    dependencies: {},
    infoCommand: 'yarn why',
    dedupeCommand: 'yarn dedupe',
  };

  const logFile = '/path/to/log/file';

  it('renders a summary with a "no migrations" message if all migrations were unnecessary', () => {
    logMigrationSummary({
      fixResults: { 'foo-package': FixStatus.UNNECESSARY },
      fixSummary: {
        succeeded: [],
        failed: {},
        manual: [],
        skipped: [],
      },
      installationMetadata,
      logFile,
    });

    expect(prompt.logBox.mock.calls[0][1]).toEqual(
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
      installationMetadata,
      logFile,
    });

    expect(prompt.logBox.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        title: 'Migration check ran with failures',
      })
    );
  });

  it('renders a summary with successful, manual, failed, and skipped migrations', () => {
    logMigrationSummary({
      fixResults,
      fixSummary,
      installationMetadata: null,
      logFile,
    });

    expect(prompt.logBox.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        title: 'Migration check ran with failures',
      })
    );
    expect(normalizeLineBreaks(prompt.logBox.mock.calls[0][0])).toMatchInlineSnapshot(`
      "undefined:
      Some error message

      You can find the full logs in undefined









      ─────────────────────────────────────────────────

      If you'd like to run the migrations again, you can do so by running 'undefined'

      The automigrations try to migrate common patterns in your project, but might not contain everything needed to migrate to the latest version of Storybook.

      Please check the changelog and migration guide for manual migrations and more information: undefined
      And reach out on Discord if you need help: undefined"
    `);
  });

  it('renders a summary with a warning if there are duplicated dependencies outside the allow list', () => {
    logMigrationSummary({
      fixResults: {},
      fixSummary: { succeeded: [], failed: {}, manual: [], skipped: [] },
      installationMetadata,
      logFile,
    });

    expect(prompt.logBox.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        title: 'No migrations were applicable to your project',
      })
    );
    expect(normalizeLineBreaks(prompt.logBox.mock.calls[0][0])).toMatchInlineSnapshot(`
      "If you'd like to run the migrations again, you can do so by running 'undefined'

      The automigrations try to migrate common patterns in your project, but might not contain everything needed to migrate to the latest version of Storybook.

      Please check the changelog and migration guide for manual migrations and more information: undefined
      And reach out on Discord if you need help: undefined"
    `);
  });

  it('renders a basic summary if there are no duplicated dependencies or migrations', () => {
    logMigrationSummary({
      fixResults: {},
      fixSummary: { succeeded: [], failed: {}, manual: [], skipped: [] },
      installationMetadata: undefined,
      logFile,
    });

    expect(prompt.logBox.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        title: 'No migrations were applicable to your project',
      })
    );
    expect(normalizeLineBreaks(prompt.logBox.mock.calls[0][0])).toMatchInlineSnapshot(`
      "If you'd like to run the migrations again, you can do so by running 'undefined'

      The automigrations try to migrate common patterns in your project, but might not contain everything needed to migrate to the latest version of Storybook.

      Please check the changelog and migration guide for manual migrations and more information: undefined
      And reach out on Discord if you need help: undefined"
    `);
  });
});
