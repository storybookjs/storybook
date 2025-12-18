import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProjectRoot } from 'storybook/internal/common';

import { generateMockPropsFromDocgen } from './get-mocked-props-for-args';
import { getNewStoryFile } from './get-new-story-file';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('./get-mocked-props-for-args', { spy: true });

describe('get-new-story-file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProjectRoot).mockReturnValue(join(__dirname));
  });

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
      "import type { Meta, StoryObj } from '@storybook/nextjs';

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

  it('should create a new story file (TypeScript) with a framework package using the pnp workaround', async () => {
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
              return Promise.resolve('path/to/@storybook/react-vite');
            }
          },
        },
      } as any
    );

    expect(exportedStoryName).toBe('Default');
    expect(storyFileContent).toMatchInlineSnapshot(`
      "import type { Meta, StoryObj } from '@storybook/react-vite';

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

  it('replaces __function__ and __react_node__ placeholders via AST and adds fn import', async () => {
    vi.mocked(generateMockPropsFromDocgen).mockReturnValue({
      required: {
        onClick: '__function__',
        children: '__react_node__',
      },
    } as any);

    const { storyFileContent } = await getNewStoryFile(
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
            if (val === 'getDocgenData') {
              return Promise.resolve({} as any);
            }
          },
        },
      } as any
    );

    expect(storyFileContent).toContain("import { fn } from 'storybook/test';");
    expect(storyFileContent).toContain('fn()');
    expect(storyFileContent).toContain('<div>Hello world</div>');
    expect(storyFileContent).not.toContain('__function__');
    expect(storyFileContent).not.toContain('__react_node__');
  });

  it('replaces __react_node__ without adding fn import', async () => {
    vi.mocked(generateMockPropsFromDocgen).mockReturnValue({
      required: {
        children: '__react_node__',
      },
    } as any);

    const { storyFileContent } = await getNewStoryFile(
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
            if (val === 'getDocgenData') {
              return Promise.resolve({} as any);
            }
          },
        },
      } as any
    );

    expect(storyFileContent).toContain('<div>Hello world</div>');
    expect(storyFileContent).not.toContain("import { fn } from 'storybook/test';");
  });
});
