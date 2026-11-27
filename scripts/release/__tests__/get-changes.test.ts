import { beforeEach, expect, it, vi } from 'vitest';

import { getChanges } from '../utils/get-changes.ts';
import { getPullInfoFromCommit, getPullInfoFromPullRequest } from '../utils/get-github-info.ts';
import { git } from '../utils/git-client.ts';
import { getUnpickedPRs } from '../utils/github-client.ts';

vi.mock('../utils/get-github-info.ts', { spy: true });
vi.mock('../utils/github-client.ts', { spy: true });
vi.mock('../utils/git-client.ts', { spy: true });

const sharedMergeCommit = '2cb1348375afffff3a2aacc5f0100d2021cc9acc';

const pullInfo = (pull: number, labels: string[]) => ({
  user: 'ndelangen',
  id: null,
  title: `PR ${pull}`,
  state: 'MERGED',
  commit: sharedMergeCommit,
  pull,
  labels,
  links: { commit: sharedMergeCommit, pull: `#${pull}`, user: '@ndelangen' },
});

beforeEach(() => {
  vi.mocked(git.getRemotes).mockResolvedValue([
    {
      name: 'origin',
      refs: {
        fetch: 'https://github.com/storybookjs/storybook.git',
        push: 'https://github.com/storybookjs/storybook.git',
      },
    },
  ]);
  vi.mocked(getUnpickedPRs).mockResolvedValue([
    {
      number: 37678,
      id: 'PR_patch',
      branch: 'next',
      title: 'PR 37678',
      mergeCommit: sharedMergeCommit,
    },
  ]);
  // GitHub associates the merge commit with the PR that contained the patch PR's commits
  vi.mocked(getPullInfoFromCommit).mockResolvedValue(pullInfo(37655, ['maintenance']));
  vi.mocked(getPullInfoFromPullRequest).mockResolvedValue(pullInfo(37678, ['patch:yes']));
});

it('reports an unpicked patch PR whose merge commit also belongs to another PR', async () => {
  const { changes } = await getChanges({ version: '10.6.9', unpickedPatches: true });

  expect(changes).toEqual([expect.objectContaining({ pull: 37678, commit: sharedMergeCommit })]);
});
