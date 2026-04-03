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
