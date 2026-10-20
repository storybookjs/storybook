import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type JsPackageManager,
  findBabelConfigFile,
  getProjectRoot,
} from 'storybook/internal/common';

import type { StorybookConfigRaw } from 'storybook/internal/types';

import { checkFix } from '../helpers/fix-test-utils.ts';
import { nextjsBabelConfig } from './nextjs-babel-config.ts';

vi.mock('storybook/internal/common', { spy: true });

const check = ({
  framework = '@storybook/nextjs',
  beforeVersion = '10.3.0',
  storybookVersion = '11.0.0',
  requested,
}: {
  framework?: StorybookConfigRaw['framework'];
  beforeVersion?: string;
  storybookVersion?: string;
  requested?: boolean;
} = {}) =>
  checkFix(nextjsBabelConfig, {
    packageManager: {} as JsPackageManager,
    mainConfig: { stories: [], framework },
    beforeVersion,
    storybookVersion,
    requested,
    storiesPaths: [],
  });

describe('nextjs-babel-config', () => {
  beforeEach(() => {
    vi.mocked(getProjectRoot).mockReturnValue('/project');
    vi.mocked(findBabelConfigFile).mockImplementation((dir) =>
      dir === '/project' || dir === '/project/apps/web' ? `${dir}/.babelrc` : undefined
    );
  });

  it('reports the Babel config at the project root on the upgrade to 11', async () => {
    await expect(check()).resolves.toEqual({ babelConfigFile: '/project/.babelrc' });
  });

  it('looks in the folder of nextConfigPath when it is set', async () => {
    await expect(
      check({
        framework: {
          name: '@storybook/nextjs',
          options: { nextConfigPath: '/project/apps/web/next.config.js' },
        },
      })
    ).resolves.toEqual({ babelConfigFile: '/project/apps/web/.babelrc' });
  });

  it('does not apply without a Babel config', async () => {
    vi.mocked(findBabelConfigFile).mockReturnValue(undefined);

    await expect(check()).resolves.toBeNull();
  });

  it('does not apply to other frameworks', async () => {
    await expect(check({ framework: '@storybook/nextjs-vite' })).resolves.toBeNull();
  });

  it('does not apply before Storybook 11', async () => {
    await expect(
      check({ beforeVersion: '10.2.0', storybookVersion: '10.3.0', requested: true })
    ).resolves.toBeNull();
  });

  it('does not apply to upgrades within 11, unless requested', async () => {
    await expect(
      check({ beforeVersion: '11.0.0', storybookVersion: '11.1.0' })
    ).resolves.toBeNull();
    await expect(
      check({ beforeVersion: '11.0.0', storybookVersion: '11.1.0', requested: true })
    ).resolves.toEqual({ babelConfigFile: '/project/.babelrc' });
  });

  it('names the config file in the prompt', () => {
    expect(nextjsBabelConfig.prompt({ babelConfigFile: '/project/.babelrc' }))
      .toMatchInlineSnapshot(`
        "@storybook/nextjs now always compiles with SWC and ignores your Babel config (.babelrc), so its plugins no longer run in Storybook.

        Plugins with a next.config.js equivalent keep working: styled-components, emotion, relay, removeConsole and reactRemoveProperties through \`compiler\`, others through \`experimental.swcPlugins\`. Run any other plugin with a \`babel-loader\` rule in \`webpackFinal\`. Set \`experimental.forceSwcTransforms: true\` to hide Storybook's warning about the ignored config."
      `);
  });
});
