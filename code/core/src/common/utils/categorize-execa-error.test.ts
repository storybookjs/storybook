import { describe, expect, it } from 'vitest';

import {
  AutomigrateAddonA11yTestError,
  ExecaCommandFailedError,
  PackageInstallDependencyConflictError,
} from '../../server-errors.ts';
import { categorizeExecaError } from './categorize-execa-error.ts';

describe('categorize-execa-error', () => {
  it('builds a message from exit code when execa output is empty', () => {
    const error = categorizeExecaError(
      { exitCode: 1, stderr: '', stdout: '', shortMessage: '' },
      {
        command: 'npx',
        args: ['storybook@10.3.4', 'automigrate', 'addon-a11y-addon-test', '--yes'],
      }
    );

    expect(error).toBeInstanceOf(AutomigrateAddonA11yTestError);
    expect(error.message).toContain('Process exited with code 1');
  });

  it('categorizes npm install dependency conflicts', () => {
    const error = categorizeExecaError(
      {
        exitCode: 1,
        stderr: 'npm error code ERESOLVE\nnpm error ERESOLVE unable to resolve dependency tree',
      },
      { command: 'npm', args: ['install'] }
    );

    expect(error).toBeInstanceOf(PackageInstallDependencyConflictError);
  });

  it('falls back to a generic execa error for unknown commands', () => {
    const error = categorizeExecaError(
      {
        exitCode: 2,
        stderr: 'fatal: not a git repository',
      },
      { command: 'git', args: ['status'] }
    );

    expect(error).toBeInstanceOf(ExecaCommandFailedError);
  });
});
