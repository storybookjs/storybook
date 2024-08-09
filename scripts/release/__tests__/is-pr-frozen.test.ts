/* eslint-disable no-underscore-dangle */
import { describe, expect, it, vi } from 'vitest';

import * as fsExtraImp from 'fs-extra';
import path from 'path';
import * as simpleGitImp from 'simple-git';

import type * as MockedFSExtra from '../../../code/__mocks__/fs-extra';
import type * as MockedSimpleGit from '../../__mocks__/simple-git';
import { CODE_DIRECTORY } from '../../utils/constants';
import { run as isPrFrozen } from '../is-pr-frozen';
import type { PullRequestInfo } from '../utils/get-github-info';
import { getPullInfoFromCommit } from '../utils/get-github-info';

vi.mock('../utils/get-github-info');
vi.mock('simple-git');
vi.mock('fs-extra', async () => import('../../../code/__mocks__/fs-extra'));
const fsExtra = fsExtraImp as unknown as typeof MockedFSExtra;
const simpleGit = simpleGitImp as unknown as typeof MockedSimpleGit;

const CODE_PACKAGE_JSON_PATH = path.join(CODE_DIRECTORY, 'package.json');

fsExtra.__setMockFiles({
  [CODE_PACKAGE_JSON_PATH]: JSON.stringify({ version: '1.0.0' }),
});

describe('isPrFrozen', () => {
  it('should return true when PR is frozen', async () => {
    vi.mocked(getPullInfoFromCommit).mockResolvedValue({
      labels: ['freeze'],
      state: 'OPEN',
    } as PullRequestInfo);
    await expect(isPrFrozen({ patch: false })).resolves.toBe(true);
  });

  it('should return false when PR is not frozen', async () => {
    vi.mocked(getPullInfoFromCommit).mockResolvedValue({
      labels: [],
      state: 'OPEN',
    } as PullRequestInfo);
    await expect(isPrFrozen({ patch: false })).resolves.toBe(false);
  });

  it('should return false when PR is closed', async () => {
    vi.mocked(getPullInfoFromCommit).mockResolvedValue({
      labels: ['freeze'],
      state: 'CLOSED',
    } as PullRequestInfo);
    await expect(isPrFrozen({ patch: false })).resolves.toBe(false);
  });

  it('should look for patch PRs when patch is true', async () => {
    vi.mocked(getPullInfoFromCommit).mockResolvedValue({
      labels: [],
    } as PullRequestInfo);
    await isPrFrozen({ patch: true });

    expect(simpleGit.__fetch).toHaveBeenCalledWith('origin', 'version-patch-from-1.0.0', {
      '--depth': 1,
    });
  });

  it('should look for prerelease PRs when patch is false', async () => {
    vi.mocked(getPullInfoFromCommit).mockResolvedValue({
      labels: [],
    } as PullRequestInfo);
    await isPrFrozen({ patch: false });

    expect(simpleGit.__fetch).toHaveBeenCalledWith('origin', 'version-non-patch-from-1.0.0', {
      '--depth': 1,
    });
  });
});
