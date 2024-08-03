import { describe, expect, it, vi } from 'vitest';
import { getNewStoryFile } from './get-new-story-file';
import path from 'node:path';

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
    expect(storyFilePath).toBe(path.join(__dirname, 'src', 'components', 'Page.stories.tsx'));
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
    expect(storyFilePath).toBe(path.join(__dirname, 'src', 'components', 'Page.stories.jsx'));
  });
});
