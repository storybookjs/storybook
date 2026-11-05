import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';

import { listUnpublishedPackages, waitForPackagesToBePublished } from '../npm-registry.ts';
import { publishAllPackages, publishCommand } from '../publish.ts';

vi.mock('execa', { spy: true });
vi.mock('../npm-registry.ts', { spy: true });

beforeEach(() => {
  vi.mocked(execaCommand).mockReset();
  vi.mocked(listUnpublishedPackages).mockReset();
  vi.mocked(waitForPackagesToBePublished).mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('publishCommand', () => {
  it('selects each package by exact name and skips git checks', () => {
    expect(publishCommand('next', ['storybook', '@storybook/react'])).toBe(
      'pnpm --recursive --filter=storybook --filter=@storybook/react publish --tag next --no-git-checks'
    );
  });
});

describe('publishAllPackages', () => {
  const options = {
    tag: 'next',
    currentVersion: '10.6.0-alpha.6',
    packageNames: ['storybook', '@storybook/react'],
  };

  it('succeeds when pnpm publish succeeds', async () => {
    vi.mocked(execaCommand).mockResolvedValue({} as never);

    await publishAllPackages(options);

    expect(execaCommand).toHaveBeenCalledTimes(1);
    expect(execaCommand).toHaveBeenCalledWith(
      publishCommand('next', ['storybook', '@storybook/react']),
      expect.objectContaining({ env: { npm_config_provenance: 'true' } })
    );
    expect(listUnpublishedPackages).not.toHaveBeenCalled();
  });

  it('treats a pnpm failure as success when every package is already on npm', async () => {
    vi.mocked(execaCommand).mockRejectedValue(new Error('pnpm publish exited 1'));
    vi.mocked(listUnpublishedPackages).mockResolvedValue([]);

    await publishAllPackages(options);

    expect(waitForPackagesToBePublished).not.toHaveBeenCalled();
    expect(execaCommand).toHaveBeenCalledTimes(1);
  });

  it('waits for staged packages instead of immediately retrying publish', async () => {
    const staged = Object.assign(new Error('pnpm publish exited 1'), {
      stderr:
        'npm error 409 Conflict - PUT https://registry.npmjs.org/storybook - Cannot publish over previously staged version',
    });
    vi.mocked(execaCommand).mockRejectedValue(staged);
    vi.mocked(listUnpublishedPackages).mockResolvedValue(['storybook']);
    vi.mocked(waitForPackagesToBePublished).mockResolvedValue([]);

    await publishAllPackages(options);

    expect(waitForPackagesToBePublished).toHaveBeenCalledWith(
      expect.objectContaining({
        packageNames: ['storybook'],
        version: '10.6.0-alpha.6',
      })
    );
    expect(execaCommand).toHaveBeenCalledTimes(1);
  });

  it('fails when staged packages never become visible', async () => {
    const staged = Object.assign(new Error('pnpm publish exited 1'), {
      stderr:
        'npm error 409 Conflict - PUT https://registry.npmjs.org/storybook - Cannot publish over previously staged version',
    });
    vi.mocked(execaCommand).mockRejectedValue(staged);
    vi.mocked(listUnpublishedPackages).mockResolvedValue(['storybook']);
    vi.mocked(waitForPackagesToBePublished).mockResolvedValue(['storybook']);

    await expect(publishAllPackages(options)).rejects.toThrow(
      'Failed to publish version 10.6.0-alpha.6. Still missing after staging wait: storybook'
    );
    expect(execaCommand).toHaveBeenCalledTimes(1);
  });

  it('retries packages pnpm stopped before right away, without waiting for the registry', async () => {
    const stoppedEarly = Object.assign(new Error('pnpm publish exited 1'), {
      stdout: '+ @storybook/react@10.6.0-alpha.6',
    });
    vi.mocked(execaCommand)
      .mockRejectedValueOnce(stoppedEarly)
      .mockResolvedValueOnce({} as never);
    vi.mocked(listUnpublishedPackages).mockResolvedValue(['storybook', '@storybook/react']);

    await publishAllPackages(options);

    expect(waitForPackagesToBePublished).not.toHaveBeenCalled();
    expect(execaCommand).toHaveBeenCalledTimes(2);
    expect(vi.mocked(execaCommand).mock.calls[0][0]).toBe(
      publishCommand('next', ['storybook', '@storybook/react'])
    );
    expect(vi.mocked(execaCommand).mock.calls[1][0]).toBe(publishCommand('next', ['storybook']));
  });

  it('does not retry PUT for packages npm already accepted with a staged 409', async () => {
    const staged = Object.assign(new Error('pnpm publish exited 1'), {
      stderr: [
        'npm error code E409',
        'npm error 409 Conflict - PUT https://registry.npmjs.org/storybook - Cannot publish over previously staged version',
      ].join('\n'),
    });
    vi.mocked(execaCommand)
      .mockRejectedValueOnce(staged)
      .mockResolvedValueOnce({} as never);
    vi.mocked(listUnpublishedPackages).mockResolvedValue(['storybook', '@storybook/react']);

    await publishAllPackages(options);

    expect(vi.mocked(execaCommand).mock.calls[1][0]).toBe(
      publishCommand('next', ['@storybook/react'])
    );
    expect(vi.mocked(execaCommand).mock.calls[1][0]).not.toContain('--filter=storybook');
  });

  it('fails with the missing package list after retries are exhausted', async () => {
    vi.mocked(execaCommand).mockRejectedValue(new Error('pnpm publish exited 1'));
    vi.mocked(listUnpublishedPackages).mockResolvedValue(['storybook']);

    await expect(publishAllPackages(options)).rejects.toThrow(
      'Failed to publish version 10.6.0-alpha.6. Still missing: storybook'
    );
    expect(execaCommand).toHaveBeenCalledTimes(3);
    expect(waitForPackagesToBePublished).not.toHaveBeenCalled();
  });
});
