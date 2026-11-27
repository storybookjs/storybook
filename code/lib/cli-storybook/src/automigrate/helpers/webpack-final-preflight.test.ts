import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger, prompt } from 'storybook/internal/node-logger';

import { confirmWebpackFinalCarryover } from './webpack-final-preflight.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

// One test of the helper's return value covers both Webpack-to-Vite fixes: the runner reports a
// migration as skipped exactly when this resolves false, interactively declined or not.
describe('confirmWebpackFinalCarryover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logger.logBox).mockImplementation(() => {});
    vi.mocked(logger.log).mockImplementation(() => {});
    vi.mocked(logger.warn).mockImplementation(() => {});
    vi.mocked(logger.error).mockImplementation(() => {});
    vi.mocked(logger.info).mockImplementation(() => {});
    vi.mocked(logger.debug).mockImplementation(() => {});
    vi.mocked(logger.step).mockImplementation(() => {});
  });

  it('resolves true without a prompt or box when there is no webpackFinal hook', async () => {
    await expect(
      confirmWebpackFinalCarryover({
        hasWebpackFinal: false,
        yes: false,
        retryInstruction: 'retry',
      })
    ).resolves.toBe(true);

    expect(prompt.confirm).not.toHaveBeenCalled();
    expect(logger.logBox).not.toHaveBeenCalled();
  });

  it('resolves false when the user declines interactively, naming the retry instruction', async () => {
    vi.mocked(prompt.confirm).mockResolvedValue(false);

    await expect(
      confirmWebpackFinalCarryover({
        hasWebpackFinal: true,
        yes: false,
        retryInstruction: '`npx storybook automigrate some-fix`',
      })
    ).resolves.toBe(false);

    expect(prompt.confirm).toHaveBeenCalledOnce();
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('npx storybook automigrate some-fix')
    );
  });

  it('resolves false under --yes without prompting, and still warns about the hook', async () => {
    await expect(
      confirmWebpackFinalCarryover({ hasWebpackFinal: true, yes: true, retryInstruction: 'retry' })
    ).resolves.toBe(false);

    expect(prompt.confirm).not.toHaveBeenCalled();
    expect(logger.logBox).toHaveBeenCalledWith(expect.stringContaining('webpackFinal'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Migration cancelled'));
  });

  it('resolves true when the user confirms interactively, without a cancel message', async () => {
    vi.mocked(prompt.confirm).mockResolvedValue(true);

    await expect(
      confirmWebpackFinalCarryover({ hasWebpackFinal: true, yes: false, retryInstruction: 'retry' })
    ).resolves.toBe(true);

    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('Migration cancelled'));
  });
});
