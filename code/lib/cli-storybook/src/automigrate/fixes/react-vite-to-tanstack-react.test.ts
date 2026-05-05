import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import { globby } from 'globby';
import type { JsPackageManager } from 'storybook/internal/common';
import { transformImportFiles } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { writeText } from 'tinyclip';

import type { CheckOptions } from './index.ts';
import {
  REACT_VITE_PACKAGE,
  TANSTACK_REACT_PACKAGE,
  reactViteToTanstackReact,
} from './react-vite-to-tanstack-react.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('globby', { spy: true });
vi.mock('tinyclip', { spy: true });

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
    // Reset default behaviours for spied modules so spies don't call through to real impls.
    mockReadFile.mockResolvedValue('');
    mockWriteFile.mockResolvedValue(undefined);
    vi.mocked(globby).mockResolvedValue([]);
    vi.mocked(writeText).mockResolvedValue(undefined);
    vi.mocked(transformImportFiles).mockResolvedValue([]);
    vi.mocked(logger.step).mockImplementation(() => {});
    vi.mocked(logger.debug).mockImplementation(() => {});
    vi.mocked(logger.warn).mockImplementation(() => {});
    vi.mocked(logger.log).mockImplementation(() => {});
    vi.mocked(logger.error).mockImplementation(() => {});
    vi.mocked(logger.logBox).mockImplementation(() => {});
    vi.mocked(prompt.confirm).mockResolvedValue(false);
    vi.mocked(mockPackageManager.removeDependencies).mockResolvedValue(undefined);
    vi.mocked(mockPackageManager.addDependencies).mockResolvedValue(undefined);
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

      const result = await reactViteToTanstackReact.check({
        packageManager: mockPackageManager,
        previewConfigPath: undefined,
      } as CheckOptions);

      expect(result).toEqual({
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

    it('detects a tanstack router decorator that lives in a separate config file', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [REACT_VITE_PACKAGE]: '^10.0.0',
        '@tanstack/react-router': '^1.0.0',
      });

      vi.mocked(globby).mockResolvedValueOnce([
        '/project/.storybook/preview.tsx',
        '/project/.storybook/decorators.tsx',
      ]);

      // package.json
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          devDependencies: {
            [REACT_VITE_PACKAGE]: '^10.0.0',
            '@tanstack/react-router': '^1.0.0',
          },
        })
      );
      // preview.tsx — only imports the decorator, no router markers itself
      mockReadFile.mockResolvedValueOnce(`
        import { withRouter } from './decorators';
        export const decorators = [withRouter];
      `);
      // decorators.tsx — the actual router setup lives here
      mockReadFile.mockResolvedValueOnce(`
        import { RouterProvider, createRouter, createMemoryHistory } from '@tanstack/react-router';

        export const withRouter = (Story) => {
          const router = createRouter({ history: createMemoryHistory() });
          return <RouterProvider router={router}><Story /></RouterProvider>;
        };
      `);

      const result = await reactViteToTanstackReact.check({
        packageManager: mockPackageManager,
        previewConfigPath: '/project/.storybook/preview.tsx',
        configDir: '/project/.storybook',
        storiesPaths: [],
      } as unknown as CheckOptions);

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
