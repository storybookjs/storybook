import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import after mocking
import { getProjectRoot } from 'storybook/internal/common';
import type { SupportedRenderers } from 'storybook/internal/types';

import {
  type ComponentFileInfo,
  createComponentIndex,
  createIndexEntries,
  filterFilesWithoutStories,
  findComponentFiles,
  getComponentFileInfos,
} from './component-file-indexer';
import { doesStoryFileExist, getStoryMetadata } from './get-new-story-file';
import { getParser } from './parser';
import { searchFiles } from './search-files';

// Mock dependencies first
vi.mock('storybook/internal/common', async (importOriginal) => {
  const common = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...common,
    getProjectRoot: vi.fn(() => '/mock/project/root'),
  };
});

vi.mock('./get-new-story-file', () => ({
  doesStoryFileExist: vi.fn(),
  getStoryMetadata: vi.fn(),
}));

vi.mock('./parser', () => ({
  getParser: vi.fn(),
}));

vi.mock('./search-files', () => ({
  searchFiles: vi.fn(),
}));

// Mock file system
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

const getProjectRootMock = vi.mocked(getProjectRoot);
const doesStoryFileExistMock = vi.mocked(doesStoryFileExist);
const getStoryMetadataMock = vi.mocked(getStoryMetadata);
const getParserMock = vi.mocked(getParser);
const searchFilesMock = vi.mocked(searchFiles);
const readFileMock = vi.mocked(readFile);

