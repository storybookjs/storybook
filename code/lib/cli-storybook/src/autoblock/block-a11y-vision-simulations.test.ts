import * as fsp from 'node:fs/promises';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { StorybookConfig } from 'storybook/internal/types';

import { fs as memfs, vol } from 'memfs';

import { blocker } from './block-a11y-vision-simulations.ts';

vi.mock('node:fs/promises', { spy: true });

const check = (addons: StorybookConfig['addons'], files: Record<string, string>) => {
  vol.fromJSON(files);
  const { '/project/.storybook/preview.ts': preview, ...stories } = files;

  return blocker.check({
    packageManager: {} as any,
    mainConfig: { stories: [], addons },
    mainConfigPath: '/project/.storybook/main.ts',
    configDir: '/project/.storybook',
    previewConfigPath: preview === undefined ? undefined : '/project/.storybook/preview.ts',
    storiesPaths: Object.keys(stories),
  });
};

beforeEach(() => {
  vol.reset();
  vi.mocked(fsp.readFile).mockImplementation(memfs.promises.readFile as typeof fsp.readFile);
});

describe('blocks', () => {
  test.each(['protanomaly', 'deuteranomaly', 'tritanomaly'])(
    'when a story pins the removed %s simulation',
    async (vision) => {
      await expect(
        check(['@storybook/addon-a11y'], {
          '/project/src/Button.stories.ts': `export default {}; export const Dim = { globals: { vision: '${vision}' } };`,
          '/project/src/Card.stories.ts': `export default {}; export const Dim = { globals: { vision: 'protanopia' } };`,
        })
      ).resolves.toEqual({ files: ['/project/src/Button.stories.ts'] });
    }
  );

  test('when the meta sets a removed simulation through a local constant', async () => {
    await expect(
      check(['@storybook/addon-a11y'], {
        '/project/src/Button.stories.ts': `
          const globals = { vision: 'deuteranomaly' };
          export default { globals };
          export const Dim = {};
        `,
      })
    ).resolves.toEqual({ files: ['/project/src/Button.stories.ts'] });
  });

  test('when a CSF factory story pins a removed simulation', async () => {
    await expect(
      check(['@storybook/addon-a11y'], {
        '/project/src/Button.stories.ts': `
          import preview from '../.storybook/preview';
          const meta = preview.meta({});
          export const Dim = meta.story({ globals: { vision: 'protanomaly' } });
        `,
      })
    ).resolves.toEqual({ files: ['/project/src/Button.stories.ts'] });
  });

  test('when the preview sets a removed simulation as the initial global', async () => {
    await expect(
      check([{ name: '@storybook/addon-a11y' }], {
        '/project/.storybook/preview.ts': `export default { initialGlobals: { "vision": "deuteranomaly" } };`,
      })
    ).resolves.toEqual({ files: ['/project/.storybook/preview.ts'] });
  });

  test('and lists the files in the order they were given', async () => {
    const files = Object.fromEntries(
      Array.from({ length: 25 }, (_, index) => [
        `/project/src/Story${index}.stories.ts`,
        `export default {}; export const Dim = { globals: { vision: 'protanomaly' } };`,
      ])
    );

    await expect(check(['@storybook/addon-a11y'], files)).resolves.toEqual({
      files: Object.keys(files),
    });
  });
});

describe('does not block', () => {
  test('when every vision global is still available', async () => {
    await expect(
      check(['@storybook/addon-a11y'], {
        '/project/.storybook/preview.ts': `export default { initialGlobals: { vision: undefined } };`,
        '/project/src/Button.stories.ts': `export default {}; export const Dim = { globals: { vision: 'tritanopia' } };`,
      })
    ).resolves.toBe(false);
  });

  test('when a removed simulation only appears in a comment', async () => {
    await expect(
      check(['@storybook/addon-a11y'], {
        '/project/.storybook/preview.ts': `
          // export default { initialGlobals: { vision: 'protanomaly' } };
          export default {};
        `,
        '/project/src/Button.stories.ts': `
          export default {};
          /* globals: { vision: 'protanomaly' } */
          export const Dim = {};
        `,
      })
    ).resolves.toBe(false);
  });

  test('when a removed simulation is the value of an unrelated field', async () => {
    await expect(
      check(['@storybook/addon-a11y'], {
        '/project/src/Eye.stories.ts': `export default {}; export const Dim = { args: { vision: 'protanomaly' } };`,
      })
    ).resolves.toBe(false);
  });

  test('when the accessibility addon is not used', async () => {
    await expect(
      check(['@storybook/addon-docs'], {
        '/project/src/Button.stories.ts': `export default {}; export const Dim = { globals: { vision: 'protanomaly' } };`,
      })
    ).resolves.toBe(false);
  });

  test('when a story file can no longer be read', async () => {
    await expect(
      blocker.check({
        packageManager: {} as any,
        mainConfig: { stories: [], addons: ['@storybook/addon-a11y'] },
        mainConfigPath: '/project/.storybook/main.ts',
        configDir: '/project/.storybook',
        storiesPaths: ['/project/src/Deleted.stories.ts'],
      })
    ).resolves.toBe(false);
  });

  test('when a story file cannot be parsed', async () => {
    await expect(
      check(['@storybook/addon-a11y'], {
        '/project/src/Button.stories.svelte': `<Story name="Dim" globals={{ vision: 'protanomaly' }} />`,
      })
    ).resolves.toBe(false);
  });
});

describe('log', () => {
  test('lists the affected files and the replacements', () => {
    const { title, message, link } = blocker.log({
      files: Array.from({ length: 12 }, (_, index) => `/elsewhere/src/Story${index}.stories.ts`),
    });

    expect(title).toBe('Vision simulations removed from the accessibility addon');
    expect(message).toContain('`protanomaly`, `deuteranomaly` and `tritanomaly`');
    expect(message).toContain('- /elsewhere/src/Story9.stories.ts');
    expect(message).not.toContain('Story10.stories.ts');
    expect(message).toContain('- and 2 more');
    expect(message).toContain('`protanopia`, `deuteranopia` or `tritanopia`');
    expect(link).toContain('#addon-a11y-removed-anomaly-vision-simulations');
  });
});
