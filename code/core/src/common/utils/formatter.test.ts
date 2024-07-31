import { formatFileContent } from './formatter';
import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';

const mockPrettier = vi.hoisted(() => ({
  resolveConfig: vi.fn(),
  format: vi.fn(),
  version: vi.fn(),
}));

vi.mock('prettier', () => ({
  resolveConfig: mockPrettier.resolveConfig,
  format: mockPrettier.format,
  get version() {
    return mockPrettier.version();
  },
}));

const dummyContent = `
import type { Meta, StoryObj } from '@storybook/nextjs'

import Component from './foo';

  const meta = {
    component: Component
  } satisfies Meta<typeof Component>;

export default meta;

type Story = StoryObj<typeof meta>;
`;

describe('formatter', () => {
  describe('withPrettierConfig', () => {
    const testPath = path.resolve(__dirname, '__tests-formatter__', 'withPrettierConfig');

    describe('prettier', async () => {
      const prettierV3 = await import('prettier');

      it('formats content with prettier', async () => {
        mockPrettier.format.mockImplementation(prettierV3.format);
        mockPrettier.version.mockReturnValue(prettierV3.version);
        mockPrettier.resolveConfig.mockImplementation(prettierV3.resolveConfig);

        const filePath = path.resolve(testPath, 'testFile.ts');

        const result = await formatFileContent(filePath, dummyContent);

        expect(result).toMatchSnapshot();
      });
    });
  });

  describe('withoutPrettierConfigAndWithEditorConfig', () => {
    const testPath = path.resolve(__dirname, '__tests-formatter__', 'withoutPrettierConfig');

    describe('prettier-v3', async () => {
      const prettierV3 = await import('prettier');

      it('formats content with prettier', async () => {
        mockPrettier.format.mockImplementation(prettierV3.format);
        mockPrettier.version.mockReturnValue(prettierV3.version);
        mockPrettier.resolveConfig.mockImplementation(prettierV3.resolveConfig);

        const filePath = path.resolve(testPath, 'testFile.ts');

        const result = await formatFileContent(filePath, dummyContent);

        expect(result).toMatchSnapshot();
      });
    });
  });

  describe('withoutPrettierConfigAndWithEditorConfig', () => {
    const testPath = path.resolve(__dirname, '__tests-formatter__', 'withoutEditorConfig');

    describe('prettier-v3', async () => {
      const prettierV3 = await import('prettier');

      it('formats content with prettier', async () => {
        mockPrettier.format.mockImplementation(prettierV3.format);
        mockPrettier.version.mockReturnValue(prettierV3.version);
        mockPrettier.resolveConfig.mockResolvedValue(null);

        const filePath = path.resolve(testPath, 'testFile.ts');

        const result = await formatFileContent(filePath, dummyContent);

        expect(result).toBe(dummyContent);
      });
    });
  });
});
