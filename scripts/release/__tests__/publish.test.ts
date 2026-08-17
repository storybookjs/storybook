import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { execaCommand } from 'execa';

import { listUnpublishedPackages, waitForPackagesToBePublished } from '../npm-registry.ts';
import { publishAllPackages } from '../publish.ts';

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
  });

  it('fails with the missing package list after retries are exhausted', async () => {
    vi.mocked(execaCommand).mockRejectedValue(new Error('foreach exited 1'));
    vi.mocked(listUnpublishedPackages).mockResolvedValue(['storybook']);
    vi.mocked(waitForPackagesToBePublished).mockResolvedValue(['storybook']);

    await expect(publishAllPackages(options)).rejects.toThrow(
      'Failed to publish version 10.6.0-alpha.6. Still missing: storybook'
    );
    expect(execaCommand).toHaveBeenCalledTimes(5);
  });
});
