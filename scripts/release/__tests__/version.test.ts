/* eslint-disable no-underscore-dangle */
import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import * as fsExtraImp from 'fs-extra';
import { execaCommand } from 'execa';
import { run as version } from '../version';

import type * as MockedFSToExtra from '../../../code/__mocks__/fs-extra';

vi.mock('fs-extra', async () => import('../../../code/__mocks__/fs-extra'));
const fsExtra = fsExtraImp as unknown as typeof MockedFSToExtra;

vi.mock('../../../code/core/src/common/src/versions', () => ({
  '@storybook/addon-a11y': '7.1.0-alpha.29',
}));

vi.mock('execa');

vi.mock('../../utils/workspace', () => ({
  getWorkspaces: vi.fn().mockResolvedValue([
    {
      name: '@storybook/addon-a11y',
      location: 'addons/a11y',
    },
  ]),
}));

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Version', () => {
  const CODE_DIR_PATH = path.join(__dirname, '..', '..', '..', 'code');
  const CODE_PACKAGE_JSON_PATH = path.join(CODE_DIR_PATH, 'package.json');
  const MANAGER_API_VERSION_PATH = path.join(
    CODE_DIR_PATH,
    'core',
    'src',
    'manager-api',
    'version.ts'
  );
  const VERSIONS_PATH = path.join(CODE_DIR_PATH, 'core', 'src', 'common', 'versions.ts');
  const A11Y_PACKAGE_JSON_PATH = path.join(CODE_DIR_PATH, 'addons', 'a11y', 'package.json');

  it('should throw when release type is invalid', async () => {
    fsExtra.__setMockFiles({
      [CODE_PACKAGE_JSON_PATH]: JSON.stringify({ version: '1.0.0' }),
      [MANAGER_API_VERSION_PATH]: `export const version = "1.0.0";`,
      [VERSIONS_PATH]: `export default { "@storybook/addon-a11y": "1.0.0" };`,
    });

    await expect(version({ releaseType: 'invalid' })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
  {
    "received": "invalid",
    "code": "invalid_enum_value",
    "options": [
      "major",
      "minor",
      "patch",
      "prerelease",
      "premajor",
      "preminor",
      "prepatch"
    ],
    "path": [
      "releaseType"
    ],
    "message": "Invalid enum value. Expected 'major' | 'minor' | 'patch' | 'prerelease' | 'premajor' | 'preminor' | 'prepatch', received 'invalid'"
  }
]]
    `);
  });

  it('should throw when prerelease identifier is combined with non-pre release type', async () => {
    fsExtra.__setMockFiles({
      [CODE_PACKAGE_JSON_PATH]: JSON.stringify({ version: '1.0.0' }),
      [MANAGER_API_VERSION_PATH]: `export const version = "1.0.0";`,
      [VERSIONS_PATH]: `export default { "@storybook/addon-a11y": "1.0.0" };`,
    });

    await expect(version({ releaseType: 'major', preId: 'alpha' })).rejects
      .toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
  {
    "code": "custom",
    "message": "Using prerelease identifier requires one of release types: premajor, preminor, prepatch, prerelease",
    "path": []
  }
]]
    `);
  });

  it('should throw when exact is combined with release type', async () => {
    fsExtra.__setMockFiles({
      [CODE_PACKAGE_JSON_PATH]: JSON.stringify({ version: '1.0.0' }),
      [MANAGER_API_VERSION_PATH]: `export const version = "1.0.0";`,
      [VERSIONS_PATH]: `export default { "@storybook/addon-a11y": "1.0.0" };`,
    });

    await expect(version({ releaseType: 'major', exact: '1.0.0' })).rejects
      .toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
  {
    "code": "custom",
    "message": "Combining --exact with --release-type is invalid, but having one of them is required",
    "path": []
  }
]]
    `);
  });

  it('should throw when exact is invalid semver', async () => {
    fsExtra.__setMockFiles({
      [CODE_PACKAGE_JSON_PATH]: JSON.stringify({ version: '1.0.0' }),
      [MANAGER_API_VERSION_PATH]: `export const version = "1.0.0";`,
      [VERSIONS_PATH]: `export default { "@storybook/addon-a11y": "1.0.0" };`,
    });

    await expect(version({ exact: 'not-semver' })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
  {
    "code": "custom",
    "message": "--exact version has to be a valid semver string",
    "path": [
      "exact"
    ]
  }
]]
    `);
  });

  it('should throw when apply is combined with releaseType', async () => {
    fsExtra.__setMockFiles({
      [CODE_PACKAGE_JSON_PATH]: JSON.stringify({ version: '1.0.0' }),
      [MANAGER_API_VERSION_PATH]: `export const version = "1.0.0";`,
      [VERSIONS_PATH]: `export default { "@storybook/addon-a11y": "1.0.0" };`,
    });

    await expect(version({ apply: true, releaseType: 'prerelease' })).rejects
      .toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
  {
    "code": "custom",
    "message": "--apply cannot be combined with --exact or --release-type, as it will always read from code/package.json#deferredNextVersion",
    "path": []
  }
]]
    `);
  });

  it('should throw when apply is combined with exact', async () => {
    fsExtra.__setMockFiles({
      [CODE_PACKAGE_JSON_PATH]: JSON.stringify({ version: '1.0.0' }),
      [MANAGER_API_VERSION_PATH]: `export const version = "1.0.0";`,
      [VERSIONS_PATH]: `export default { "@storybook/addon-a11y": "1.0.0" };`,
    });

    await expect(version({ apply: true, exact: '1.0.0' })).rejects
      .toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
  {
    "code": "custom",
    "message": "--apply cannot be combined with --exact or --release-type, as it will always read from code/package.json#deferredNextVersion",
    "path": []
  }
]]
    `);
  });

  it('should throw when apply is combined with deferred', async () => {
    fsExtra.__setMockFiles({
      [CODE_PACKAGE_JSON_PATH]: JSON.stringify({ version: '1.0.0' }),
      [MANAGER_API_VERSION_PATH]: `export const version = "1.0.0";`,
      [VERSIONS_PATH]: `export default { "@storybook/addon-a11y": "1.0.0" };`,
    });

    await expect(version({ apply: true, deferred: true })).rejects
      .toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
  {
    "code": "custom",
    "message": "--deferred cannot be combined with --apply",
    "path": []
  }
]]
    `);
  });

  it('should throw when applying without a "deferredNextVersion" set', async () => {
    fsExtra.__setMockFiles({
      [CODE_PACKAGE_JSON_PATH]: JSON.stringify({ version: '1.0.0' }),
    });

    await expect(version({ apply: true })).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: The 'deferredNextVersion' property in code/package.json is unset. This is necessary to apply a deferred version bump]`
    );

    expect(fsExtra.writeJson).not.toHaveBeenCalled();
    expect(fsExtra.writeFile).not.toHaveBeenCalled();
    expect(execaCommand).not.toHaveBeenCalled();
  });

  it.each([
    // prettier-ignore
    { releaseType: 'major', currentVersion: '1.1.1', expectedVersion: '2.0.0' },
    // prettier-ignore
    { releaseType: 'minor', currentVersion: '1.1.1', expectedVersion: '1.2.0' },
    // prettier-ignore
    { releaseType: 'patch', currentVersion: '1.1.1', expectedVersion: '1.1.2' },
    // prettier-ignore
    { releaseType: 'premajor', preId: 'alpha', currentVersion: '1.1.1', expectedVersion: '2.0.0-alpha.0' },
    // prettier-ignore
    { releaseType: 'preminor', preId: 'alpha', currentVersion: '1.1.1', expectedVersion: '1.2.0-alpha.0' },
    // prettier-ignore
    { releaseType: 'prepatch', preId: 'alpha', currentVersion: '1.1.1', expectedVersion: '1.1.2-alpha.0' },
    // prettier-ignore
    { releaseType: 'prerelease', currentVersion: '1.1.1-alpha.5', expectedVersion: '1.1.1-alpha.6' },
    // prettier-ignore
    { releaseType: 'prerelease', preId: 'alpha', currentVersion: '1.1.1-alpha.5', expectedVersion: '1.1.1-alpha.6' },
    // prettier-ignore
    { releaseType: 'prerelease', preId: 'beta', currentVersion: '1.1.1-alpha.10', expectedVersion: '1.1.1-beta.0' },
    // prettier-ignore
    { releaseType: 'major', currentVersion: '1.1.1-rc.10', expectedVersion: '2.0.0' },
    // prettier-ignore
    { releaseType: 'minor', currentVersion: '1.1.1-rc.10', expectedVersion: '1.2.0' },
    // prettier-ignore
    { releaseType: 'patch', currentVersion: '1.1.1-rc.10', expectedVersion: '1.1.1' },
    // prettier-ignore
    { exact: '4.2.0-canary.69', currentVersion: '1.1.1-rc.10', expectedVersion: '4.2.0-canary.69' },
    // prettier-ignore
    { apply: true, currentVersion: '1.0.0', deferredNextVersion: '1.2.0', expectedVersion: '1.2.0' },
  ])(
    'bump with type: "$releaseType", pre id "$preId" or exact "$exact" or apply $apply, from: $currentVersion, to: $expectedVersion',
    async ({
      releaseType,
      preId,
      exact,
      apply,
      currentVersion,
      expectedVersion,
      deferredNextVersion,
    }) => {
      fsExtra.__setMockFiles({
        [CODE_PACKAGE_JSON_PATH]: JSON.stringify({ version: currentVersion, deferredNextVersion }),
        [MANAGER_API_VERSION_PATH]: `export const version = "${currentVersion}";`,
        [VERSIONS_PATH]: `export default { "@storybook/addon-a11y": "${currentVersion}" };`,
        [A11Y_PACKAGE_JSON_PATH]: JSON.stringify({
          version: currentVersion,
        }),
        [VERSIONS_PATH]: `export default { "@storybook/addon-a11y": "${currentVersion}" };`,
      });

      await version({ releaseType, preId, exact, apply });
      expect(fsExtra.writeJson).toHaveBeenCalledTimes(apply ? 3 : 2);
      if (apply) {
        expect(fsExtra.writeJson).toHaveBeenCalledWith(
          CODE_PACKAGE_JSON_PATH,
          // this call is the write that removes the "deferredNextVersion" property
          { version: currentVersion },
          { spaces: 2 }
        );
      }

      expect(fsExtra.writeJson).toHaveBeenCalledWith(
        CODE_PACKAGE_JSON_PATH,
        { version: expectedVersion },
        { spaces: 2 }
      );
      expect(fsExtra.writeFile).toHaveBeenCalledWith(
        MANAGER_API_VERSION_PATH,
        `export const version = "${expectedVersion}";`
      );
      expect(fsExtra.writeFile).toHaveBeenCalledWith(
        VERSIONS_PATH,
        `export default { "@storybook/addon-a11y": "${expectedVersion}" };`
      );
      expect(fsExtra.writeJson).toHaveBeenCalledWith(
        A11Y_PACKAGE_JSON_PATH,
        expect.objectContaining({
          // should update package version
          version: expectedVersion,
        }),
        { spaces: 2 }
      );
      expect(execaCommand).toHaveBeenCalledWith('yarn install --mode=update-lockfile', {
        cwd: path.join(CODE_DIR_PATH),
        cleanup: true,
        stdio: undefined,
      });
    }
  );

  it('should only set version in "deferredNextVersion" when using --deferred', async () => {
    fsExtra.__setMockFiles({
      [CODE_PACKAGE_JSON_PATH]: JSON.stringify({ version: '1.0.0' }),
    });

    await version({ releaseType: 'premajor', preId: 'beta', deferred: true });

    expect(fsExtra.writeJson).toHaveBeenCalledTimes(1);
    expect(fsExtra.writeJson).toHaveBeenCalledWith(
      CODE_PACKAGE_JSON_PATH,
      { version: '1.0.0', deferredNextVersion: '2.0.0-beta.0' },
      { spaces: 2 }
    );
    expect(fsExtra.writeFile).not.toHaveBeenCalled();
    expect(execaCommand).not.toHaveBeenCalled();
  });
});
