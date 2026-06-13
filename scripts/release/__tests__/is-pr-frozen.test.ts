import * as fspImp from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import * as simpleGitImp from 'simple-git';

import type * as MockedFSPExtra from '../../../code/__mocks__/fs/promises.ts';
import type * as MockedSimpleGit from '../../__mocks__/simple-git.ts';
import {
  getLatestMergedPrsFromCommits,
  type AssociatedPr,
  type CommitWithPr,
} from '../../utils/github/associated-prs.ts';
import { CODE_DIRECTORY } from '../../utils/constants.ts';
import { run as isPrFrozen } from '../is-pr-frozen.ts';

vi.mock('../../utils/github/associated-prs');
vi.mock('simple-git');
vi.mock('node:fs/promises', async () => import('../../../code/__mocks__/fs/promises.ts'));
const fsp = fspImp as unknown as typeof MockedFSPExtra;
const simpleGit = simpleGitImp as unknown as typeof MockedSimpleGit;

const CODE_PACKAGE_JSON_PATH = join(CODE_DIRECTORY, 'package.json');

fsp.__setMockFiles({
  [CODE_PACKAGE_JSON_PATH]: JSON.stringify({ version: '1.0.0' }),
});

const commitWithPr = (pr: Partial<AssociatedPr> | null): CommitWithPr => ({
  commit: 'sha',
  commitUrl: 'u',
  commitAuthor: null,
  pr:
    pr === null
      ? null
      : {
          id: 'PR_1',
          number: 1,
          title: 't',
          state: 'OPEN',
          url: 'u',
          mergedAt: null,
          author: null,
          labels: [],
          ...pr,
        },
});

describe('isPrFrozen', () => {
  it('should return true when PR is frozen', async () => {
    vi.mocked(getLatestMergedPrsFromCommits).mockResolvedValue([
      commitWithPr({ labels: ['freeze'], state: 'OPEN' }),
    ]);
    await expect(isPrFrozen({ patch: false })).resolves.toBe(true);
  });

  it('should return false when PR is not frozen', async () => {
    vi.mocked(getLatestMergedPrsFromCommits).mockResolvedValue([
      commitWithPr({ labels: [], state: 'OPEN' }),
    ]);
    await expect(isPrFrozen({ patch: false })).resolves.toBe(false);
  });

  it('should return false when PR is closed', async () => {
    vi.mocked(getLatestMergedPrsFromCommits).mockResolvedValue([
      commitWithPr({ labels: ['freeze'], state: 'CLOSED' }),
    ]);
    await expect(isPrFrozen({ patch: false })).resolves.toBe(false);
  });

  it('should look for patch PRs when patch is true', async () => {
    vi.mocked(getLatestMergedPrsFromCommits).mockResolvedValue([commitWithPr({ labels: [] })]);
    await isPrFrozen({ patch: true });

    expect(simpleGit.__fetch).toHaveBeenCalledWith('origin', 'version-patch-from-1.0.0', {
      '--depth': 1,
    });
  });

  it('should look for prerelease PRs when patch is false', async () => {
    vi.mocked(getLatestMergedPrsFromCommits).mockResolvedValue([commitWithPr({ labels: [] })]);
    await isPrFrozen({ patch: false });

    expect(simpleGit.__fetch).toHaveBeenCalledWith('origin', 'version-non-patch-from-1.0.0', {
      '--depth': 1,
    });
  });
});
