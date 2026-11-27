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

describe('publishAllPackages', () => {
  const options = {
    tag: 'next',
    currentVersion: '10.6.0-alpha.6',
    packageNames: ['storybook', '@storybook/react'],
  };

  it('succeeds when Yarn publish succeeds', async () => {
    vi.mocked(execaCommand).mockResolvedValue({} as never);

    await publishAllPackages(options);

    expect(execaCommand).toHaveBeenCalledTimes(1);
    expect(execaCommand).toHaveBeenCalledWith(
      publishCommand('next', ['storybook', '@storybook/react']),
      expect.any(Object)
    );
    expect(listUnpublishedPackages).not.toHaveBeenCalled();
  });

  it('treats a Yarn failure as success when every package is already on npm', async () => {
    vi.mocked(execaCommand).mockRejectedValue(new Error('foreach exited 1'));
    vi.mocked(listUnpublishedPackages).mockResolvedValue([]);

    await publishAllPackages(options);

    expect(waitForPackagesToBePublished).not.toHaveBeenCalled();
    expect(execaCommand).toHaveBeenCalledTimes(1);
  });

  it('waits for staged packages instead of immediately retrying publish', async () => {
    vi.mocked(execaCommand).mockRejectedValue(new Error('foreach exited 1'));
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

  it('retries publish only for packages that are still missing after waiting', async () => {
    vi.mocked(execaCommand)
      .mockRejectedValueOnce(new Error('foreach exited 1'))
      .mockResolvedValueOnce({} as never);
    vi.mocked(listUnpublishedPackages).mockResolvedValue(['storybook']);
    vi.mocked(waitForPackagesToBePublished).mockResolvedValue(['storybook']);

    await publishAllPackages(options);

    expect(execaCommand).toHaveBeenCalledTimes(2);
    expect(vi.mocked(execaCommand).mock.calls[0][0]).toBe(
      publishCommand('next', ['storybook', '@storybook/react'])
    );
    expect(vi.mocked(execaCommand).mock.calls[1][0]).toBe(publishCommand('next', ['storybook']));
    expect(vi.mocked(execaCommand).mock.calls[1][0]).not.toContain('--include=@storybook/react');
  });

  it('does not retry PUT for packages npm already accepted with a staged 409', async () => {
    const staged = Object.assign(new Error('foreach exited 1'), {
      stderr: [
        '[storybook]: YN0035: Cannot publish over previously staged version',
        '[@storybook/react]: YN0033: Publish failed',
      ].join('\n'),
    });
    vi.mocked(execaCommand)
      .mockRejectedValueOnce(staged)
      .mockResolvedValueOnce({} as never);
    vi.mocked(listUnpublishedPackages).mockResolvedValue(['storybook', '@storybook/react']);
    vi.mocked(waitForPackagesToBePublished).mockResolvedValue(['storybook', '@storybook/react']);

    await publishAllPackages(options);

    expect(vi.mocked(execaCommand).mock.calls[1][0]).toBe(
      publishCommand('next', ['@storybook/react'])
    );
    expect(vi.mocked(execaCommand).mock.calls[1][0]).not.toContain('--include=storybook');
  });

  it('fails with the missing package list after retries are exhausted', async () => {
    vi.mocked(execaCommand).mockRejectedValue(new Error('foreach exited 1'));
    vi.mocked(listUnpublishedPackages).mockResolvedValue(['storybook']);
    vi.mocked(waitForPackagesToBePublished).mockResolvedValue(['storybook']);

    await expect(publishAllPackages(options)).rejects.toThrow(
      'Failed to publish version 10.6.0-alpha.6. Still missing: storybook'
    );
    expect(execaCommand).toHaveBeenCalledTimes(3);
  });
});
