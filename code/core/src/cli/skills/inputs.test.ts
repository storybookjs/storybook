import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';

import type { Options } from '../../types/index.ts';

import { resolveSkillInputs } from './inputs.ts';

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(existsSync).mockImplementation(memfs.existsSync);
  vi.mocked(readFile).mockImplementation(memfs.promises.readFile as typeof readFile);
  vi.spyOn(process, 'cwd').mockReturnValue('/project');
});

function createMockOptions({
  framework = '@storybook/react-vite',
  configDir,
  presets = {},
}: {
  framework?: string | { name: string };
  configDir?: string;
  presets?: Record<string, () => unknown>;
} = {}): Options {
  return {
    configDir,
    presets: {
      apply: vi.fn(async (key: string, defaultValue?: unknown) => {
        if (key === 'framework') {
          return framework;
        }
        return key in presets ? presets[key]() : defaultValue;
      }),
    },
  } as unknown as Options;
}

describe('resolveSkillInputs', () => {
  it('resolves the framework from a string preset', async () => {
    const options = createMockOptions({ framework: '@storybook/vue3-vite' });

    const inputs = await resolveSkillInputs(options);

    expect(inputs.framework).toBe('@storybook/vue3-vite');
  });

  it('resolves the framework from an object preset', async () => {
    const options = createMockOptions({ framework: { name: '@storybook/nextjs' } });

    const inputs = await resolveSkillInputs(options);

    expect(inputs.framework).toBe('@storybook/nextjs');
  });

  it.each([
    ['/repo/node_modules/@storybook/vue3-vite', '@storybook/vue3-vite'],
    ['C:\\repo\\node_modules\\@storybook\\angular-vite', '@storybook/angular-vite'],
    ['/repo/node_modules/.pnpm/@storybook+react-vite@11.0.0', '@storybook/react-vite'],
  ])('normalizes absolute framework preset %s', async (name, framework) => {
    const inputs = await resolveSkillInputs(createMockOptions({ framework: { name } }));
    expect(inputs.framework).toBe(framework);
  });

  it('spreads the resolved tool availability onto the result', async () => {
    const inputs = await resolveSkillInputs(createMockOptions());

    expect(inputs.moduleGraphSupported).toBe(false);
  });

  it('detects CSF Factories from a preview file that imports definePreview', async () => {
    vol.fromNestedJSON({
      '/project/.storybook/preview.tsx': `import { definePreview } from '@storybook/react-vite';\nexport default definePreview({});`,
    });

    const inputs = await resolveSkillInputs(
      createMockOptions({ configDir: '/project/.storybook' })
    );

    expect(inputs).toMatchObject({
      csfFactories: true,
      previewFile: '.storybook/preview.tsx',
      typescript: true,
    });
  });

  it('reads a plain JavaScript preview as CSF 3', async () => {
    vol.fromNestedJSON({
      '/project/.storybook/preview.js': 'export default { parameters: {} };',
    });

    const inputs = await resolveSkillInputs(
      createMockOptions({ configDir: '/project/.storybook' })
    );

    expect(inputs).toMatchObject({
      csfFactories: false,
      previewFile: '.storybook/preview.js',
      typescript: false,
    });
  });

  it('names the preview file after the main config when the project has none', async () => {
    vol.fromNestedJSON({ '/project/.storybook/main.ts': 'export default {};' });

    const inputs = await resolveSkillInputs(
      createMockOptions({ configDir: '/project/.storybook' })
    );

    expect(inputs).toMatchObject({
      csfFactories: false,
      previewFile: '.storybook/preview.ts',
      typescript: true,
    });
  });

  it('reads the MCP toolsets that main.ts turns on, and all of them without addon-mcp', async () => {
    const toolsets = { dev: false, docs: true, test: true };
    const withAddon = await resolveSkillInputs(
      createMockOptions({ presets: { mcpToolsets: () => toolsets } })
    );
    expect(withAddon.mcpToolsets).toEqual(toolsets);

    const withoutAddon = await resolveSkillInputs(createMockOptions());
    expect(withoutAddon.mcpToolsets).toEqual({ dev: true, docs: true, test: true });
  });

  it('turns every MCP toolset on when addon-mcp rejects its options', async () => {
    const inputs = await resolveSkillInputs(
      createMockOptions({
        presets: {
          mcpToolsets: () => {
            throw new Error('Invalid type: Expected boolean but received "false"');
          },
        },
      })
    );
    expect(inputs.mcpToolsets).toEqual({ dev: true, docs: true, test: true });
  });

  it('marks a project that composes other Storybooks', async () => {
    const composed = await resolveSkillInputs(
      createMockOptions({
        presets: { refs: () => ({ design: { url: 'https://design.example' } }) },
      })
    );
    expect(composed.composed).toBe(true);

    const single = await resolveSkillInputs(createMockOptions());
    expect(single.composed).toBe(false);
  });
});
