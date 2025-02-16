import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { configToCsfFactory } from './config-to-csf-factory';

expect.addSnapshotSerializer({
  serialize: (val: any) => (typeof val === 'string' ? val : val.toString()),
  test: () => true,
});

describe('main/preview codemod: general parsing functionality', () => {
  const transform = async (source: string) =>
    (
      await configToCsfFactory(
        { source, path: 'main.ts' },
        { configType: 'main', frameworkPackage: '@storybook/react-vite' }
      )
    ).trim();

  it('should wrap defineMain call from inline default export', async () => {
    await expect(
      transform(dedent`
        export default {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: ['@storybook/addon-essentials'],
          framework: '@storybook/react-vite',
        };
      `)
    ).resolves.toMatchInlineSnapshot(`
      import { defineMain } from '@storybook/react-vite/node';

      export default defineMain({
        stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-essentials'],
        framework: '@storybook/react-vite',
      });
    `);
  });
  it('should wrap defineMain call from const declared default export', async () => {
    await expect(
      transform(dedent`
        const config = {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: ['@storybook/addon-essentials'],
          framework: '@storybook/react-vite',
        };

        export default config;
      `)
    ).resolves.toMatchInlineSnapshot(`
      import { defineMain } from '@storybook/react-vite/node';

      export default defineMain({
        stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-essentials'],
        framework: '@storybook/react-vite',
      });
    `);
  });

  it('should wrap defineMain call from const declared default export and default export mix', async () => {
    await expect(
      transform(dedent`
        export const tags = [];
        export async function viteFinal(config) { return config };
        const config = {
          framework: '@storybook/react-vite',
        };

        export default config;
      `)
    ).resolves.toMatchInlineSnapshot(`
      import { defineMain } from '@storybook/react-vite/node';

      const config = {
        framework: '@storybook/react-vite',
        tags: [],
        viteFinal: () => {
          return config;
        },
      };

      export default config;
    `);
  });
  it('should wrap defineMain call from named exports format', async () => {
    await expect(
      transform(dedent`
        export function stories() { return ['../src/**/*.stories.@(js|jsx|ts|tsx)'] };
        export const addons = ['@storybook/addon-essentials'];
        export async function viteFinal(config) { return config };
        export const framework = '@storybook/react-vite';
      `)
    ).resolves.toMatchInlineSnapshot(`
      import { defineMain } from '@storybook/react-vite/node';

      export default defineMain({
        stories: () => {
          return ['../src/**/*.stories.@(js|jsx|ts|tsx)'];
        },
        addons: ['@storybook/addon-essentials'],
        viteFinal: () => {
          return config;
        },
        framework: '@storybook/react-vite',
      });
    `);
  });
  it('should not add additional imports if there is already one', async () => {
    const transformed = await transform(dedent`
        import { defineMain } from '@storybook/react-vite/node';
        const config = {};

        export default config;
    `);
    expect(
      transformed.match(/import { defineMain } from '@storybook\/react-vite\/node'/g)
    ).toHaveLength(1);
  });

  it('should leave already transformed code as is', async () => {
    const original = dedent`
      import { defineMain } from '@storybook/react-vite/node';

      export default defineMain({});
    `;
    const transformed = await transform(original);
    expect(transformed).toEqual(original);
  });

  it('should remove legacy main config type imports', async () => {
    await expect(
      transform(dedent`
        import { type StorybookConfig } from '@storybook/react-vite'

        const config: StorybookConfig = {
          stories: []
        };
        export default config;
      `)
    ).resolves.toMatchInlineSnapshot(`
      import { defineMain } from '@storybook/react-vite/node';

      export default defineMain({
        stories: [],
      });
    `);
  });
});

describe('preview specific functionality', () => {
  const transform = async (source: string) =>
    (
      await configToCsfFactory(
        { source, path: 'preview.ts' },
        { configType: 'preview', frameworkPackage: '@storybook/react-vite' }
      )
    ).trim();

  it('should contain a named config export', async () => {
    await expect(
      transform(dedent`
        export default {
          tags: ['test'],
        };
      `)
    ).resolves.toMatchInlineSnapshot(`
      import { definePreview } from '@storybook/react-vite';

      export default definePreview({
        tags: ['test'],
      });
    `);
  });

  it('should remove legacy preview type imports', async () => {
    await expect(
      transform(dedent`
        import type { Preview } from '@storybook/react-vite'

        const preview: Preview = {
          tags: []
        };
        export default preview;
      `)
    ).resolves.toMatchInlineSnapshot(`
      import { definePreview } from '@storybook/react-vite';

      export default definePreview({
        tags: [],
      });
    `);
  });
});
