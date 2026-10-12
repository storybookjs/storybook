import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { babelParse, types as t } from '@storybook/core/babel';

import { getNewStoryFile } from './get-new-story-file';

vi.mock('@storybook/core/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@storybook/core/common')>();
  return {
    ...actual,
    getProjectRoot: vi.fn().mockReturnValue(require('path').join(__dirname)),
  };
});

describe('get-new-story-file', () => {
  it('should create a new story file (TypeScript)', async () => {
    const { exportedStoryName, storyFileContent, storyFilePath } = await getNewStoryFile(
      {
        componentFilePath: 'src/components/Page.tsx',
        componentExportName: 'Page',
        componentIsDefaultExport: false,
        componentExportCount: 1,
      },
      {
        presets: {
          apply: (val: string) => {
            if (val === 'framework') {
              return Promise.resolve('@storybook/nextjs');
            }
          },
        },
      } as any
    );

    expect(exportedStoryName).toBe('Default');
    expect(storyFileContent).toMatchInlineSnapshot(`
      "import type { Meta, StoryObj } from '@storybook/react';

      import { Page } from './Page';

      const meta = {
        component: Page,
      } satisfies Meta<typeof Page>;

      export default meta;

      type Story = StoryObj<typeof meta>;

      export const Default: Story = {};"
    `);
    expect(storyFilePath).toBe(join(__dirname, 'src', 'components', 'Page.stories.tsx'));
  });

  it('should create a new story file (JavaScript)', async () => {
    const { exportedStoryName, storyFileContent, storyFilePath } = await getNewStoryFile(
      {
        componentFilePath: 'src/components/Page.jsx',
        componentExportName: 'Page',
        componentIsDefaultExport: true,
        componentExportCount: 1,
      },
      {
        presets: {
          apply: (val: string) => {
            if (val === 'framework') {
              return Promise.resolve('@storybook/nextjs');
            }
          },
        },
      } as any
    );

    expect(exportedStoryName).toBe('Default');
    expect(storyFileContent).toMatchInlineSnapshot(`
      "import Page from './Page';

      const meta = {
        component: Page,
      };

      export default meta;

      export const Default = {};"
    `);
    expect(storyFilePath).toBe(join(__dirname, 'src', 'components', 'Page.stories.jsx'));
  });

  it('rejects a componentExportName that is not a valid identifier', async () => {
    await expect(
      getNewStoryFile(
        {
          componentFilePath: 'src/stories/Header.jsx',
          componentExportName: "Header } from './Header'; fetch('http://evil'); const t = {x: `",
          componentIsDefaultExport: false,
          componentExportCount: 1,
        },
        {
          presets: {
            apply: (val: string) => {
              if (val === 'framework') {
                return Promise.resolve('@storybook/nextjs');
              }
            },
          },
        } as any
      )
    ).rejects.toThrow(/Invalid componentExportName/);
  });

  it('accepts a non-ASCII componentExportName', async () => {
    const { storyFileContent } = await getNewStoryFile(
      {
        componentFilePath: 'src/components/Café.tsx',
        componentExportName: 'Café',
        componentIsDefaultExport: false,
        componentExportCount: 1,
      },
      {
        presets: {
          apply: (val: string) => {
            if (val === 'framework') {
              return Promise.resolve('@storybook/nextjs');
            }
          },
        },
      } as any
    );

    expect(storyFileContent).toContain('{ Café }');
    expect(storyFileContent).toContain('component: Café');
  });

  it.each([
    '',
    '0Page',
    'My Page',
    'My-Page',
    'a;b',
    'a\nb',
    'foo.bar',
    'class',
    'await',
    'default',
    'eval',
    'arguments',
  ])('rejects an invalid componentExportName %j', async (componentExportName) => {
    await expect(
      getNewStoryFile(
        {
          componentFilePath: 'src/stories/Header.jsx',
          componentExportName,
          componentIsDefaultExport: false,
          componentExportCount: 1,
        },
        {
          presets: {
            apply: (val: string) => {
              if (val === 'framework') {
                return Promise.resolve('@storybook/nextjs');
              }
            },
          },
        } as any
      )
    ).rejects.toThrow(/Invalid componentExportName/);
  });

  it.each(['$Foo', '_Foo'])(
    'accepts a valid componentExportName %j',
    async (componentExportName) => {
      const { storyFileContent } = await getNewStoryFile(
        {
          componentFilePath: 'src/stories/Header.jsx',
          componentExportName,
          componentIsDefaultExport: false,
          componentExportCount: 1,
        },
        {
          presets: {
            apply: (val: string) => {
              if (val === 'framework') {
                return Promise.resolve('@storybook/nextjs');
              }
            },
          },
        } as any
      );

      expect(storyFileContent).toContain(`{ ${componentExportName} }`);
      expect(storyFileContent).toContain(`component: ${componentExportName}`);
    }
  );

  it('sanitizes a hostile component file basename in the default-export branch', async () => {
    const { storyFileContent } = await getNewStoryFile(
      {
        componentFilePath: 'src/x;alert(1);y.tsx',
        componentExportName: 'default',
        componentIsDefaultExport: true,
        componentExportCount: 1,
      },
      {
        presets: {
          apply: (val: string) => {
            if (val === 'framework') {
              return Promise.resolve('@storybook/nextjs');
            }
          },
        },
      } as any
    );

    expect(storyFileContent).toContain('import Xalerty from');
    expect(storyFileContent).toContain('component: Xalerty');
    expect(storyFileContent).toContain('typeof Xalerty');
    expect(storyFileContent).not.toContain('Xalert(1)');
  });

  it('rejects a component file basename that yields no valid import name', async () => {
    await expect(
      getNewStoryFile(
        {
          componentFilePath: 'src/日本.tsx',
          componentExportName: 'default',
          componentIsDefaultExport: true,
          componentExportCount: 1,
        },
        {
          presets: {
            apply: (val: string) => {
              if (val === 'framework') {
                return Promise.resolve('@storybook/nextjs');
              }
            },
          },
        } as any
      )
    ).rejects.toThrow(/Invalid component import name/);
  });

  it('keeps a hostile component file basename inside the import specifier (named export)', async () => {
    const hostileBasename = `Page'; fetch("evil"); const x = '`;
    const { storyFileContent, storyFilePath } = await getNewStoryFile(
      {
        componentFilePath: `src/components/${hostileBasename}.tsx`,
        componentExportName: 'Page',
        componentIsDefaultExport: false,
        componentExportCount: 1,
      },
      {
        presets: {
          apply: (val: string) => {
            if (val === 'framework') {
              return Promise.resolve('@storybook/nextjs');
            }
          },
        },
      } as any
    );

    const { body } = babelParse(storyFileContent).program;
    const importSources = body.flatMap((node) =>
      t.isImportDeclaration(node) ? [node.source.value] : []
    );
    expect(importSources).toEqual(['@storybook/react', `./${hostileBasename}`]);
    expect(body.some((node) => t.isExpressionStatement(node))).toBe(false);
    expect(storyFilePath).toBe(
      join(__dirname, 'src', 'components', `${hostileBasename}.stories.tsx`)
    );
  });

  it('keeps a hostile component file basename inside the import specifier (default export)', async () => {
    const hostileBasename = `Page'; fetch("evil"); const x = '`;
    const { storyFileContent } = await getNewStoryFile(
      {
        componentFilePath: `src/components/${hostileBasename}.jsx`,
        componentExportName: 'default',
        componentIsDefaultExport: true,
        componentExportCount: 1,
      },
      {
        presets: {
          apply: (val: string) => {
            if (val === 'framework') {
              return Promise.resolve('@storybook/nextjs');
            }
          },
        },
      } as any
    );

    const { body } = babelParse(storyFileContent).program;
    const importSources = body.flatMap((node) =>
      t.isImportDeclaration(node) ? [node.source.value] : []
    );
    expect(importSources).toEqual([`./${hostileBasename}`]);
    expect(body.some((node) => t.isExpressionStatement(node))).toBe(false);
  });

  it('imports a component whose file name contains a quote', async () => {
    const { storyFileContent } = await getNewStoryFile(
      {
        componentFilePath: "src/components/it's.tsx",
        componentExportName: 'default',
        componentIsDefaultExport: true,
        componentExportCount: 1,
      },
      {
        presets: {
          apply: (val: string) => {
            if (val === 'framework') {
              return Promise.resolve('@storybook/nextjs');
            }
          },
        },
      } as any
    );

    expect(storyFileContent).toContain("from './it\\'s'");
    const { body } = babelParse(storyFileContent).program;
    const importSources = body.flatMap((node) =>
      t.isImportDeclaration(node) ? [node.source.value] : []
    );
    expect(importSources).toEqual(['@storybook/react', "./it's"]);
  });
});
