import { describe, expect, it } from 'vitest';

import { type JsPackageManager, type Overrides, getProjectRoot } from 'storybook/internal/common';

import { join } from 'pathe';

import { getStorybookOverrides, getStorybookOverridesSummary } from './getStorybookOverrides.ts';

const TARGET_VERSION = '11.0.0-beta.1';
const PACKAGE_JSON = join(getProjectRoot(), 'package.json');

describe('getStorybookOverrides', () => {
  it.each<{ name: string; input: { field: string; overrides: Overrides }; expected: string[] }>([
    {
      name: 'npm override nested under a parent package',
      input: {
        field: 'overrides',
        overrides: {
          '@storybook/addon-mcp': {
            storybook: '~10.5.3',
            '@storybook/addon-vitest': '~10.5.3',
            valibot: '^1.4.2',
          },
        },
      },
      expected: [
        'overrides › @storybook/addon-mcp › storybook = ~10.5.3',
        'overrides › @storybook/addon-mcp › @storybook/addon-vitest = ~10.5.3',
      ],
    },
    {
      name: 'npm `.` override of the parent package itself',
      input: { field: 'overrides', overrides: { storybook: { '.': '10.5.3', semver: '^7' } } },
      expected: ['overrides › storybook › . = 10.5.3'],
    },
    {
      name: 'yarn resolutions with glob and parent paths',
      input: {
        field: 'resolutions',
        overrides: {
          '**/storybook': '10.5.3',
          '@storybook/addon-mcp/@storybook/addon-vitest': 'npm:^10.5.0',
        },
      },
      expected: [
        'resolutions › **/storybook = 10.5.3',
        'resolutions › @storybook/addon-mcp/@storybook/addon-vitest = npm:^10.5.0',
      ],
    },
    {
      name: 'pnpm overrides with a parent selector',
      input: {
        field: 'pnpm.overrides',
        overrides: { '@storybook/addon-mcp>storybook': '~10.5.3' },
      },
      expected: ['pnpm.overrides › @storybook/addon-mcp>storybook = ~10.5.3'],
    },
    {
      name: 'ranges that include the target version',
      input: {
        field: 'overrides',
        overrides: { storybook: '^11.0.0-beta.0', '@storybook/addon-docs': '>=10' },
      },
      expected: [],
    },
    {
      name: 'third-party packages',
      input: { field: 'overrides', overrides: { typescript: '5.0.0', react: '17.0.0' } },
      expected: [],
    },
    {
      name: 'selectors carrying a version, which stop matching after the upgrade',
      input: {
        field: 'overrides',
        overrides: { 'storybook@^10': '10.5.3', 'storybook@<11': '10' },
      },
      expected: [],
    },
    {
      name: 'a top-level `.`, which names no package',
      input: { field: 'overrides', overrides: { '.': '10.5.3' } },
      expected: [],
    },
    {
      name: 'references, removals, aliases and protocols',
      input: {
        field: 'overrides',
        overrides: {
          storybook: '$storybook',
          '@storybook/addon-docs': 'npm:other@1.0.0',
          '@storybook/addon-a11y': 'portal:../a11y',
          '@storybook/addon-vitest': '-',
        },
      },
      expected: [],
    },
  ])('$name', ({ input, expected }) => {
    const packageManager = {
      getOverrideSources: () => [{ path: PACKAGE_JSON, ...input }],
    } as unknown as JsPackageManager;

    expect(
      getStorybookOverrides({ packageManager, targetVersion: TARGET_VERSION }).map(
        ({ keyPath, range }) => `${keyPath.join(' › ')} = ${range}`
      )
    ).toEqual(expected);
  });

  it('reports nothing for a canary target', () => {
    const packageManager = {
      getOverrideSources: () => [
        { path: PACKAGE_JSON, field: 'overrides', overrides: { storybook: '10.5.3' } },
      ],
    } as unknown as JsPackageManager;

    expect(
      getStorybookOverrides({ packageManager, targetVersion: '0.0.0-pr-37357-sha-abc' })
    ).toEqual([]);
  });
});

describe('getStorybookOverridesSummary', () => {
  const overrides = [
    {
      path: PACKAGE_JSON,
      keyPath: ['overrides', '@storybook/addon-mcp', 'storybook'],
      range: '~10.5.3',
    },
    {
      path: join(getProjectRoot(), 'pnpm-workspace.yaml'),
      keyPath: ['overrides', 'storybook'],
      range: '10',
    },
  ];

  it('lists each override', () => {
    expect(getStorybookOverridesSummary(overrides, '11.0.0')).toMatchInlineSnapshot(`
      "These overrides force Storybook packages to versions that exclude 11.0.0:

      - /package.json: overrides › @storybook/addon-mcp › storybook = ~10.5.3
      - /pnpm-workspace.yaml: overrides › storybook = 10

      Update these entries to 11.0.0 or remove them."
    `);
  });

  it('ends with the next step when given', () => {
    expect(getStorybookOverridesSummary(overrides, '11.0.0', 'reinstall your dependencies'))
      .toMatchInlineSnapshot(`
      "These overrides force Storybook packages to versions that exclude 11.0.0:

      - /package.json: overrides › @storybook/addon-mcp › storybook = ~10.5.3
      - /pnpm-workspace.yaml: overrides › storybook = 10

      Update these entries to 11.0.0 or remove them, then reinstall your dependencies."
    `);
  });
});
