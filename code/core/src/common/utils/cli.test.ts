import { describe, expect, it, vi } from 'vitest';

import { createLogStream, isCorePackage } from './cli';

describe('UTILS', () => {
  describe.each([
    ['@storybook/react', true],
    ['storybook', true],
    ['@storybook/linter-config', false],
    ['@storybook/design-system', false],
    ['@storybook/addon-styling', false],
    ['@storybook/addon-styling-webpack', false],
    ['@storybook/addon-webpack5-compiler-swc', false],
    ['@storybook/addon-webpack5-compiler-babel', false],
    ['@nx/storybook', false],
    ['@nrwl/storybook', false],
  ])('isCorePackage', (input, output) => {
    it(`It should return "${output}" when given "${input}"`, () => {
      expect(isCorePackage(input)).toEqual(output);
    });
  });
  describe('createLogStream', () => {
    it('should create a log stream and move file successfully', async () => {
      const { logStream, moveLogFile, readLogFile, removeLogFile } =
        await createLogStream('test.log');
      logStream.write('test log content');
      logStream.end();
      await new Promise((resolve) => logStream.once('finish', () => resolve(null)));
      await moveLogFile();
      const content = await readLogFile();
      expect(content).toBe('test log content');
      await removeLogFile();
    });
    it('should handle EXDEV error while moving and fallback to copy + delete', async () => {
      const { logStream, moveLogFile, readLogFile, removeLogFile } =
        await createLogStream('test-exdev.log');
      logStream.write('exdev test content');
      logStream.end();
      await new Promise((resolve) => logStream.once('finish', () => resolve(null)));
      const mockRename = vi.fn().mockRejectedValue({ code: 'EXDEV' });
      vi.doMock('node:fs/promises', async () => {
        const actual = await vi.importActual('node:fs/promises');
        return {
          ...actual,
          rename: mockRename,
        };
      });
      vi.waitFor(() => expect(mockRename).toHaveBeenCalledTimes(1));
      await moveLogFile();
      const content = await readLogFile();
      expect(content).toBe('exdev test content');
      await removeLogFile();
      vi.clearAllMocks();
    });
  });
});
