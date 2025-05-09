import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import dedent from 'ts-dedent';

import type { CheckOptions, RunOptions } from '../types';
import { type StorysourceOptions, addonStorysourceCodePanel } from './addon-storysource-code-panel';

// Mock modules before any other imports or declarations
vi.mock('node:fs/promises', async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    readFile: vi.fn().mockResolvedValue(
      Buffer.from(dedent`
        import React from 'react';
        import { ThemeProvider, convert, themes } from 'storybook/theming';

        export const parameters = {
          storySort: {
            order: ['Examples', 'Docs', 'Demo'],
          }
        };

        export const decorators = [
          (StoryFn) => (
            <ThemeProvider theme={convert(themes.light)}>
              <StoryFn />
            </ThemeProvider>
          )
        ];
      `)
    ),
    writeFile: vi.fn(),
  };
});

vi.mock('picocolors', () => {
  return {
    default: {
      cyan: (str: string) => str,
      yellow: (str: string) => str,
      blue: (str: string) => str,
    },
  };
});

// Create mock package manager
const mockPackageManager = {
  retrievePackageJson: vi.fn(),
  removeDependencies: vi.fn(),
  runPackageCommand: vi.fn(),
} as unknown as JsPackageManager;

// Set up test data
const baseCheckOptions: CheckOptions = {
  packageManager: mockPackageManager,
  mainConfig: {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
    addons: ['@storybook/addon-links'],
  } as StorybookConfigRaw,
  storybookVersion: '8.0.0',
  configDir: '.storybook',
};

describe('addon-storysource-remove', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('check phase', () => {
    it('returns null if storysource addon not found', async () => {
      const result = await addonStorysourceCodePanel.check({
        ...baseCheckOptions,
      });
      expect(result).toBeNull();
    });

    it('detects storysource addon when present', async () => {
      const result = await addonStorysourceCodePanel.check({
        ...baseCheckOptions,
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: ['@storybook/addon-links', '@storybook/addon-storysource'],
        } as StorybookConfigRaw,
        mainConfigPath: '.storybook/main.js',
        previewConfigPath: '.storybook/preview.js',
      });

      expect(result).toEqual({
        hasStorysource: true,
        hasDocs: false,
      });
    });

    it('detects storysource addon when present as object', async () => {
      const result = await addonStorysourceCodePanel.check({
        ...baseCheckOptions,
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: ['@storybook/addon-links', { name: '@storybook/addon-storysource' }],
        } as StorybookConfigRaw,
        mainConfigPath: '.storybook/main.js',
        previewConfigPath: '.storybook/preview.js',
      });

      expect(result).toEqual({
        hasStorysource: true,
        hasDocs: false,
      });
    });

    it('detects docs addon when present', async () => {
      const result = await addonStorysourceCodePanel.check({
        ...baseCheckOptions,
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: ['@storybook/addon-storysource', '@storybook/addon-docs'],
        } as StorybookConfigRaw,
        mainConfigPath: '.storybook/main.js',
        previewConfigPath: '.storybook/preview.js',
      });

      expect(result).toEqual({
        hasStorysource: true,
        hasDocs: true,
      });
    });
  });

  describe('prompt phase', () => {
    it('returns the correct prompt message', () => {
      const promptMessage = addonStorysourceCodePanel.prompt({
        hasStorysource: true,
        hasDocs: true,
      });

      expect(promptMessage).toMatchInlineSnapshot(dedent`
        "We've detected that you're using @storybook/addon-storysource.

        The @storybook/addon-storysource addon is being removed in Storybook 9.0. 
        Instead, Storybook now provides a Code Panel via @storybook/addon-docs 
        that offers similar functionality with improved integration and performance.

        We'll remove @storybook/addon-storysource from your project and 
        enable the Code Panel in your preview configuration. 

        More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#storysource-addon-removed"
      `);
    });

    it('returns the correct prompt message when docs addon is not present', () => {
      const promptMessage = addonStorysourceCodePanel.prompt({
        hasStorysource: true,
        hasDocs: false,
      });

      expect(promptMessage).toMatchInlineSnapshot(dedent`
        "We've detected that you're using @storybook/addon-storysource.

        The @storybook/addon-storysource addon is being removed in Storybook 9.0. 
        Instead, Storybook now provides a Code Panel via @storybook/addon-docs 
        that offers similar functionality with improved integration and performance.

        We'll remove @storybook/addon-storysource from your project and 
        enable the Code Panel in your preview configuration. Additionally, we will install @storybook/addon-docs for you.

        More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#storysource-addon-removed"
      `);
    });
  });

  describe('run phase', () => {
    it('does nothing if storysource addon not found', async () => {
      await addonStorysourceCodePanel.run?.({
        result: {
          hasStorysource: false,
          hasDocs: false,
        },
        packageManager: mockPackageManager,
        configDir: '.storybook',
      } as RunOptions<StorysourceOptions>);

      expect(mockPackageManager.runPackageCommand).not.toHaveBeenCalled();
    });

    it('removes storysource addon and updates preview config', async () => {
      await addonStorysourceCodePanel.run?.({
        result: {
          hasStorysource: true,
          hasDocs: true,
        },
        packageManager: mockPackageManager,
        previewConfigPath: '.storybook/preview.js',
        configDir: '.storybook',
      } as RunOptions<StorysourceOptions>);

      // Verify package manager was called with correct arguments
      expect(mockPackageManager.runPackageCommand).toHaveBeenCalledWith('storybook', [
        'remove',
        '@storybook/addon-storysource',
        '--config-dir',
        '.storybook',
      ]);

      expect(mockPackageManager.runPackageCommand).not.toHaveBeenCalledWith('storybook', [
        'add',
        '@storybook/addon-docs',
        '--config-dir',
        '.storybook',
      ]);

      const writeFile = vi.mocked((await import('node:fs/promises')).writeFile);

      const newConfig = writeFile.mock.calls[0][1];

      expect(newConfig).toMatchInlineSnapshot(dedent`
        "import React from 'react';
        import { ThemeProvider, convert, themes } from 'storybook/theming';

        export const parameters = {
          storySort: {
            order: ['Examples', 'Docs', 'Demo'],
          },

          docs: {
            codePanel: true
          }
        };

        export const decorators = [
          (StoryFn) => (
            <ThemeProvider theme={convert(themes.light)}>
              <StoryFn />
            </ThemeProvider>
          )
        ];"
      `);
    });

    it('should add docs addon if it is not present', async () => {
      await addonStorysourceCodePanel.run?.({
        result: {
          hasStorysource: true,
          hasDocs: false,
        },
        packageManager: mockPackageManager,
        previewConfigPath: '.storybook/preview.js',
        configDir: '.storybook',
      } as RunOptions<StorysourceOptions>);

      expect(mockPackageManager.runPackageCommand).toHaveBeenCalledWith('storybook', [
        'add',
        '@storybook/addon-docs',
        '--config-dir',
        '.storybook',
      ]);
    });

    it('does nothing in dry run mode', async () => {
      await addonStorysourceCodePanel.run?.({
        result: {
          hasStorysource: true,
          hasDocs: true,
        },
        previewConfigPath: '.storybook/preview.js',
        packageManager: mockPackageManager,
        configDir: '.storybook',
        dryRun: true,
      } as RunOptions<StorysourceOptions>);

      // Verify no actual changes were made
      expect(mockPackageManager.runPackageCommand).not.toHaveBeenCalled();
    });
  });
});
