import { afterAll, describe, expect, it, vi } from 'vitest';

import { JsPackageManager, getProjectRoot } from 'storybook/internal/common';

import { join } from 'pathe';

import { getStorybookOverridesSummary } from './getStorybookOverridesSummary.ts';

type PackageJsonInput = {
  overrides?: Record<string, string | Record<string, string>>;
  resolutions?: Record<string, string>;
  pnpm?: { overrides: Record<string, string> };
};

const TARGET_VERSION = '11.0.0-beta.1';

const getPackageJson = vi.spyOn(JsPackageManager, 'getPackageJson');
const packageManager = {
  packageJsonPaths: [join(getProjectRoot(), 'package.json')],
} as JsPackageManager;

afterAll(() => {
  getPackageJson.mockRestore();
});

describe('getStorybookOverridesSummary', () => {
  it.each<{ name: string; input: PackageJsonInput; expected: string[] }>([
    {
      name: 'npm override nested under a parent package',
      input: {
        overrides: {
          '@storybook/addon-mcp': {
            storybook: '~10.5.3',
            '@storybook/addon-vitest': '~10.5.3',
            valibot: '^1.4.2',
          },
        },
      },
      expected: [
        '- /package.json: overrides › @storybook/addon-mcp › storybook = ~10.5.3',
        '- /package.json: overrides › @storybook/addon-mcp › @storybook/addon-vitest = ~10.5.3',
      ],
    },
    {
      name: 'npm `.` override of the parent package itself',
      input: { overrides: { storybook: { '.': '10.5.3', semver: '^7' } } },
      expected: ['- /package.json: overrides › storybook › . = 10.5.3'],
    },
    {
      name: 'yarn resolutions with glob and parent paths',
      input: {
        resolutions: {
          '**/storybook': '10.5.3',
          '@storybook/addon-mcp/@storybook/addon-vitest': 'npm:^10.5.0',
        },
      },
      expected: [
        '- /package.json: resolutions › **/storybook = 10.5.3',
        '- /package.json: resolutions › @storybook/addon-mcp/@storybook/addon-vitest = npm:^10.5.0',
      ],
    },
    {
      name: 'pnpm overrides with a parent selector',
      input: { pnpm: { overrides: { '@storybook/addon-mcp>storybook': '~10.5.3' } } },
      expected: ['- /package.json: pnpm.overrides › @storybook/addon-mcp>storybook = ~10.5.3'],
    },
    {
      name: 'ranges that include the target version',
      input: { overrides: { storybook: '^11.0.0-beta.0', '@storybook/addon-docs': '>=10' } },
      expected: [],
    },
    {
      name: 'third-party packages',
      input: { overrides: { typescript: '5.0.0' }, resolutions: { react: '17.0.0' } },
      expected: [],
    },
    {
      name: 'selectors carrying a version, which stop matching after the upgrade',
      input: {
        overrides: { 'storybook@^10': '10.5.3' },
        pnpm: { overrides: { 'storybook@<11': '10.5.3' } },
      },
      expected: [],
    },
    {
      name: 'a top-level `.`, which names no package',
      input: { overrides: { '.': '10.5.3' } },
      expected: [],
    },
    {
      name: 'references, removals, aliases and protocols',
      input: {
        overrides: { storybook: '$storybook', '@storybook/addon-docs': 'npm:other@1.0.0' },
        resolutions: { '@storybook/addon-a11y': 'portal:../a11y' },
        pnpm: { overrides: { '@storybook/addon-vitest': '-' } },
      },
      expected: [],
    },
  ])('$name', ({ input, expected }) => {
    getPackageJson.mockReturnValue({ dependencies: {}, devDependencies: {}, ...input });

    const summary = getStorybookOverridesSummary({ packageManager, targetVersion: TARGET_VERSION });

    expect(summary?.split('\n').filter((line) => line.startsWith('- ')) ?? []).toEqual(expected);
  });

  it('reports nothing for a canary target', () => {
    getPackageJson.mockReturnValue({
      dependencies: {},
      devDependencies: {},
      overrides: { storybook: '10.5.3' },
    });

    expect(
      getStorybookOverridesSummary({ packageManager, targetVersion: '0.0.0-pr-37357-sha-abc' })
    ).toBeUndefined();
  });

  it('wraps the conflicts in instructions', () => {
    getPackageJson.mockReturnValue({
      dependencies: {},
      devDependencies: {},
      overrides: { '@storybook/addon-mcp': { storybook: '~10.5.3' } },
    });

    expect(getStorybookOverridesSummary({ packageManager, targetVersion: '11.0.0' }))
      .toMatchInlineSnapshot(`
        "These package.json overrides force Storybook packages to versions that exclude 11.0.0:

        - /package.json: overrides › @storybook/addon-mcp › storybook = ~10.5.3

        Update these entries to 11.0.0 or remove them."
      `);
  });
});
