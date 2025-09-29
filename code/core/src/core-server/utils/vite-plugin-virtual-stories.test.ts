import { existsSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import mocked functions after mocking
import {
  extractProperRendererNameFromFramework,
  getFrameworkName,
  getProjectRoot,
} from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import dedent from 'ts-dedent';

import { createIndexEntries, getComponentFileInfos } from './component-file-indexer';
import { getNewStoryFile } from './get-new-story-file';
import { virtualStoriesPlugin } from './vite-plugin-virtual-stories';

// Mock dependencies
vi.mock('storybook/internal/common', async (importOriginal) => {
  const common = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...common,
    getFrameworkName: vi.fn(),
    extractProperRendererNameFromFramework: vi.fn(),
    getProjectRoot: vi.fn(() => '/mock/project/root'),
  };
});

vi.mock('./component-file-indexer', () => ({
  createIndexEntries: vi.fn(),
  getComponentFileInfos: vi.fn(),
}));

vi.mock('./get-new-story-file', () => ({
  getNewStoryFile: vi.fn(),
}));

// Mock file system
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

const getFrameworkNameMock = vi.mocked(getFrameworkName);
const extractProperRendererNameFromFrameworkMock = vi.mocked(
  extractProperRendererNameFromFramework
);
const getProjectRootMock = vi.mocked(getProjectRoot);
const createIndexEntriesMock = vi.mocked(createIndexEntries);
const getComponentFileInfosMock = vi.mocked(getComponentFileInfos);
const getNewStoryFileMock = vi.mocked(getNewStoryFile);
const existsSyncMock = vi.mocked(existsSync);

