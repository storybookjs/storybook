/* eslint-disable depend/ban-dependencies */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getProjectRoot } from 'storybook/internal/common';

import { addonA11yParameters } from './addon-a11y-parameters';

// Mock dependencies
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('globby', () => ({
  globby: vi.fn(),
}));

vi.mock('storybook/internal/common', () => ({
  commonGlobOptions: vi.fn(),
  getProjectRoot: vi.fn(),
}));

vi.mock('storybook/internal/csf-tools', () => ({
  writeConfig: vi.fn(),
  writeCsf: vi.fn(),
}));

describe('addon-a11y-parameters', () => {
  const mockProjectRoot = '/mock/project/root';
  const mockPreviewFile = '/mock/project/root/.storybook/preview.ts';
  const mockStoryFiles = [
    '/mock/project/root/src/components/Button.stories.ts',
    '/mock/project/root/src/components/Input.stories.ts',
  ];

  beforeEach(() => {
    (getProjectRoot as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockProjectRoot);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('check', () => {
    it('should return null if a11y addon is not installed', async () => {
      const result = await addonA11yParameters.check({
        mainConfig: { addons: [] },
        previewConfigPath: mockPreviewFile,
      } as any);

      expect(result).toBeNull();
    });

    it('should return null if no relevant files are found', async () => {
      const { globby } = await import('globby');
      (globby as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const { readFile } = await import('node:fs/promises');
      (readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('');

      const result = await addonA11yParameters.check({
        mainConfig: { addons: ['@storybook/addon-a11y'] },
        previewConfigPath: mockPreviewFile,
      } as any);

      expect(result).toBeNull();
    });

    it('should return files that need to be updated', async () => {
      const { globby } = await import('globby');
      (globby as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockStoryFiles);
      const { readFile } = await import('node:fs/promises');
      (readFile as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('parameters: { a11y: { element: "#root" } }')
        .mockResolvedValueOnce('parameters: { a11y: { element: "#app" } }')
        .mockResolvedValueOnce('parameters: { a11y: { element: "#main" } }');

      const result = await addonA11yParameters.check({
        mainConfig: { addons: ['@storybook/addon-a11y'] },
        previewConfigPath: mockPreviewFile,
      } as any);

      expect(result).toEqual({
        storyFilesToUpdate: [mockStoryFiles[0], mockStoryFiles[1]],
        previewFileToUpdate: mockPreviewFile,
      });
    });
  });
});
