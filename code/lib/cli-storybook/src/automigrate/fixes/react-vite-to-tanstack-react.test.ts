import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import { globby } from 'globby';
import type { JsPackageManager } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import { fs, vol } from 'memfs';
import { writeText } from 'tinyclip';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import type { CheckOptions, RunOptions } from '../types.ts';
import {
  REACT_VITE_PACKAGE,
  TANSTACK_REACT_PACKAGE,
  reactViteToTanstackReact,
} from './react-vite-to-tanstack-react.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('globby', { spy: true });
vi.mock('tinyclip', { spy: true });

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
    vol.reset();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vi.mocked(globby).mockResolvedValue([]);
    vi.mocked(writeText).mockResolvedValue(undefined);
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

      const result = await checkFix(reactViteToTanstackReact, {
        packageManager: mockPackageManager,
      } as CheckOptions);

      expect(result).toBeNull();
    });

    it('returns null if no tanstack router package is installed', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [REACT_VITE_PACKAGE]: '^9.0.0',
      });

      const result = await checkFix(reactViteToTanstackReact, {
        packageManager: mockPackageManager,
      } as CheckOptions);

      expect(result).toBeNull();
    });

    it('returns options when both react-vite and a tanstack router package are present', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [REACT_VITE_PACKAGE]: '^10.0.0',
        '@tanstack/react-router': '^1.0.0',
      });

      const result = await checkFix(reactViteToTanstackReact, {
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

      vol.fromJSON({
        '/project/.storybook/preview.tsx': `
        import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';

        export const decorators = [
          (Story) => {
            const router = createRouter({ history: createMemoryHistory() });
            return <RouterProvider router={router}><Story /></RouterProvider>;
          },
        ];
      `,
      });

      const result = await checkFix(reactViteToTanstackReact, {
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

      vol.fromJSON({
        '/project/.storybook/preview.tsx': `
        import { withRouter } from './decorators';
        export const decorators = [withRouter];
      `,
        '/project/.storybook/decorators.tsx': `
        import { RouterProvider, createRouter, createMemoryHistory } from '@tanstack/react-router';

        export const withRouter = (Story) => {
          const router = createRouter({ history: createMemoryHistory() });
          return <RouterProvider router={router}><Story /></RouterProvider>;
        };
      `,
      });

      const result = await checkFix(reactViteToTanstackReact, {
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
    const runOptions = {
      result: { hasTanstackRouterDecorator: false },
      packageManager: mockPackageManager,
      mainConfigPath: '/project/.storybook/main.ts',
      previewConfigPath: '/project/.storybook/preview.tsx',
      storiesPaths: ['/project/src/Button.stories.tsx'],
      configDir: '/project/.storybook',
      storybookVersion: '10.1.0',
    } as Omit<RunOptions<{ hasTanstackRouterDecorator: boolean }>, 'files'>;

    beforeEach(() => {
      vol.fromJSON({
        '/project/.storybook/main.ts': `import { defineMain } from '${REACT_VITE_PACKAGE}/node';\nexport default defineMain({ framework: '${REACT_VITE_PACKAGE}' });`,
        '/project/.storybook/preview.tsx': `import { definePreview } from '${REACT_VITE_PACKAGE}';`,
        '/project/src/Button.stories.tsx': `import type { Meta } from '${REACT_VITE_PACKAGE}';`,
      });
    });

    it('updates dependencies and rewrites the framework package in main config, preview, and stories', async () => {
      await runFix(reactViteToTanstackReact, runOptions);

      expect(mockPackageManager.removeDependencies).toHaveBeenCalledWith([REACT_VITE_PACKAGE]);
      expect(mockPackageManager.addDependencies).toHaveBeenCalledWith(
        { type: 'devDependencies', skipInstall: true },
        [`${TANSTACK_REACT_PACKAGE}@10.1.0`]
      );
      expect(vol.toJSON()).toEqual({
        '/project/.storybook/main.ts': `import { defineMain } from '${TANSTACK_REACT_PACKAGE}/node';\nexport default defineMain({ framework: '${TANSTACK_REACT_PACKAGE}' });`,
        '/project/.storybook/preview.tsx': `import { definePreview } from '${TANSTACK_REACT_PACKAGE}';`,
        '/project/src/Button.stories.tsx': `import type { Meta } from '${TANSTACK_REACT_PACKAGE}';`,
      });
    });

    it('fails without touching dependencies when the main config cannot be read', async () => {
      vol.unlinkSync('/project/.storybook/main.ts');

      await expect(runFix(reactViteToTanstackReact, runOptions)).rejects.toThrow(
        '/project/.storybook/main.ts'
      );
      expect(mockPackageManager.removeDependencies).not.toHaveBeenCalled();
    });

    it('asks the user for an AI prompt when a decorator is detected', async () => {
      vi.mocked(prompt.confirm).mockResolvedValueOnce(true);

      await runFix(reactViteToTanstackReact, {
        ...runOptions,
        result: { hasTanstackRouterDecorator: true },
      });

      expect(prompt.confirm).toHaveBeenCalled();
    });

    it('does not prompt for AI when --yes is passed', async () => {
      await runFix(reactViteToTanstackReact, {
        ...runOptions,
        result: { hasTanstackRouterDecorator: true },
        yes: true,
      });

      expect(prompt.confirm).not.toHaveBeenCalled();
    });
  });
});
