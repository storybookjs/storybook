import { describe, expect, it } from 'vitest';

import {
  AutomigrateAddonA11yTestError,
  ExecaCommandFailedError,
  NuxtModuleAddFailedError,
  PackageInstallDependencyConflictError,
  PackageInstallFailedError,
  PackageInstallMissingManifestError,
  PackageManagerBinaryNotFoundError,
  PlaywrightInstallFailedError,
  PnpmIgnoredBuildsError,
  PnpmNoTtyModulesDirError,
} from '../../server-errors.ts';
import {
  categorizeExecaError,
  extractPackageManagerErrorCode,
  formatExecaCommand,
  formatExecaFailureDetails,
} from './categorize-execa-error.ts';

describe('categorize-execa-error', () => {
  it('extracts npm error codes from logs', () => {
    expect(
      extractPackageManagerErrorCode(
        'npm error code ERESOLVE\nnpm error ERESOLVE unable to resolve'
      )
    ).toBe('ERESOLVE');
    expect(extractPackageManagerErrorCode('ERR_PNPM_NO_PKG_MANIFEST No package.json found')).toBe(
      'ERR_PNPM_NO_PKG_MANIFEST'
    );
  });

  it('builds a command string and fallback details for empty execa output', () => {
    expect(
      formatExecaCommand({
        command: 'npx',
        args: ['storybook@10.3.4', 'automigrate', 'addon-a11y-addon-test'],
      })
    ).toBe('npx storybook@10.3.4 automigrate addon-a11y-addon-test');

    expect(
      formatExecaFailureDetails({
        command: 'npx',
        args: ['storybook'],
        exitCode: 1,
        logs: '',
      })
    ).toBe('Process exited with code 1');
  });

  it('categorizes automigrate addon-a11y-addon-test failures', () => {
    const error = categorizeExecaError(
      { exitCode: 1, stderr: '', stdout: '', shortMessage: '' },
      {
        command: 'npx',
        args: ['storybook@10.3.4', 'automigrate', 'addon-a11y-addon-test', '--yes'],
      }
    );

    expect(error).toBeInstanceOf(AutomigrateAddonA11yTestError);
    expect(error.fullErrorCode).toBe('SB_CLI_AUTOMIGRATE_0003');
    expect(error.message).toContain('addon-a11y-addon-test automigration');
    expect(error.message).toContain('Process exited with code 1');
  });

  it('categorizes npm dependency conflicts during install', () => {
    const error = categorizeExecaError(
      {
        exitCode: 1,
        stderr: 'npm error code ERESOLVE\nnpm error ERESOLVE unable to resolve dependency tree',
      },
      { command: 'npm', args: ['install'] }
    );

    expect(error).toBeInstanceOf(PackageInstallDependencyConflictError);
    expect(error.fullErrorCode).toBe('SB_CLI_INIT_0011');
  });

  it('categorizes missing package.json during install', () => {
    const error = categorizeExecaError(
      {
        exitCode: 254,
        stderr:
          'npm error code ENOENT\nnpm error path /tmp/project/package.json\nnpm error enoent Could not read package.json',
      },
      { command: 'npm', args: ['install'] }
    );

    expect(error).toBeInstanceOf(PackageInstallMissingManifestError);
    expect(error.fullErrorCode).toBe('SB_CLI_INIT_0012');
  });

  it('categorizes pnpm ignored build scripts', () => {
    const error = categorizeExecaError(
      {
        exitCode: 1,
        stderr: 'ERR_PNPM_IGNORED_BUILDS Ignored build scripts: sharp@0.34.5',
      },
      { command: 'pnpm', args: ['install'] }
    );

    expect(error).toBeInstanceOf(PnpmIgnoredBuildsError);
    expect(error.fullErrorCode).toBe('SB_CLI_INIT_0013');
  });

  it('categorizes pnpm no-tty modules directory removal', () => {
    const error = categorizeExecaError(
      {
        exitCode: 1,
        stderr: 'ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY Aborted removal of modules directory',
      },
      { command: 'pnpm', args: ['install', '-w'] }
    );

    expect(error).toBeInstanceOf(PnpmNoTtyModulesDirError);
    expect(error.fullErrorCode).toBe('SB_CLI_INIT_0014');
  });

  it('categorizes missing package manager binaries', () => {
    const error = categorizeExecaError(
      {
        exitCode: 127,
        stderr: 'sh: pnpm: command not found',
      },
      { command: 'pnpm', args: ['install'] }
    );

    expect(error).toBeInstanceOf(PackageManagerBinaryNotFoundError);
    expect(error.fullErrorCode).toBe('SB_CLI_INIT_0015');
  });

  it('categorizes playwright install failures', () => {
    const error = categorizeExecaError(
      {
        exitCode: 1,
        stderr: 'Failed to install browsers\nError: spawn EPERM',
      },
      { command: 'npx', args: ['playwright', 'install', 'chromium', '--with-deps'] }
    );

    expect(error).toBeInstanceOf(PlaywrightInstallFailedError);
    expect(error.fullErrorCode).toBe('SB_CLI_INIT_0016');
  });

  it('categorizes nuxi module add failures', () => {
    const error = categorizeExecaError(
      {
        exitCode: 1,
        stderr: 'ERROR Could not load @nuxtjs/storybook. Is it installed?',
      },
      {
        command: 'pnpm',
        args: ['exec', 'nuxi', 'module', 'add', '@nuxtjs/storybook', '--skipInstall'],
      }
    );

    expect(error).toBeInstanceOf(NuxtModuleAddFailedError);
    expect(error.fullErrorCode).toBe('SB_CLI_INIT_0017');
  });

  it('falls back to generic package install errors', () => {
    const error = categorizeExecaError(
      {
        exitCode: 1,
        stderr: 'Some unexpected install failure',
      },
      { command: 'yarn', args: ['install'] }
    );

    expect(error).toBeInstanceOf(PackageInstallFailedError);
    expect(error.fullErrorCode).toBe('SB_CLI_INIT_0010');
  });

  it('falls back to generic execa errors for unknown commands', () => {
    const error = categorizeExecaError(
      {
        exitCode: 2,
        stderr: 'fatal: not a git repository',
      },
      { command: 'git', args: ['status'] }
    );

    expect(error).toBeInstanceOf(ExecaCommandFailedError);
    expect(error.fullErrorCode).toBe('SB_CLI_0003');
  });

  it('returns existing Storybook errors unchanged', () => {
    const existing = new ExecaCommandFailedError({
      command: 'git',
      args: ['status'],
      logs: 'already categorized',
    });

    expect(categorizeExecaError(existing, { command: 'git', args: ['status'] })).toBe(existing);
  });
});
