import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { add } from '../../add';
import type { CheckOptions, RunOptions } from '../types';
import { type StorysourceOptions, addonStorysourceCodePanel } from './addon-storysource-code-panel';

vi.mock('../../add');

vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    removeAddon: vi.fn(),
  };
});

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
const mockPackageManager = {} as JsPackageManager;

// Set up test data
const baseCheckOptions: CheckOptions = {
  packageManager: mockPackageManager,
  mainConfig: {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
    addons: ['@storybook/addon-links'],
  } as StorybookConfigRaw,
  storybookVersion: '8.0.0',
  configDir: '.storybook',
  storiesPaths: [],
};

describe('addon-storysource-remove', () => {
  beforeEach(() => {
    mockPackageManager.runPackageCommand = vi.fn();
    mockPackageManager.removeDependencies = vi.fn();
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

  describe('run phase', () => {
    it('does nothing if storysource addon not found', async () => {
      await addonStorysourceCodePanel.run?.({
        result: {
          hasStorysource: false,
          hasDocs: false,
        },
        packageManager: mockPackageManager as JsPackageManager,
        configDir: '.storybook',
      } as RunOptions<StorysourceOptions>);

      expect(mockPackageManager.runPackageCommand).not.toHaveBeenCalled();
    });

    it('removes storysource addon and updates preview config', async () => {
      const { removeAddon } = await import('storybook/internal/common');

      await addonStorysourceCodePanel.run?.({
        result: {
          hasStorysource: true,
          hasDocs: true,
        },
        packageManager: mockPackageManager as JsPackageManager,
        previewConfigPath: '.storybook/preview.js',
        configDir: '.storybook',
      } as RunOptions<StorysourceOptions>);

      // Verify removeAddon was called with correct arguments
      expect(removeAddon).toHaveBeenCalledWith('@storybook/addon-storysource', {
        configDir: '.storybook',
        skipInstall: true,
        packageManager: mockPackageManager,
      });

      expect(vi.mocked(add)).not.toHaveBeenCalled();

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
        packageManager: mockPackageManager as JsPackageManager,
        previewConfigPath: '.storybook/preview.js',
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as RunOptions<StorysourceOptions>);

      expect(vi.mocked(add)).toHaveBeenCalledWith('@storybook/addon-docs', {
        configDir: '.storybook',
        skipInstall: true,
        skipPostinstall: true,
        yes: true,
      });
    });

    it('does nothing in dry run mode', async () => {
      await addonStorysourceCodePanel.run?.({
        result: {
          hasStorysource: true,
          hasDocs: true,
        },
        previewConfigPath: '.storybook/preview.js',
        packageManager: mockPackageManager as JsPackageManager,
        configDir: '.storybook',
        dryRun: true,
      } as RunOptions<StorysourceOptions>);

      // Verify no actual changes were made
      expect(mockPackageManager.runPackageCommand).not.toHaveBeenCalled();
    });
  });
});
