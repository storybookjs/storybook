import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import prompts from 'prompts';

import { storybookTestMigration } from './storybook-test-migration';

// Mock fs promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

// Mock prompts
vi.mock('prompts', () => ({
  default: vi.fn(),
}));

// Mock globby
vi.mock('globby', () => ({
  globby: vi.fn(),
}));

vi.mock('picocolors', () => ({
  default: {
    magenta: vi.fn().mockImplementation((text) => text),
    yellow: vi.fn().mockImplementation((text) => text),
  },
}));

describe('storybook-test-migration', () => {
  const mockPackageManager = {
    getPackageVersion: vi.fn(),
    removeDependencies: vi.fn(),
    type: 'npm',
    getPackageJson: vi.fn(),
  } as unknown as JsPackageManager;

  const mockConfigDir = '.storybook';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null if @storybook/test is not in dependencies', async () => {
    vi.mocked(mockPackageManager.getPackageVersion).mockResolvedValue(null);

    const result = await storybookTestMigration.check({
      packageManager: mockPackageManager,
      configDir: mockConfigDir,
    } as any);

    expect(result).toBeNull();
  });

  it('should return migration result if @storybook/test is in dependencies', async () => {
    vi.mocked(mockPackageManager.getPackageVersion).mockResolvedValue('^7.0.0');

    const result = await storybookTestMigration.check({
      packageManager: mockPackageManager,
      configDir: mockConfigDir,
    } as any);

    expect(result).toEqual({
      hasDependency: true,
      defaultGlob: '{.storybook/**/*,**/*.{stories.*,test.*}}',
    });
  });

  it('should show the correct prompt message', () => {
    const result = {
      hasDependency: true,
      defaultGlob: '{.storybook/**/*,**/*.{stories.*,test.*}}',
    };

    const prompt = storybookTestMigration.prompt(result);
    expect(prompt).toMatchSnapshot();
  });

  it('should remove @storybook/test dependency and update imports', async () => {
    // Mock package.json
    vi.mocked(mockPackageManager.getPackageVersion).mockResolvedValue('^7.0.0');

    // Mock globby to return test files
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    (globby as any).mockResolvedValue(['test1.ts', 'test2.ts']);

    // Mock prompts to return default glob
    (prompts as any).mockResolvedValue({ glob: '{.storybook/**/*,**/*.{stories.*,test.*}}' });

    // Mock file contents
    (readFile as any).mockResolvedValue('import { expect } from "@storybook/test";');

    // Run the migration
    await storybookTestMigration.run?.({
      packageManager: mockPackageManager,
      dryRun: false,
      result: {
        hasDependency: true,
        defaultGlob: '{.storybook/**/*,**/*.{stories.*,test.*}}',
      },
    } as any);

    // Verify dependency removal
    expect(mockPackageManager.removeDependencies).toHaveBeenCalledWith({}, ['@storybook/test']);

    // Verify file updates
    expect(writeFile).toHaveBeenCalledWith('test1.ts', 'import { expect } from "storybook/test";');
    expect(writeFile).toHaveBeenCalledWith('test2.ts', 'import { expect } from "storybook/test";');
  });

  it('should handle dry run mode', async () => {
    // Mock package.json
    vi.mocked(mockPackageManager.getPackageVersion).mockResolvedValue('^7.0.0');

    // Mock globby to return test files
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    (globby as any).mockResolvedValue(['test1.ts']);

    // Mock prompts to return default glob
    (prompts as any).mockResolvedValue({ glob: '{.storybook/**/*,**/*.{stories.*,test.*}}' });

    // Mock file contents
    (readFile as any).mockResolvedValue('import { expect } from "@storybook/test";');

    // Run the migration in dry run mode
    await storybookTestMigration.run?.({
      packageManager: mockPackageManager,
      dryRun: true,
      result: {
        hasDependency: true,
        defaultGlob: '{.storybook/**/*,**/*.{stories.*,test.*}}',
      },
    } as any);

    // Verify no changes were made
    expect(mockPackageManager.removeDependencies).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should handle different quote styles in imports', async () => {
    // Mock package.json
    vi.mocked(mockPackageManager.getPackageVersion).mockResolvedValue('^7.0.0');

    // Mock globby to return test files
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    (globby as any).mockResolvedValue(['test1.ts']);

    // Mock prompts to return default glob
    (prompts as any).mockResolvedValue({ glob: '{.storybook/**/*,**/*.{stories.*,test.*}}' });

    // Mock file contents with different quote styles
    (readFile as any).mockResolvedValue(
      'import { expect } from "@storybook/test";\nimport { expect } from \'@storybook/test\';'
    );

    // Run the migration
    await storybookTestMigration.run?.({
      packageManager: mockPackageManager,
      dryRun: false,
      result: {
        hasDependency: true,
        defaultGlob: '{.storybook/**/*,**/*.{stories.*,test.*}}',
      },
    } as any);

    // Verify quote styles were preserved
    expect(writeFile).toHaveBeenCalledWith(
      'test1.ts',
      'import { expect } from "storybook/test";\nimport { expect } from \'storybook/test\';'
    );
  });
});
