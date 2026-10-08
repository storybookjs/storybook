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
}: {
  framework?: string | { name: string };
  configDir?: string;
} = {}): Options {
  return {
    configDir,
    presets: {
      apply: vi.fn(async (key: string, defaultValue?: unknown) => {
        if (key === 'framework') {
          return framework;
        }
        return defaultValue;
      }),
    },
  } as unknown as Options;
}

describe('resolveSkillInputs', () => {
  it('resolves the framework and its mapped renderer from a string preset', async () => {
    const options = createMockOptions({ framework: '@storybook/vue3-vite' });

    const inputs = await resolveSkillInputs(options);

    expect(inputs.framework).toBe('@storybook/vue3-vite');
    expect(inputs.renderer).toBe('@storybook/vue3');
  });

  it('resolves the framework from an object preset', async () => {
    const options = createMockOptions({ framework: { name: '@storybook/nextjs' } });

    const inputs = await resolveSkillInputs(options);

    expect(inputs.framework).toBe('@storybook/nextjs');
    expect(inputs.renderer).toBe('@storybook/react');
  });

  it.each([
    ['/repo/node_modules/@storybook/vue3-vite', '@storybook/vue3-vite', '@storybook/vue3'],
    [
      'C:\\repo\\node_modules\\@storybook\\angular-vite',
      '@storybook/angular-vite',
      '@storybook/angular',
    ],
    [
      '/repo/node_modules/.pnpm/@storybook+react-vite@11.0.0',
      '@storybook/react-vite',
      '@storybook/react',
    ],
  ])('normalizes absolute framework preset %s', async (name, framework, renderer) => {
    const inputs = await resolveSkillInputs(createMockOptions({ framework: { name } }));
    expect(inputs).toMatchObject({ framework, renderer });
  });

  it('leaves renderer undefined for an unmapped framework', async () => {
    const options = createMockOptions({ framework: '@storybook/some-unmapped-framework' });

    const inputs = await resolveSkillInputs(options);

    expect(inputs.framework).toBe('@storybook/some-unmapped-framework');
    expect(inputs.renderer).toBeUndefined();
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
    });
  });
});
