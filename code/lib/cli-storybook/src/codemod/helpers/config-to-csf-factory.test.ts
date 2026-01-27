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
  it('should wrap defineMain call from const declared default export with different type annotations', async () => {
    const typedVariants = [
      'export default config;',
      'export default config satisfies StorybookConfig;',
      'export default config as StorybookConfig;',
      'export default config as unknown as StorybookConfig;',
    ];

    for (const variant of typedVariants) {
      await expect(
        transform(dedent`
          const config = {
            stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
            addons: ['@storybook/addon-essentials'],
            framework: '@storybook/react-vite',
          };

          ${variant}
        `)
      ).resolves.toMatchInlineSnapshot(`
        import { defineMain } from '@storybook/react-vite/node';

        export default defineMain({
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: ['@storybook/addon-essentials'],
          framework: '@storybook/react-vite',
        });
      `);
    }
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

      export default defineMain({
        tags: [],
        viteFinal: () => {
          return config;
        },
        framework: '@storybook/react-vite',
      });
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

  it('should remove legacy main config type imports if unused', async () => {
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

  it('should not remove legacy main config type imports if used', async () => {
    await expect(
      transform(dedent`
        import { type StorybookConfig } from '@storybook/react-vite'

        const config: StorybookConfig = {
          stories: []
        };

        const features: StorybookConfig['features'] = {
          foo: true,
        };

        export default config;
      `)
    ).resolves.toMatchInlineSnapshot(`
      import { type StorybookConfig } from '@storybook/react-vite';
      import { defineMain } from '@storybook/react-vite/node';

      const features: StorybookConfig['features'] = {
        foo: true,
      };

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

  it('should not change non story exports', async () => {
    await expect(
      transform(dedent`
        import type { Preview } from '@storybook/react-vite'
        
        export const withStore: Decorator = () => {}

        const preview: Preview = {
          tags: []
        };
        export default preview;
      `)
    ).resolves.toMatchInlineSnapshot(`
      import { definePreview } from '@storybook/react-vite';

      export const withStore: Decorator = () => {};

      export default definePreview({
        tags: [],
      });
    `);
  });
  it('should wrap definePreview for mixed annotations and default export', async () => {
    await expect(
      transform(dedent`
        export const decorators = [1]
        export default {
          parameters: {},
        }
      `)
    ).resolves.toMatchInlineSnapshot(`
      import { definePreview } from '@storybook/react-vite';

      export default definePreview({
        decorators: [1],
        parameters: {},
      });
    `);
  });

  it('should wrap definePreview for const defined preview with type annotations', async () => {
    await expect(
      transform(dedent`
        import { type Preview } from '@storybook/react-vite';

        const preview = {
          decorators: [],
          
          parameters: {
            options: {}
          }
        } satisfies Preview;

        export default preview;

      `)
    ).resolves.toMatchInlineSnapshot(`
      import { definePreview } from '@storybook/react-vite';

      export default definePreview({
        decorators: [],

        parameters: {
          options: {},
        },
      });
    `);
  });

  it('should wrap definePreview for mixed annotations and default const export', async () => {
    await expect(
      transform(dedent`
        import { type Preview } from '@storybook/react-vite';
        export const decorators = []
        const preview = {

          parameters: {
            options: {}
          }
        } satisfies Preview;

        export default preview;

      `)
    ).resolves.toMatchInlineSnapshot(`
      import { definePreview } from '@storybook/react-vite';

      export default definePreview({
        decorators: [],

        parameters: {
          options: {},
        },
      });
    `);
  });

  it('should add default export when preview only has side-effect imports', async () => {
    await expect(
      transform(dedent`
        import './preview.scss'
      `)
    ).resolves.toMatchInlineSnapshot(`
      import { definePreview } from '@storybook/react-vite';

      import './preview.scss';

      export default definePreview({});
    `);
  });

  it('should add default export when preview file is empty', async () => {
    await expect(transform('')).resolves.toMatchInlineSnapshot(`
      import { definePreview } from '@storybook/react-vite';

      export default definePreview({});
    `);
  });

  it('should add default export when preview only has multiple side-effect imports', async () => {
    await expect(
      transform(dedent`
        import './preview.scss'
        import './global.css'
      `)
    ).resolves.toMatchInlineSnapshot(`
      import { definePreview } from '@storybook/react-vite';

      import './preview.scss';
      import './global.css';

      export default definePreview({});
    `);
  });
});
