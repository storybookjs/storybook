import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findConfigFile, getProjectRoot } from 'storybook/internal/common';
import { isCsfFactoryPreview } from 'storybook/internal/csf-tools';
import type { Options } from 'storybook/internal/types';

import * as walk from 'empathic/walk';

import { STORYBOOK_FN_PLACEHOLDER } from './get-dummy-props-for-args';
import { getNewStoryFile } from './get-new-story-file';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/csf-tools', { spy: true });
vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });
vi.mock('empathic/walk', { spy: true });

describe('get-new-story-file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProjectRoot).mockReturnValue(join(__dirname));
    vi.mocked(findConfigFile).mockReturnValue(
      undefined as unknown as ReturnType<typeof findConfigFile>
    );
    vi.mocked(existsSync).mockReturnValue(false);
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
      } as unknown as Options
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

      export const Default: Story = {};
      "
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
      } as unknown as Options
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

      export const Default: Story = {};
      "
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
      } as unknown as Options
    );

    expect(exportedStoryName).toBe('Default');
    expect(storyFileContent).toMatchInlineSnapshot(`
      "import Page from './Page';

      const meta = {
        component: Page,
      };

      export default meta;

      export const Default = {};
      "
    `);
    expect(storyFilePath).toBe(join(__dirname, 'src', 'components', 'Page.stories.jsx'));
  });

  it.only('replaces function placeholder via AST and adds fn import', async () => {
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
            if (val === 'internal_getArgTypesData') {
              return Promise.resolve({
                onClick: { name: 'onClick', type: { name: 'function', required: true } },
              });
            }
          },
        },
      } as unknown as Options
    );

    expect(storyFileContent).toContain("import { fn } from 'storybook/test';");
    expect(storyFileContent).toContain('fn()');
    expect(storyFileContent).not.toContain(STORYBOOK_FN_PLACEHOLDER);
  });

  it('should create a new story file (CSF factory)', async () => {
    const configDir = join(__dirname, '.storybook');
    const previewConfigPath = join(configDir, 'preview.ts');

    vi.mocked(findConfigFile).mockReturnValue(
      previewConfigPath as unknown as ReturnType<typeof findConfigFile>
    );
    vi.mocked(isCsfFactoryPreview).mockReturnValue(true);

    // Make checkForImportsMap return true so we keep the default '#.storybook/preview' import.
    vi.mocked(walk.up).mockReturnValue([configDir] as unknown as ReturnType<typeof walk.up>);
    vi.mocked(existsSync).mockImplementation((path) => path.toString().endsWith('package.json'));
    vi.mocked(readFile).mockImplementation(async (path) => {
      const p = path.toString();
      if (p === previewConfigPath) {
        return 'export default {};';
      }
      if (p.endsWith('package.json')) {
        return JSON.stringify({ imports: {} });
      }
      return '';
    });

    const { exportedStoryName, storyFileContent, storyFilePath } = await getNewStoryFile(
      {
        componentFilePath: 'src/components/Page.tsx',
        componentExportName: 'Page',
        componentIsDefaultExport: false,
        componentExportCount: 1,
      },
      {
        configDir,
        presets: {
          apply: (val: string) => {
            if (val === 'framework') {
              return Promise.resolve('@storybook/nextjs');
            }
            if (val === 'internal_getArgTypesData') {
              return Promise.resolve({
                label: { name: 'label', type: { name: 'string', required: true } },
                answer: { name: 'answer', type: { name: 'number', required: true } },
                onClick: { name: 'onClick', type: { name: 'function', required: true } },
              });
            }
          },
        },
      } as unknown as Options
    );

    expect(exportedStoryName).toBe('Default');
    expect(storyFileContent).toMatchInlineSnapshot(`
      "import preview from '#.storybook/preview';
      import { fn } from 'storybook/test';

      import { Page } from './Page';

      const meta = preview.meta({
        component: Page,
      });

      export const Default = meta.story({
        args: {
          label: 'label',
          answer: 42,
          onClick: fn(),
        },
      });
      "
    `);
    expect(storyFilePath).toBe(join(__dirname, 'src', 'components', 'Page.stories.tsx'));
  });
});