describe('component-file-indexer', () => {
  const mockRendererName = 'react' as SupportedRenderers;
  const mockParser = {
    parse: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getProjectRootMock.mockReturnValue('/mock/project/root');
    getParserMock.mockReturnValue(mockParser);
  });

  describe('findComponentFiles', () => {
    it('should call searchFiles with correct parameters', async () => {
      const mockFiles = ['src/Button.tsx', 'src/Input.tsx'];
      searchFilesMock.mockResolvedValue(mockFiles);

      const result = await findComponentFiles('Button');

      expect(searchFilesMock).toHaveBeenCalledWith({
        searchQuery: 'Button',
        cwd: '/mock/project/root',
      });
      expect(result).toEqual(mockFiles);
    });
  });

  describe('getComponentFileInfos', () => {
    it('should return file info for each file with successful parsing', async () => {
      const mockFiles = ['src/Button.tsx', 'src/Input.tsx'];
      const mockExports = [
        { name: 'Button', default: true },
        { name: 'ButtonProps', default: false },
      ];
      const mockStoryFileName = 'Button.stories';

      getStoryMetadataMock.mockReturnValue({
        storyFileName: mockStoryFileName,
        storyFileExtension: 'tsx',
        isTypescript: true,
      });
      doesStoryFileExistMock.mockReturnValue(false);
      readFileMock.mockResolvedValue('export default function Button() {}');
      mockParser.parse.mockResolvedValue({ exports: mockExports });

      const result = await getComponentFileInfos(mockFiles, mockRendererName);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        filepath: 'src/Button.tsx',
        exportedComponents: mockExports,
        storyFileExists: false,
      });
      expect(result[1]).toEqual({
        filepath: 'src/Input.tsx',
        exportedComponents: mockExports,
        storyFileExists: false,
      });
    });

    it('should handle parsing errors gracefully', async () => {
      const mockFiles = ['src/Invalid.tsx'];
      const mockStoryFileName = 'Invalid.stories';

      getStoryMetadataMock.mockReturnValue({
        storyFileName: mockStoryFileName,
        storyFileExtension: 'tsx',
        isTypescript: true,
      });
      doesStoryFileExistMock.mockReturnValue(false);
      readFileMock.mockResolvedValue('invalid syntax');
      mockParser.parse.mockRejectedValue(new Error('Parse error'));

      const result = await getComponentFileInfos(mockFiles, mockRendererName);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        filepath: 'src/Invalid.tsx',
        exportedComponents: null,
        storyFileExists: false,
      });
    });

    it('should handle files with existing story files', async () => {
      const mockFiles = ['src/Button.tsx'];
      const mockExports = [{ name: 'Button', default: true }];
      const mockStoryFileName = 'Button.stories';

      getStoryMetadataMock.mockReturnValue({
        storyFileName: mockStoryFileName,
        storyFileExtension: 'tsx',
        isTypescript: true,
      });
      doesStoryFileExistMock.mockReturnValue(true);
      readFileMock.mockResolvedValue('export default function Button() {}');
      mockParser.parse.mockResolvedValue({ exports: mockExports });

      const result = await getComponentFileInfos(mockFiles, mockRendererName);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        filepath: 'src/Button.tsx',
        exportedComponents: mockExports,
        storyFileExists: true,
      });
    });
  });

  describe('createIndexEntries', () => {
    it('should create index entries for files without stories', () => {
      const mockFileInfos: ComponentFileInfo[] = [
        {
          filepath: 'src/Button.tsx',
          exportedComponents: [
            { name: 'Button', default: true },
            { name: 'ButtonProps', default: false },
          ],
          storyFileExists: false,
        },
        {
          filepath: 'src/Input.tsx',
          exportedComponents: [{ name: 'Input', default: true }],
          storyFileExists: false,
        },
      ];

      const result = createIndexEntries(mockFileInfos);

      expect(result).toHaveLength(3);
      expect(result).toEqual([
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
        {
          filepath: 'src/Input.tsx',
          componentName: 'Input',
          isDefaultExport: true,
          storyFileExists: false,
        },
      ]);
    });

    it('should skip files that already have story files', () => {
      const mockFileInfos: ComponentFileInfo[] = [
        {
          filepath: 'src/Button.tsx',
          exportedComponents: [{ name: 'Button', default: true }],
          storyFileExists: true, // Has story file
        },
        {
          filepath: 'src/Input.tsx',
          exportedComponents: [{ name: 'Input', default: true }],
          storyFileExists: false,
        },
      ];

      const result = createIndexEntries(mockFileInfos);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        filepath: 'src/Input.tsx',
        componentName: 'Input',
        isDefaultExport: true,
        storyFileExists: false,
      });
    });

    it('should skip files with no exports or parsing errors', () => {
      const mockFileInfos: ComponentFileInfo[] = [
        {
          filepath: 'src/Button.tsx',
          exportedComponents: null, // Parsing error
          storyFileExists: false,
        },
        {
          filepath: 'src/Input.tsx',
          exportedComponents: [], // No exports
          storyFileExists: false,
        },
        {
          filepath: 'src/Valid.tsx',
          exportedComponents: [{ name: 'Valid', default: true }],
          storyFileExists: false,
        },
      ];

      const result = createIndexEntries(mockFileInfos);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        filepath: 'src/Valid.tsx',
        componentName: 'Valid',
        isDefaultExport: true,
        storyFileExists: false,
      });
    });

    it('should return empty array when no valid files', () => {
      const mockFileInfos: ComponentFileInfo[] = [
        {
          filepath: 'src/Button.tsx',
          exportedComponents: null,
          storyFileExists: false,
        },
        {
          filepath: 'src/Input.tsx',
          exportedComponents: [],
          storyFileExists: false,
        },
      ];

      const result = createIndexEntries(mockFileInfos);

      expect(result).toEqual([]);
    });
  });

  describe('filterFilesWithoutStories', () => {
    it('should filter out files that have story files', () => {
      const mockFileInfos: ComponentFileInfo[] = [
        {
          filepath: 'src/Button.tsx',
          exportedComponents: [{ name: 'Button', default: true }],
          storyFileExists: true,
        },
        {
          filepath: 'src/Input.tsx',
          exportedComponents: [{ name: 'Input', default: true }],
          storyFileExists: false,
        },
        {
          filepath: 'src/Modal.tsx',
          exportedComponents: [{ name: 'Modal', default: true }],
          storyFileExists: false,
        },
      ];

      const result = filterFilesWithoutStories(mockFileInfos);

      expect(result).toHaveLength(2);
      expect(result[0].filepath).toBe('src/Input.tsx');
      expect(result[1].filepath).toBe('src/Modal.tsx');
    });

    it('should return all files when none have story files', () => {
      const mockFileInfos: ComponentFileInfo[] = [
        {
          filepath: 'src/Button.tsx',
          exportedComponents: [{ name: 'Button', default: true }],
          storyFileExists: false,
        },
        {
          filepath: 'src/Input.tsx',
          exportedComponents: [{ name: 'Input', default: true }],
          storyFileExists: false,
        },
      ];

      const result = filterFilesWithoutStories(mockFileInfos);

      expect(result).toHaveLength(2);
      expect(result).toEqual(mockFileInfos);
    });

    it('should return empty array when all files have story files', () => {
      const mockFileInfos: ComponentFileInfo[] = [
        {
          filepath: 'src/Button.tsx',
          exportedComponents: [{ name: 'Button', default: true }],
          storyFileExists: true,
        },
        {
          filepath: 'src/Input.tsx',
          exportedComponents: [{ name: 'Input', default: true }],
          storyFileExists: true,
        },
      ];

      const result = filterFilesWithoutStories(mockFileInfos);

      expect(result).toEqual([]);
    });
  });

  describe('createComponentIndex', () => {
    it('should orchestrate the complete indexing process', async () => {
      const mockFiles = ['src/Button.tsx', 'src/Input.tsx'];
      const mockExports = [{ name: 'Button', default: true }];
      const mockStoryFileName = 'Button.stories';

      // Mock the chain of function calls
      searchFilesMock.mockResolvedValue(mockFiles);
      getStoryMetadataMock.mockReturnValue({
        storyFileName: mockStoryFileName,
        storyFileExtension: 'tsx',
        isTypescript: true,
      });
      doesStoryFileExistMock.mockReturnValue(false);
      readFileMock.mockResolvedValue('export default function Button() {}');
      mockParser.parse.mockResolvedValue({ exports: mockExports });

      const result = await createComponentIndex({
        searchQuery: 'Button',
        rendererName: mockRendererName,
      });

      expect(searchFilesMock).toHaveBeenCalledWith({
        searchQuery: 'Button',
        cwd: '/mock/project/root',
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        filepath: 'src/Button.tsx',
        componentName: 'Button',
        isDefaultExport: true,
        storyFileExists: false,
      });
      expect(result[1]).toEqual({
        filepath: 'src/Input.tsx',
        componentName: 'Button',
        isDefaultExport: true,
        storyFileExists: false,
      });
    });

    it('should handle empty search results', async () => {
      searchFilesMock.mockResolvedValue([]);

      const result = await createComponentIndex({
        searchQuery: 'NonExistent',
        rendererName: mockRendererName,
      });

      expect(result).toEqual([]);
    });

    it('should handle files with existing stories', async () => {
      const mockFiles = ['src/Button.tsx'];
      const mockExports = [{ name: 'Button', default: true }];
      const mockStoryFileName = 'Button.stories';

      searchFilesMock.mockResolvedValue(mockFiles);
      getStoryMetadataMock.mockReturnValue({
        storyFileName: mockStoryFileName,
        storyFileExtension: 'tsx',
        isTypescript: true,
      });
      doesStoryFileExistMock.mockReturnValue(true); // Has story file
      readFileMock.mockResolvedValue('export default function Button() {}');
      mockParser.parse.mockResolvedValue({ exports: mockExports });

      const result = await createComponentIndex({
        searchQuery: 'Button',
        rendererName: mockRendererName,
      });

      expect(result).toEqual([]); // Should be empty because file has story
    });
  });
});
