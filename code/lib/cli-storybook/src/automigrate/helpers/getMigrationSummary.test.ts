import { describe, expect, it, vi } from 'vitest';

import type { InstallationMetadata } from 'storybook/internal/common';

import { FixStatus } from '../types';
import { getMigrationSummary } from './getMigrationSummary';

vi.mock('boxen', () => ({
  default: vi.fn((str, { title = '' }) => `${title}\n\n${str.replace(/\x1b\[[0-9;]*[mG]/g, '')}`),
}));

describe('getMigrationSummary', () => {
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
      '@storybook/instrumenter': ['6.0.0', '7.1.0'],
      'storybook/internal/common': ['6.0.0', '7.1.0'],
      '@storybook/addon-essentials': ['7.0.0', '7.1.0'],
    },
    dependencies: {},
    infoCommand: 'yarn why',
    dedupeCommand: 'yarn dedupe',
  };

  const logFile = '/path/to/log/file';

  it('renders a summary with a "no migrations" message if all migrations were unnecessary', () => {
    const summary = getMigrationSummary({
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

    expect(summary).toContain('No migrations were applicable to your project');
  });

  it('renders a summary with a "check failed" message if at least one migration completely failed', () => {
    const summary = getMigrationSummary({
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

    expect(summary).toContain('Migration check ran with failures');
  });

  it('renders a summary with successful, manual, failed, and skipped migrations', () => {
    const summary = getMigrationSummary({
      fixResults,
      fixSummary,
      installationMetadata: null,
      logFile,
    });

    expect(summary).toMatchInlineSnapshot(`
      "Migration check ran with failures

      Successful migrations:

      foo-package

      Failed migrations:

      baz-package:
      Some error message

      You can find the full logs in /path/to/log/file

      Manual migrations:

      bar-package

      Skipped migrations:

      quux-package

      ─────────────────────────────────────────────────

      If you'd like to run the migrations again, you can do so by running 'npx storybook automigrate'

      The automigrations try to migrate common patterns in your project, but might not contain everything needed to migrate to the latest version of Storybook.

      Please check the changelog and migration guide for manual migrations and more information: https://storybook.js.org/docs/8.0/migration-guide
      And reach out on Discord if you need help: https://discord.gg/storybook"
    `);
  });

  it('renders a summary with a warning if there are duplicated dependencies outside the allow list', () => {
    const summary = getMigrationSummary({
      fixResults: {},
      fixSummary: { succeeded: [], failed: {}, manual: [], skipped: [] },
      installationMetadata,
      logFile,
    });

    expect(summary).toMatchInlineSnapshot(`
      "No migrations were applicable to your project

      If you'd like to run the migrations again, you can do so by running 'npx storybook automigrate'

      The automigrations try to migrate common patterns in your project, but might not contain everything needed to migrate to the latest version of Storybook.

      Please check the changelog and migration guide for manual migrations and more information: https://storybook.js.org/docs/8.0/migration-guide
      And reach out on Discord if you need help: https://discord.gg/storybook"
    `);
  });

  it('renders a basic summary if there are no duplicated dependencies or migrations', () => {
    const summary = getMigrationSummary({
      fixResults: {},
      fixSummary: { succeeded: [], failed: {}, manual: [], skipped: [] },
      installationMetadata: undefined,
      logFile,
    });

    expect(summary).toMatchInlineSnapshot(`
      "No migrations were applicable to your project

      If you'd like to run the migrations again, you can do so by running 'npx storybook automigrate'

      The automigrations try to migrate common patterns in your project, but might not contain everything needed to migrate to the latest version of Storybook.

      Please check the changelog and migration guide for manual migrations and more information: https://storybook.js.org/docs/8.0/migration-guide
      And reach out on Discord if you need help: https://discord.gg/storybook"
    `);
  });
});
