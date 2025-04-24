import { readFile, writeFile } from 'node:fs/promises';
import type * as fs from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import type { JsPackageManager, PackageJson } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import type { CheckOptions, Fix } from '../types';
import { removeDocsAutodocs } from './remove-docs-autodocs';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof fs;
  return {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    // Add other fs functions that might be used internally
    lstat: vi.fn().mockResolvedValue({ isFile: () => true }),
    readdir: vi.fn(),
    readlink: vi.fn(),
  };
});

const mockPackageManager = {
  retrievePackageJson: vi.fn().mockResolvedValue({
    dependencies: {},
    devDependencies: {},
  }),
  runPackageCommand: vi.fn(),
} as unknown as JsPackageManager;

const mockPackageJson = {
  dependencies: {},
  devDependencies: {},
} as PackageJson;

const baseCheckOptions: CheckOptions = {
  packageManager: mockPackageManager,
  mainConfig: {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  } as StorybookConfigRaw,
  storybookVersion: '9.0.0',
  configDir: '.storybook',
};

const typedRemoveDocsAutodocs = removeDocsAutodocs as Required<
  Fix<{ autodocs: boolean | 'tag' | undefined }>
>;

describe('check phase', () => {
  it('returns null if no mainConfigPath provided', async () => {
    const result = await typedRemoveDocsAutodocs.check(baseCheckOptions);
    expect(result).toBeNull();
  });

  it('returns null if docs.autodocs not found in config', async () => {
    vi.mocked(readFile).mockResolvedValue(
      Buffer.from(`
          export default {
            stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
            docs: {}
          };
        `)
    );

    const result = await typedRemoveDocsAutodocs.check({
      ...baseCheckOptions,
      mainConfigPath: 'main.ts',
    });
    expect(result).toBeNull();
  });

  it('detects docs.autodocs when present with tag value', async () => {
    vi.mocked(readFile).mockResolvedValue(
      Buffer.from(`
          export default {
            stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
            docs: { autodocs: 'tag' }
          };
        `)
    );

    const result = await typedRemoveDocsAutodocs.check({
      ...baseCheckOptions,
      mainConfigPath: 'main.ts',
    });
    expect(result).toEqual({
      autodocs: 'tag',
    });
  });

  it('detects docs.autodocs when present with true value', async () => {
    vi.mocked(readFile).mockResolvedValue(
      Buffer.from(`
          export default {
            stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
            docs: { autodocs: true }
          };
        `)
    );

    const result = await typedRemoveDocsAutodocs.check({
      ...baseCheckOptions,
      mainConfigPath: 'main.ts',
    });
    expect(result).toEqual({
      autodocs: true,
    });
  });
});

describe('run phase', () => {
  it('removes docs.autodocs field when present with tag value', async () => {
    vi.mocked(readFile).mockImplementation(async (path) => {
      if (path === 'main.ts') {
        return Buffer.from(`
            export default {
              stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
              docs: { 
                autodocs: 'tag',
                defaultName: 'Docs'
              }
            };
          `);
      }
      return Buffer.from('');
    });

    await typedRemoveDocsAutodocs.run({
      result: { autodocs: 'tag' },
      packageManager: mockPackageManager,
      packageJson: mockPackageJson,
      mainConfigPath: 'main.ts',
      storybookVersion: '9.0.0',
      mainConfig: {} as StorybookConfigRaw,
    });

    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(writeFile).toHaveBeenCalledWith('main.ts', expect.any(String));
    expect(vi.mocked(writeFile).mock.calls[0][1]).toMatchInlineSnapshot(`
        "
                    export default {
                      stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
                      docs: {
                        defaultName: 'Docs'
                      }
                    };
                  "
      `);
  });

  it('removes docs.autodocs field and updates preview.js when autodocs is true', async () => {
    vi.mocked(readFile).mockImplementation(async (path) => {
      if (path === 'main.ts') {
        return Buffer.from(`
            export default {
              stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
              docs: { autodocs: true }
            };
          `);
      }
      if (path === 'preview.ts') {
        return Buffer.from(`
            export default {
              tags: ['existing-tag']
            };
          `);
      }
      return Buffer.from('');
    });

    await typedRemoveDocsAutodocs.run({
      result: { autodocs: true },
      packageManager: mockPackageManager,
      packageJson: mockPackageJson,
      mainConfigPath: 'main.ts',
      previewConfigPath: 'preview.ts',
      storybookVersion: '9.0.0',
      mainConfig: {} as StorybookConfigRaw,
    });

    expect(writeFile).toHaveBeenCalledTimes(2);
    expect(writeFile).toHaveBeenCalledWith('main.ts', expect.any(String));
    expect(writeFile).toHaveBeenCalledWith('preview.ts', expect.any(String));
    expect(vi.mocked(writeFile).mock.calls[0][1]).toMatchInlineSnapshot(`
        "
                    export default {
                      stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)']
                    };
                  "
      `);
    expect(vi.mocked(writeFile).mock.calls[1][1]).toMatchInlineSnapshot(`
        "
                    export default {
                      tags: ['existing-tag', 'autodocs']
                    };
                  "
      `);
  });

  it('adds autodocs tag to empty tags array in preview.js when autodocs is true', async () => {
    vi.mocked(readFile).mockImplementation(async (path) => {
      if (path === 'main.ts') {
        return Buffer.from(`
            export default {
              stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
              docs: { autodocs: true }
            };
          `);
      }
      if (path === 'preview.ts') {
        return Buffer.from(`
            export default {
              tags: []
            };
          `);
      }
      return Buffer.from('');
    });

    await typedRemoveDocsAutodocs.run({
      result: { autodocs: true },
      packageManager: mockPackageManager,
      packageJson: mockPackageJson,
      mainConfigPath: 'main.ts',
      previewConfigPath: 'preview.ts',
      storybookVersion: '9.0.0',
      mainConfig: {} as StorybookConfigRaw,
    });

    expect(writeFile).toHaveBeenCalledTimes(2);
    expect(writeFile).toHaveBeenCalledWith('main.ts', expect.any(String));
    expect(writeFile).toHaveBeenCalledWith('preview.ts', expect.any(String));
    expect(vi.mocked(writeFile).mock.calls[0][1]).toMatchInlineSnapshot(`
        "
                    export default {
                      stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)']
                    };
                  "
      `);
    expect(vi.mocked(writeFile).mock.calls[1][1]).toMatchInlineSnapshot(`
        "
                    export default {
                      tags: ["autodocs"]
                    };
                  "
      `);
  });

  it('does nothing in dry run mode', async () => {
    vi.mocked(readFile).mockImplementation(async (path) => {
      if (path === 'main.ts') {
        return Buffer.from(`
            export default {
              stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
              docs: { autodocs: true }
            };
          `);
      }
      if (path === 'preview.ts') {
        return Buffer.from(`
            export default {
              tags: ['existing-tag']
            };
          `);
      }
      return Buffer.from('');
    });

    await typedRemoveDocsAutodocs.run({
      result: { autodocs: true },
      packageManager: mockPackageManager,
      packageJson: mockPackageJson,
      mainConfigPath: 'main.ts',
      previewConfigPath: 'preview.ts',
      storybookVersion: '9.0.0',
      mainConfig: {} as StorybookConfigRaw,
      dryRun: true,
    });

    expect(writeFile).not.toHaveBeenCalled();
  });
});
