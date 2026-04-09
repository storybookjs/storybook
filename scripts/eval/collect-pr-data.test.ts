import { beforeEach, describe, expect, it, vi } from 'vitest';

const execFileSyncMock = vi.fn();

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
  execFileSync: execFileSyncMock,
}));

describe('listEvalPullRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses GitHub CLI JSON output on success', async () => {
    execFileSyncMock.mockReturnValueOnce(
      JSON.stringify([
        {
          number: 123,
          title: '[eval] mealdrop trial-123',
        },
      ])
    );

    const { listEvalPullRequests } = await import('./collect-pr-data.ts');

    await expect(listEvalPullRequests('storybook-tmp/mealdrop', 10)).resolves.toMatchObject([
      {
        number: 123,
        title: '[eval] mealdrop trial-123',
      },
    ]);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['pr', 'list', '--state', 'all']),
      expect.any(Object)
    );
  });

  it('passes through an explicit PR state override', async () => {
    execFileSyncMock.mockReturnValueOnce('[]');

    const { listEvalPullRequests } = await import('./collect-pr-data.ts');

    await expect(listEvalPullRequests('storybook-tmp/mealdrop', 10, 'open')).resolves.toEqual([]);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['pr', 'list', '--state', 'open']),
      expect.any(Object)
    );
  });

  it('throws a clear error when GitHub CLI cannot list PRs', async () => {
    execFileSyncMock.mockImplementationOnce(() => {
      throw Object.assign(new Error('Command failed: gh'), {
        status: 1,
        stderr: Buffer.from('authentication required\n'),
      });
    });

    const { listEvalPullRequests } = await import('./collect-pr-data.ts');

    await expect(listEvalPullRequests('storybook-tmp/mealdrop', 10)).rejects.toThrow(
      /Failed to list eval PRs for storybook-tmp\/mealdrop: .*stderr: authentication required/
    );
  });
});

describe('parseCliArgs', () => {
  it('defaults PR state to all', async () => {
    const { parseCliArgs } = await import('./collect-pr-data.ts');

    expect(parseCliArgs([])).toMatchObject({
      prState: 'all',
    });
  });

  it('defaults skipImageFetch to false', async () => {
    const { parseCliArgs } = await import('./collect-pr-data.ts');

    expect(parseCliArgs([])).toMatchObject({
      skipImageFetch: false,
    });
  });

  it('parses --skip-image-fetch', async () => {
    const { parseCliArgs } = await import('./collect-pr-data.ts');

    expect(parseCliArgs(['--skip-image-fetch'])).toMatchObject({
      skipImageFetch: true,
    });
  });

  it('parses --state open', async () => {
    const { parseCliArgs } = await import('./collect-pr-data.ts');

    expect(parseCliArgs(['--state', 'open'])).toMatchObject({
      prState: 'open',
    });
  });
});
