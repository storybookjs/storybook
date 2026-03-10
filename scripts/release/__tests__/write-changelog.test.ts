import * as fspImp from 'node:fs/promises';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import type * as MockedFSPToExtra from '../../../code/__mocks__/fs/promises';
import * as changesUtils_ from '../utils/get-changes';
import { run as writeChangelog } from '../write-changelog';

vi.mock('node:fs/promises', async () => import('../../../code/__mocks__/fs/promises'));
vi.mock('../utils/get-changes');

const changesUtils = vi.mocked(changesUtils_);

const fsp = fspImp as unknown as typeof MockedFSPToExtra;

beforeEach(() => {
  vi.restoreAllMocks();

  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  fsp.__setMockFiles({
    [STABLE_CHANGELOG_PATH]: EXISTING_STABLE_CHANGELOG,
    [PRERELEASE_CHANGELOG_PATH]: EXISTING_PRERELEASE_CHANGELOG,
  });
});

const STABLE_CHANGELOG_PATH = join(__dirname, '..', '..', '..', 'CHANGELOG.md');
const PRERELEASE_CHANGELOG_PATH = join(__dirname, '..', '..', '..', 'CHANGELOG.prerelease.md');
const LATEST_VERSION_PATH = join(__dirname, '..', '..', '..', 'docs', 'versions', 'latest.json');
const NEXT_VERSION_PATH = join(__dirname, '..', '..', '..', 'docs', 'versions', 'next.json');

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

    expect(fsp.writeFile).toHaveBeenCalledTimes(2);
    expect(fsp.writeFile.mock.calls[0][0]).toBe(STABLE_CHANGELOG_PATH);
    expect(fsp.writeFile.mock.calls[0][1]).toMatchInlineSnapshot(`
      "## 7.0.1

      - React: Make it reactive
      - CLI: Not UI

      ## 7.0.0

      - Core: Some change"
    `);
    expect(fsp.writeFile.mock.calls[1][0]).toBe(LATEST_VERSION_PATH);
    expect(fsp.writeFile.mock.calls[1][1]).toMatchInlineSnapshot(
      `"{"version":"7.0.1","info":{"plain":"- React: Make it reactive\\n- CLI: Not UI"}}"`
    );
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

    expect(fsp.writeFile).toHaveBeenCalledTimes(2);
    expect(fsp.writeFile.mock.calls[0][0]).toBe(STABLE_CHANGELOG_PATH);
    expect(fsp.writeFile.mock.calls[0][1]).toMatchInlineSnapshot(`
      "## 7.0.1

      - React: Make it reactive
      - Revert "CLI: Not UI"
      - CLI: Not UI

      ## 7.0.0

      - Core: Some change"
    `);
    expect(fsp.writeFile.mock.calls[1][0]).toBe(LATEST_VERSION_PATH);
    expect(fsp.writeFile.mock.calls[1][1]).toMatchInlineSnapshot(
      `"{"version":"7.0.1","info":{"plain":"- React: Make it reactive\\n- Revert \\\\\\"CLI: Not UI\\\\\\"\\n- CLI: Not UI"}}"`
    );
  });

  it('should write to prerelease changelogs and version files in docs', async () => {
    changesUtils.getChanges.mockResolvedValue({
      changes: [],
      changelogText: `## 7.1.0-alpha.21

- React: Make it reactive
- CLI: Not UI`,
    });

    await writeChangelog(['7.1.0-alpha.21'], {});

    expect(fsp.writeFile).toHaveBeenCalledTimes(2);
    expect(fsp.writeFile.mock.calls[0][0]).toBe(PRERELEASE_CHANGELOG_PATH);
    expect(fsp.writeFile.mock.calls[0][1]).toMatchInlineSnapshot(`
      "## 7.1.0-alpha.21

      - React: Make it reactive
      - CLI: Not UI

      ## 7.1.0-alpha.20

      - CLI: Super fast now"
    `);
    expect(fsp.writeFile.mock.calls[1][0]).toBe(NEXT_VERSION_PATH);
    expect(fsp.writeFile.mock.calls[1][1]).toMatchInlineSnapshot(
      `"{"version":"7.1.0-alpha.21","info":{"plain":"- React: Make it reactive\\n- CLI: Not UI"}}"`
    );
  });
});
