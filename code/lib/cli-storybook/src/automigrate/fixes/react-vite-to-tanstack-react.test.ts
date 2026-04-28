import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';

import type { CheckOptions } from './index.ts';
import {
  REACT_VITE_PACKAGE,
  TANSTACK_REACT_PACKAGE,
  reactViteToTanstackReact,
} from './react-vite-to-tanstack-react.ts';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    step: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    logBox: vi.fn(),
  },
  prompt: {
    confirm: vi.fn(),
  },
}));

vi.mock('storybook/internal/common', () => ({
  transformImportFiles: vi.fn().mockResolvedValue([]),
}));

vi.mock('globby', () => ({
  globby: vi.fn().mockResolvedValue([]),
}));

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);

describe('react-vite-to-tanstack-react', () => {
  const mockPackageManager = {
    getAllDependencies: vi.fn(),
    packageJsonPaths: ['/project/package.json'],
    removeDependencies: vi.fn().mockResolvedValue(undefined),
    addDependencies: vi.fn().mockResolvedValue(undefined),
    getDependencyVersion: vi.fn(),
  } as unknown as JsPackageManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockPackageManager.removeDependencies).mockResolvedValue(undefined);
    vi.mocked(mockPackageManager.addDependencies).mockResolvedValue(undefined);
    vi.mocked(prompt.confirm).mockResolvedValue(false);
  });

  describe('check function', () => {
    it('returns null if @storybook/react-vite is not installed', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        '@tanstack/react-router': '^1.0.0',
      });

      const result = await reactViteToTanstackReact.check({
        packageManager: mockPackageManager,
      } as CheckOptions);

      expect(result).toBeNull();
    });

    it('returns null if no tanstack router package is installed', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [REACT_VITE_PACKAGE]: '^9.0.0',
      });

      const result = await reactViteToTanstackReact.check({
        packageManager: mockPackageManager,
      } as CheckOptions);

      expect(result).toBeNull();
    });

    it('returns options when both react-vite and a tanstack router package are present', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [REACT_VITE_PACKAGE]: '^10.0.0',
        '@tanstack/react-router': '^1.0.0',
      });

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          devDependencies: {
            [REACT_VITE_PACKAGE]: '^10.0.0',
            '@tanstack/react-router': '^1.0.0',
          },
        })
      );

      const result = await reactViteToTanstackReact.check({
        packageManager: mockPackageManager,
        previewConfigPath: undefined,
      } as CheckOptions);

      expect(result).toEqual({
        hasReactVitePackage: true,
        hasTanstackRouter: true,
        packageJsonFiles: ['/project/package.json'],
        hasTanstackRouterDecorator: false,
      });
    });

    it('detects a manual tanstack router decorator in the preview config', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [REACT_VITE_PACKAGE]: '^10.0.0',
        '@tanstack/react-router': '^1.0.0',
      });

      // First read: package.json
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          devDependencies: {
            [REACT_VITE_PACKAGE]: '^10.0.0',
            '@tanstack/react-router': '^1.0.0',
          },
        })
      );
      // Second read: preview file
      mockReadFile.mockResolvedValueOnce(`
        import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';

        export const decorators = [
          (Story) => {
            const router = createRouter({ history: createMemoryHistory() });
            return <RouterProvider router={router}><Story /></RouterProvider>;
          },
        ];
      `);

      const result = await reactViteToTanstackReact.check({
        packageManager: mockPackageManager,
        previewConfigPath: '/project/.storybook/preview.tsx',
      } as CheckOptions);

      expect(result?.hasTanstackRouterDecorator).toBe(true);
    });
  });

  describe('prompt function', () => {
    it('mentions both packages', () => {
      const message = reactViteToTanstackReact.prompt();
      expect(message).toContain(REACT_VITE_PACKAGE);
      expect(message).toContain(TANSTACK_REACT_PACKAGE);
    });
  });

  describe('run function', () => {
    it('updates dependencies and rewrites the framework string in main config', async () => {
      mockReadFile.mockResolvedValueOnce(`
        import { defineMain } from '${REACT_VITE_PACKAGE}/node';
        export default defineMain({ framework: '${REACT_VITE_PACKAGE}' });
      `);

      await reactViteToTanstackReact.run!({
        result: {
          hasReactVitePackage: true,
          hasTanstackRouter: true,
          packageJsonFiles: ['/project/package.json'],
          hasTanstackRouterDecorator: false,
        },
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        previewConfigPath: '/project/.storybook/preview.tsx',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '10.1.0',
      } as any);

      expect(mockPackageManager.removeDependencies).toHaveBeenCalledWith([REACT_VITE_PACKAGE]);
      expect(mockPackageManager.addDependencies).toHaveBeenCalledWith(
        { type: 'devDependencies', skipInstall: true },
        [`${TANSTACK_REACT_PACKAGE}@10.1.0`]
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/project/.storybook/main.ts',
        expect.stringContaining(TANSTACK_REACT_PACKAGE)
      );
      // Ensure no leftover @storybook/react-vite reference (handles CSF factories /node export too)
      const writtenContent = mockWriteFile.mock.calls[0]?.[1] as string;
      expect(writtenContent).not.toContain(REACT_VITE_PACKAGE);
      expect(writtenContent).toContain(`${TANSTACK_REACT_PACKAGE}/node`);
    });

    it('skips writes in dry run mode', async () => {
      await reactViteToTanstackReact.run!({
        result: {
          hasReactVitePackage: true,
          hasTanstackRouter: true,
          packageJsonFiles: ['/project/package.json'],
          hasTanstackRouterDecorator: false,
        },
        dryRun: true,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        previewConfigPath: '/project/.storybook/preview.tsx',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '10.1.0',
      } as any);

      expect(mockPackageManager.removeDependencies).not.toHaveBeenCalled();
      expect(mockPackageManager.addDependencies).not.toHaveBeenCalled();
    });

    it('asks the user for an AI prompt when a decorator is detected', async () => {
      vi.mocked(prompt.confirm).mockResolvedValueOnce(true);

      mockReadFile.mockResolvedValueOnce('export default {};');

      await reactViteToTanstackReact.run!({
        result: {
          hasReactVitePackage: true,
          hasTanstackRouter: true,
          packageJsonFiles: ['/project/package.json'],
          hasTanstackRouterDecorator: true,
        },
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        previewConfigPath: '/project/.storybook/preview.tsx',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '10.1.0',
      } as any);

      expect(prompt.confirm).toHaveBeenCalled();
    });

    it('does not prompt for AI when --yes is passed', async () => {
      mockReadFile.mockResolvedValueOnce('export default {};');

      await reactViteToTanstackReact.run!({
        result: {
          hasReactVitePackage: true,
          hasTanstackRouter: true,
          packageJsonFiles: ['/project/package.json'],
          hasTanstackRouterDecorator: true,
        },
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        previewConfigPath: '/project/.storybook/preview.tsx',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '10.1.0',
        yes: true,
      } as any);

      expect(prompt.confirm).not.toHaveBeenCalled();
    });
  });
});
