import { describe, afterEach, it, expect, vi } from 'vitest';

import type { StorybookConfigRaw, PackageJson } from '@storybook/core/types';
import { ansiRegex } from '../helpers/cleanLog';
import { makePackageManager } from '../helpers/testing-helpers';
import type { BareMdxStoriesGlobRunOptions } from './mdx-to-csf';
import { mdxToCSF } from './mdx-to-csf';

const checkBareMdxStoriesGlob = async ({
  packageJson,
  main: mainConfig,
  storybookVersion = '7.0.0',
}: {
  packageJson: PackageJson;
  main?: Partial<StorybookConfigRaw> & Record<string, unknown>;
  storybookVersion?: string;
}) => {
  return mdxToCSF.check({
    mainConfig: mainConfig as StorybookConfigRaw,
    packageManager: makePackageManager(packageJson),
    storybookVersion,
  });
};

describe('bare-mdx fix', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('should no-op', () => {
    describe('in SB >= v7.0.0', () => {
      it('without main', async () => {
        const packageJson = {
          dependencies: { '@storybook/react': '^7.0.0' },
        };
        await expect(checkBareMdxStoriesGlob({ packageJson })).rejects.toThrow();
      });

      it('without stories field in main', async () => {
        const packageJson = {
          dependencies: { '@storybook/react': '^7.0.0' },
        };
        const main = {};
        await expect(checkBareMdxStoriesGlob({ packageJson, main })).rejects.toThrow();
      });

      it('without .stories.mdx in globs', async () => {
        const packageJson = {
          dependencies: { '@storybook/react': '^7.0.0' },
        };
        const main = {
          stories: [
            '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
            { directory: '../**', files: '*.stories.@(js|jsx|mjs|ts|tsx)' },
            { directory: '../**' },
          ],
        };
        await expect(checkBareMdxStoriesGlob({ packageJson, main })).resolves.toBeFalsy();
      });
    });
  });
  describe('should fix', () => {
    it.each([
      {
        existingStoriesEntries: ['../src/**/*.stories.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
        expectedStoriesEntries: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
      },
      {
        existingStoriesEntries: ['../src/**/*.stories.*'],
        expectedStoriesEntries: ['../src/**/*.@(mdx|stories.*)'],
      },
      {
        existingStoriesEntries: ['../src/**/*.stories.@(mdx|js|jsx|ts|tsx)'],
        expectedStoriesEntries: ['../src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
      },
      {
        existingStoriesEntries: ['../src/**/*.stories.@(js|jsx|mdx|ts|tsx)'],
        expectedStoriesEntries: ['../src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
      },
      {
        existingStoriesEntries: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
        expectedStoriesEntries: ['../src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
      },
    ])(
      'strings: $existingStoriesEntries',
      async ({ existingStoriesEntries, expectedStoriesEntries }) => {
        const packageJson = {
          dependencies: { '@storybook/react': '^7.0.0' },
        };
        const main = {
          stories: existingStoriesEntries,
        };
        await expect(checkBareMdxStoriesGlob({ packageJson, main })).resolves.toMatchObject({
          existingStoriesEntries,
          nextStoriesEntries: expectedStoriesEntries,
        });
      }
    );
    it.each([
      {
        existingStoriesEntries: [{ directory: '../src/**', files: '*.stories.mdx' }],
        expectedStoriesEntries: [{ directory: '../src/**', files: '*.mdx' }],
      },
      {
        existingStoriesEntries: [{ directory: '../src/**', files: '*.stories.*' }],
        expectedStoriesEntries: [{ directory: '../src/**', files: '*.@(mdx|stories.*)' }],
      },
      {
        existingStoriesEntries: [
          { directory: '../src/**', files: '*.stories.@(js|jsx|ts|tsx|mdx)' },
        ],
        expectedStoriesEntries: [
          { directory: '../src/**', files: '*.@(mdx|stories.@(js|jsx|ts|tsx))' },
        ],
      },
    ])(
      'specifiers: $existingStoriesEntries.0.files',
      async ({ existingStoriesEntries, expectedStoriesEntries }) => {
        const packageJson = {
          dependencies: { '@storybook/react': '^7.0.0' },
        };
        const main = {
          stories: existingStoriesEntries,
        };
        await expect(checkBareMdxStoriesGlob({ packageJson, main })).resolves.toMatchObject({
          existingStoriesEntries,
          nextStoriesEntries: expectedStoriesEntries,
        });
      }
    );

    it('prompts', () => {
      const result = mdxToCSF.prompt({
        existingStoriesEntries: [
          '../src/**/*.stories.@(js|jsx|mdx|ts|tsx)',
          { directory: '../src/**', files: '*.stories.mdx' },
        ],
        nextStoriesEntries: [
          '../src/**/*.mdx',
          '../src/**/*.stories.@(js|jsx|ts|tsx)',
          { directory: '../src/**', files: '*.mdx' },
        ],
      } as BareMdxStoriesGlobRunOptions);

      expect(result.replaceAll(ansiRegex(), '')).toMatchInlineSnapshot(`
        "We've detected your project has one or more globs in your 'stories' config that matches .stories.mdx files:
          "../src/**/*.stories.@(js|jsx|mdx|ts|tsx)"
          {
            "directory": "../src/**",
            "files": "*.stories.mdx"
          }

        In Storybook 7, we have deprecated defining stories in MDX files, and consequently have changed the suffix to simply .mdx. Since Storybook 8, we have removed the support of story definition in MDX files entirely. Therefore '.stories.mdx' files aren't supported anymore.

        Now, since Storybook 8.0, we have removed support for .stories.mdx files.

        We can automatically migrate your 'stories' config to include any .mdx file instead of just .stories.mdx.
        That would result in the following 'stories' config:
          "../src/**/*.mdx"
          "../src/**/*.stories.@(js|jsx|ts|tsx)"
          {
            "directory": "../src/**",
            "files": "*.mdx"
          }

        Additionally, we will run the 'mdx-to-csf' codemod for you, which tries to transform '*.stories.mdx' files to '*.stories.js' and '*.mdx' files.

        To learn more about this change, see: https://storybook.js.org/docs/migration-guide#storiesmdx-to-mdxcsf"
      `);
    });
  });
});
