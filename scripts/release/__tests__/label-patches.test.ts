import { beforeEach, expect, it, vi } from 'vitest';

import ansiRegex from 'ansi-regex';
import type { LogResult } from 'simple-git';

import { run } from '../label-patches';
import * as githubInfo_ from '../utils/get-github-info';
import * as gitClient_ from '../utils/git-client';
import * as github_ from '../utils/github-client';

vi.mock('uuid');
vi.mock('../utils/get-github-info');
vi.mock('../utils/github-client');
vi.mock('../utils/git-client');

const gitClient = vi.mocked(gitClient_, true);
const github = vi.mocked(github_, true);
const githubInfo = vi.mocked(githubInfo_, true);

const remoteMock = [
  {
    name: 'origin',
    refs: {
      fetch: 'https://github.com/storybookjs/storybook.git',
      push: 'https://github.com/storybookjs/storybook.git',
    },
  },
];

const gitLogMock: LogResult = {
  all: [
    {
      hash: 'some-hash',
      date: '2023-06-07T09:45:11+02:00',
      message: 'Something else',
      refs: 'HEAD -> main',
      body: '',
      author_name: 'Jeppe Reinhold',
      author_email: 'jeppe@chromatic.com',
    },
    {
      hash: 'b75879c4d3d72f7830e9c5fca9f75a303ddb194d',
      date: '2023-06-07T09:45:11+02:00',
      message: 'Merge pull request #55 from storybookjs/fixes',
      refs: 'HEAD -> main',
      body:
        'Legal: Fix license\n' +
        '(cherry picked from commit 930b47f011f750c44a1782267d698ccdd3c04da3)\n',
      author_name: 'Jeppe Reinhold',
      author_email: 'jeppe@chromatic.com',
    },
  ],
  latest: null!,
  total: 1,
};

const pullInfoMock = {
  user: 'JReinhold',
  id: 'pr_id',
  pull: 55,
  commit: '930b47f011f750c44a1782267d698ccdd3c04da3',
  title: 'Legal: Fix license',
  labels: ['documentation', 'patch:yes', 'patch:done'],
  state: 'MERGED',
  links: {
    commit:
      '[`930b47f011f750c44a1782267d698ccdd3c04da3`](https://github.com/storybookjs/storybook/commit/930b47f011f750c44a1782267d698ccdd3c04da3)',
    pull: '[#55](https://github.com/storybookjs/storybook/pull/55)',
    user: '[@JReinhold](https://github.com/JReinhold)',
  },
};

beforeEach(() => {
  gitClient.getLatestTag.mockResolvedValue('v7.2.1');
  gitClient.git.log.mockResolvedValue(gitLogMock);
  gitClient.git.getRemotes.mockResolvedValue(remoteMock);
  githubInfo.getPullInfoFromCommit.mockResolvedValue(pullInfoMock);
  github.getLabelIds.mockResolvedValue({ 'patch:done': 'pick-id' });
  github.getUnpickedPRs.mockResolvedValue([
    {
      number: 42,
      id: 'some-id',
      branch: 'some-patching-branch',
      title: 'Fix: Patch this PR',
      mergeCommit: 'abcd1234',
    },
    {
      number: 44,
      id: 'other-id',
      branch: 'other-patching-branch',
      title: 'Fix: Also patch this PR',
      mergeCommit: 'abcd1234',
    },
  ]);
});

it('should fail early when no GH_TOKEN is set', async () => {
  delete process.env.GH_TOKEN;
  await expect(run({})).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: GH_TOKEN environment variable must be set, exiting.]`
  );
});

it('should label the PR associated with cherry picks in the current branch', async () => {
  process.env.GH_TOKEN = 'MY_SECRET';

  const writeStderr = vi.spyOn(process.stderr, 'write').mockImplementation((() => {}) as any);

  await run({});
  expect(github.githubGraphQlClient.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "
          mutation ($input: AddLabelsToLabelableInput!) {
            addLabelsToLabelable(input: $input) {
              clientMutationId
            }
          }
        ",
        {
          "input": {
            "clientMutationId": "7efda802-d7d1-5d76-97d6-cc16a9f3e357",
            "labelIds": [
              "pick-id",
            ],
            "labelableId": "pr_id",
          },
        },
      ],
    ]
  `);

  const stderrCalls = writeStderr.mock.calls
    .map(([text]) =>
      typeof text === 'string'
        ? text
            .replace(ansiRegex(), '')
            .replace(/[^\x20-\x7E]/g, '')
            .replaceAll('-', '')
            .trim()
        : text
    )
    .filter((text) => text !== '');

  expect(stderrCalls).toMatchInlineSnapshot(`
    [
      "Looking for latest tag",
      "Found latest tag: v7.2.1",
      "Looking at cherry pick commits since v7.2.1",
      "Found the following picks : Commit: 930b47f011f750c44a1782267d698ccdd3c04da3 PR: [#55](https://github.com/storybookjs/storybook/pull/55)",
      "Labeling 1 PRs with the patch:done label...",
      "Successfully labeled all PRs with the patch:done label.",
    ]
  `);
});

it('should label all PRs when the --all flag is passed', async () => {
  process.env.GH_TOKEN = 'MY_SECRET';

  // clear the git log, it shouldn't depend on it in --all mode
  gitClient.git.log.mockResolvedValue({
    all: [],
    latest: null!,
    total: 0,
  });

  const writeStderr = vi.spyOn(process.stderr, 'write').mockImplementation((() => {}) as any);

  await run({ all: true });
  expect(github.githubGraphQlClient.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "
          mutation ($input: AddLabelsToLabelableInput!) {
            addLabelsToLabelable(input: $input) {
              clientMutationId
            }
          }
        ",
        {
          "input": {
            "clientMutationId": "39cffd21-7933-56e4-9d9c-1afeda9d5906",
            "labelIds": [
              "pick-id",
            ],
            "labelableId": "some-id",
          },
        },
      ],
      [
        "
          mutation ($input: AddLabelsToLabelableInput!) {
            addLabelsToLabelable(input: $input) {
              clientMutationId
            }
          }
        ",
        {
          "input": {
            "clientMutationId": "cc31033b-5da7-5c9e-adf2-80a2963e19a8",
            "labelIds": [
              "pick-id",
            ],
            "labelableId": "other-id",
          },
        },
      ],
    ]
  `);

  const stderrCalls = writeStderr.mock.calls
    .map(([text]) =>
      typeof text === 'string'
        ? text
            .replace(ansiRegex(), '')
            .replace(/[^\x20-\x7E]/g, '')
            .replaceAll('-', '')
            .trim()
        : text
    )
    .filter((t) => t !== '');

  expect(stderrCalls).toMatchInlineSnapshot(`
    [
      "Labeling 2 PRs with the patch:done label...",
      "Successfully labeled all PRs with the patch:done label.",
    ]
  `);
  expect(github.getUnpickedPRs).toHaveBeenCalledTimes(1);
});
