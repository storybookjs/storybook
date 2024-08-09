/* eslint-disable no-underscore-dangle */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as fsExtraImp from 'fs-extra';
import path from 'path';
import { dedent } from 'ts-dedent';

import type * as MockedFSToExtra from '../../../code/__mocks__/fs-extra';
import * as changesUtils_ from '../utils/get-changes';
import { run as writeChangelog } from '../write-changelog';

vi.mock('fs-extra', async () => import('../../../code/__mocks__/fs-extra'));
vi.mock('../utils/get-changes');

const changesUtils = vi.mocked(changesUtils_);

const fsExtra = fsExtraImp as unknown as typeof MockedFSToExtra;

beforeEach(() => {
  vi.restoreAllMocks();

  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  fsExtra.__setMockFiles({
    [STABLE_CHANGELOG_PATH]: EXISTING_STABLE_CHANGELOG,
    [PRERELEASE_CHANGELOG_PATH]: EXISTING_PRERELEASE_CHANGELOG,
  });
});

const STABLE_CHANGELOG_PATH = path.join(__dirname, '..', '..', '..', 'CHANGELOG.md');
const PRERELEASE_CHANGELOG_PATH = path.join(__dirname, '..', '..', '..', 'CHANGELOG.prerelease.md');
const LATEST_VERSION_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'versions',
  'latest.json'
);
const NEXT_VERSION_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'versions', 'next.json');

const EXISTING_STABLE_CHANGELOG = dedent`## 7.0.0

- Core: Some change`;

const EXISTING_PRERELEASE_CHANGELOG = dedent`## 7.1.0-alpha.20

- CLI: Super fast now`;

describe('Write changelog', () => {
  it('should write to stable changelogs and version files in docs', async () => {
    changesUtils.getChanges.mockResolvedValue({
      changes: [],
      changelogText: `## 7.0.1

- React: Make it reactive
- CLI: Not UI`,
    });

    await writeChangelog(['7.0.1'], {});

    expect(fsExtra.writeFile).toHaveBeenCalledTimes(1);
    expect(fsExtra.writeFile.mock.calls[0][0]).toBe(STABLE_CHANGELOG_PATH);
    expect(fsExtra.writeFile.mock.calls[0][1]).toMatchInlineSnapshot(`
      "## 7.0.1

      - React: Make it reactive
      - CLI: Not UI

      ## 7.0.0

      - Core: Some change"
    `);
    expect(fsExtra.writeJson).toBeCalledTimes(1);
    expect(fsExtra.writeJson.mock.calls[0][0]).toBe(LATEST_VERSION_PATH);
    expect(fsExtra.writeJson.mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "info": {
          "plain": "- React: Make it reactive
      - CLI: Not UI",
        },
        "version": "7.0.1",
      }
    `);
  });

  it('should escape double quotes for json files', async () => {
    changesUtils.getChanges.mockResolvedValue({
      changes: [],
      changelogText: `## 7.0.1

- React: Make it reactive
- Revert "CLI: Not UI"
- CLI: Not UI`,
    });

    await writeChangelog(['7.0.1'], {});

    expect(fsExtra.writeFile).toHaveBeenCalledTimes(1);
    expect(fsExtra.writeFile.mock.calls[0][0]).toBe(STABLE_CHANGELOG_PATH);
    expect(fsExtra.writeFile.mock.calls[0][1]).toMatchInlineSnapshot(`
      "## 7.0.1

      - React: Make it reactive
      - Revert "CLI: Not UI"
      - CLI: Not UI

      ## 7.0.0

      - Core: Some change"
    `);
    expect(fsExtra.writeJson).toBeCalledTimes(1);
    expect(fsExtra.writeJson.mock.calls[0][0]).toBe(LATEST_VERSION_PATH);
    expect(fsExtra.writeJson.mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "info": {
          "plain": "- React: Make it reactive
      - Revert \\"CLI: Not UI\\"
      - CLI: Not UI",
        },
        "version": "7.0.1",
      }
    `);
  });

  it('should write to prerelase changelogs and version files in docs', async () => {
    changesUtils.getChanges.mockResolvedValue({
      changes: [],
      changelogText: `## 7.1.0-alpha.21

- React: Make it reactive
- CLI: Not UI`,
    });

    await writeChangelog(['7.1.0-alpha.21'], {});

    expect(fsExtra.writeFile).toHaveBeenCalledTimes(1);
    expect(fsExtra.writeFile.mock.calls[0][0]).toBe(PRERELEASE_CHANGELOG_PATH);
    expect(fsExtra.writeFile.mock.calls[0][1]).toMatchInlineSnapshot(`
      "## 7.1.0-alpha.21

      - React: Make it reactive
      - CLI: Not UI

      ## 7.1.0-alpha.20

      - CLI: Super fast now"
    `);
    expect(fsExtra.writeJson).toBeCalledTimes(1);
    expect(fsExtra.writeJson.mock.calls[0][0]).toBe(NEXT_VERSION_PATH);
    expect(fsExtra.writeJson.mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "info": {
          "plain": "- React: Make it reactive
      - CLI: Not UI",
        },
        "version": "7.1.0-alpha.21",
      }
    `);
  });
});