describe('virtualStoriesPlugin', () => {
  const mockOptions: Options = {
    configDir: '/mock/config',
    presets: {
      apply: async () => [],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console.error to prevent it from throwing in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup default mocks
    getProjectRootMock.mockReturnValue('/mock/project/root');
    getFrameworkNameMock.mockResolvedValue('@storybook/react-vite');
    extractProperRendererNameFromFrameworkMock.mockResolvedValue('react');
    existsSyncMock.mockReturnValue(true);
  });

  describe('load function', () => {
    it('should return undefined for non-virtual imports', async () => {
      const plugin = virtualStoriesPlugin({ storybookOptions: mockOptions });
      if (!plugin || Array.isArray(plugin)) {
        throw new Error('Plugin should be a single plugin object');
      }
      const loadFn = plugin.load as (id: string) => Promise<string | undefined>;

      const result = await loadFn('regular-import');
      expect(result).toBeUndefined();
    });

    it('should return undefined for invalid virtual import format', async () => {
      const plugin = virtualStoriesPlugin({ storybookOptions: mockOptions });
      if (!plugin || Array.isArray(plugin)) {
        throw new Error('Plugin should be a single plugin object');
      }
      const loadFn = plugin.load as (id: string) => Promise<string | undefined>;

      const result = await loadFn('virtual:invalid-format');
      expect(result).toBeUndefined();
    });

    it('should return undefined when component file does not exist', async () => {
      const plugin = virtualStoriesPlugin({ storybookOptions: mockOptions });
      if (!plugin || Array.isArray(plugin)) {
        throw new Error('Plugin should be a single plugin object');
      }
      const loadFn = plugin.load as (id: string) => Promise<string | undefined>;

      existsSyncMock.mockReturnValue(false);

      const result = await loadFn('virtual:virtual-stories--src/Button.tsx--Button');
      expect(result).toBeUndefined();
    });

    it('should generate story content for valid virtual import', async () => {
      const plugin = virtualStoriesPlugin({ storybookOptions: mockOptions });
      if (!plugin || Array.isArray(plugin)) {
        throw new Error('Plugin should be a single plugin object');
      }
      const loadFn = plugin.load as (id: string) => Promise<string | undefined>;

      const mockFileInfos = [
        {
          filepath: 'src/Button.tsx',
          exportedComponents: [
            { name: 'Button', default: true },
            { name: 'ButtonProps', default: false },
          ],
          storyFileExists: false,
        },
      ];
      const mockIndexEntries = [
        {
          filepath: 'src/Button.tsx',
          componentName: 'Button',
          isDefaultExport: true,
          storyFileExists: false,
        },
        {
          filepath: 'src/Button.tsx',
          componentName: 'ButtonProps',
          isDefaultExport: false,
          storyFileExists: false,
        },
      ];
      const mockStoryContent = `import type { Meta, StoryObj } from '@storybook/react';

import Button from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};`;

      getComponentFileInfosMock.mockResolvedValue(mockFileInfos);
      createIndexEntriesMock.mockReturnValue(mockIndexEntries);
      getNewStoryFileMock.mockResolvedValue({
        storyFilePath: '/mock/project/root/src/Button.stories.tsx',
        exportedStoryName: 'Default',
        storyFileContent: mockStoryContent,
        dirname: () => '/mock/project/root/src',
      });

      const result = await loadFn('virtual:virtual-stories--src/Button.tsx--Button');

      expect(result).toBe(mockStoryContent);
      expect(getNewStoryFileMock).toHaveBeenCalledWith(
        {
          componentFilePath: 'src/Button.tsx',
          componentExportName: 'Button',
          componentIsDefaultExport: true,
          componentExportCount: 2,
        },
        mockOptions
      );
    });

    it('should handle named exports correctly', async () => {
      const plugin = virtualStoriesPlugin({ storybookOptions: mockOptions });
      if (!plugin || Array.isArray(plugin)) {
        throw new Error('Plugin should be a single plugin object');
      }
      const loadFn = plugin.load as (id: string) => Promise<string | undefined>;

      const mockFileInfos = [
        {
          filepath: 'src/Input.jsx',
          exportedComponents: [{ name: 'Input', default: false }],
          storyFileExists: false,
        },
      ];
      const mockIndexEntries = [
        {
          filepath: 'src/Input.jsx',
          componentName: 'Input',
          isDefaultExport: false,
          storyFileExists: false,
        },
      ];
      const mockStoryContent = `import { Input } from './Input';

const meta = {
  component: Input,
};

export default meta;

export const Default = {};`;

      getComponentFileInfosMock.mockResolvedValue(mockFileInfos);
      createIndexEntriesMock.mockReturnValue(mockIndexEntries);
      getNewStoryFileMock.mockResolvedValue({
        storyFilePath: '/mock/project/root/src/Input.stories.jsx',
        exportedStoryName: 'Default',
        storyFileContent: mockStoryContent,
        dirname: () => '/mock/project/root/src',
      });

      const result = await loadFn('virtual:virtual-stories--src/Input.jsx--Input');

      expect(result).toBe(mockStoryContent);
      expect(getNewStoryFileMock).toHaveBeenCalledWith(
        {
          componentFilePath: 'src/Input.jsx',
          componentExportName: 'Input',
          componentIsDefaultExport: false,
          componentExportCount: 1,
        },
        mockOptions
      );
    });

    it('should handle complex virtual import paths with multiple dashes', async () => {
      const plugin = virtualStoriesPlugin({ storybookOptions: mockOptions });
      if (!plugin || Array.isArray(plugin)) {
        throw new Error('Plugin should be a single plugin object');
      }
      const loadFn = plugin.load as (id: string) => Promise<string | undefined>;

      const mockFileInfos = [
        {
          filepath: 'src/components/my-component.tsx',
          exportedComponents: [{ name: 'MyComponent', default: true }],
          storyFileExists: false,
        },
      ];
      const mockIndexEntries = [
        {
          filepath: 'src/components/my-component.tsx',
          componentName: 'MyComponent',
          isDefaultExport: true,
          storyFileExists: false,
        },
      ];
      const mockStoryContent = dedent`
      import MyComponent from './my-component';

      const meta = {
        component: MyComponent,
      };

      export default meta;

      export const Default = {};`;

      getComponentFileInfosMock.mockResolvedValue(mockFileInfos);
      createIndexEntriesMock.mockReturnValue(mockIndexEntries);
      getNewStoryFileMock.mockResolvedValue({
        storyFilePath: '/mock/project/root/src/components/my-component.stories.tsx',
        exportedStoryName: 'Default',
        storyFileContent: mockStoryContent,
        dirname: () => '/mock/project/root/src/components',
      });

      const result = await loadFn(
        'virtual:virtual-stories--src/components/my-component.tsx--MyComponent'
      );

      expect(result).toBe(mockStoryContent);
      expect(getNewStoryFileMock).toHaveBeenCalledWith(
        {
          componentFilePath: 'src/components/my-component.tsx',
          componentExportName: 'MyComponent',
          componentIsDefaultExport: true,
          componentExportCount: 1,
        },
        mockOptions
      );
    });

    it('should handle errors in story generation gracefully', async () => {
      const plugin = virtualStoriesPlugin({ storybookOptions: mockOptions });
      if (!plugin || Array.isArray(plugin)) {
        throw new Error('Plugin should be a single plugin object');
      }
      const loadFn = plugin.load as (id: string) => Promise<string | undefined>;

      const mockFileInfos = [
        {
          filepath: 'src/Button.tsx',
          exportedComponents: [{ name: 'Button', default: true }],
          storyFileExists: false,
        },
      ];
      const mockIndexEntries = [
        {
          filepath: 'src/Button.tsx',
          componentName: 'Button',
          isDefaultExport: true,
          storyFileExists: false,
        },
      ];

      getComponentFileInfosMock.mockResolvedValue(mockFileInfos);
      createIndexEntriesMock.mockReturnValue(mockIndexEntries);
      getNewStoryFileMock.mockRejectedValue(new Error('Story generation failed'));

      const result = await loadFn('virtual:virtual-stories--src/Button.tsx--Button');

      expect(result).toBeUndefined();
    });
  });
});
