import { describe, expect, it, vi } from 'vitest';

import { formatFileContent } from '@storybook/core/common';

import path from 'path';
import { dedent } from 'ts-dedent';

import { storyToCsfFactory } from './story-to-csf-factory';

expect.addSnapshotSerializer({
  serialize: (val: any) => (typeof val === 'string' ? val : val.toString()),
  test: () => true,
});

describe('stories codemod', () => {
  const transform = async (source: string) =>
    formatFileContent(
      'Component.stories.tsx',
      await storyToCsfFactory(
        { source, path: 'Component.stories.tsx' },
        { previewConfigPath: '#.storybook/preview', useSubPathImports: true }
      )
    );
  describe('javascript', () => {
    it('should wrap const declared meta', async () => {
      await expect(
        transform(dedent`
            const meta = { title: 'Component' };
            export default meta;
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from '#.storybook/preview';

        const meta = preview.meta({ title: 'Component' });
      `);
    });

    it('should transform and wrap inline default exported meta', async () => {
      await expect(
        transform(dedent`
            export default { title: 'Component' };
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from '#.storybook/preview';

        const meta = preview.meta({
          title: 'Component',
        });
      `);
    });

    it('should rename meta object to meta if it has a different name', async () => {
      await expect(
        transform(dedent`
            const componentMeta = { title: 'Component' };
            export default componentMeta;
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from '#.storybook/preview';

        const meta = preview.meta({ title: 'Component' });
      `);
    });

    it('should wrap stories in a meta.story method', async () => {
      await expect(
        transform(dedent`
            const componentMeta = { title: 'Component' };
            export default componentMeta;
            export const A = {
              args: { primary: true },
              render: (args) => <Component {...args} />
            };
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from '#.storybook/preview';

        const meta = preview.meta({ title: 'Component' });
        export const A = meta.story({
          args: { primary: true },
          render: (args) => <Component {...args} />,
        });
      `);
    });

    it('should respect existing config imports', async () => {
      await expect(
        transform(dedent`
            import { decorators } from "#.storybook/preview";
            const componentMeta = { title: 'Component' };
            export default componentMeta;
            export const A = {
              args: { primary: true },
              render: (args) => <Component {...args} />
            };
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview, { decorators } from '#.storybook/preview';

        const meta = preview.meta({ title: 'Component' });
        export const A = meta.story({
          args: { primary: true },
          render: (args) => <Component {...args} />,
        });
      `);
    });

    it('should reuse existing default config import name', async () => {
      await expect(
        transform(dedent`
            import previewConfig from "#.storybook/preview";
            const componentMeta = { title: 'Component' };
            export default componentMeta;
            export const A = {
              args: { primary: true },
              render: (args) => <Component {...args} />
            };
          `)
      ).resolves.toMatchInlineSnapshot(`
        import previewConfig from '#.storybook/preview';

        const meta = previewConfig.meta({ title: 'Component' });
        export const A = meta.story({
          args: { primary: true },
          render: (args) => <Component {...args} />,
        });
      `);
    });

    it('if there is an existing local constant called preview, rename storybook preview import', async () => {
      await expect(
        transform(dedent`
            const componentMeta = { title: 'Component' };
            export default componentMeta;
            const preview = {};
            export const A = {
              args: { primary: true },
              render: (args) => <Component {...args} />
            };
          `)
      ).resolves.toMatchInlineSnapshot(`
        import storybookPreview from '#.storybook/preview';

        const meta = storybookPreview.meta({ title: 'Component' });
        const preview = {};
        export const A = meta.story({
          args: { primary: true },
          render: (args) => <Component {...args} />,
        });
      `);
    });

    it('migrate reused properties of other stories from `Story.xyz` to `Story.input.xyz`', async () => {
      await expect(
        transform(dedent`
            export default { title: 'Component' };
            const someData = {};

            export const A = {};
            
            export const B = {
              ...A,
              args: {
                ...A.args,
                ...someData,
              },
            };
            export const C = {
              render: async () => {
                return JSON.stringify({
                  ...A.argTypes,
                  ...B,
                })
              }
            };
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from '#.storybook/preview';

        const meta = preview.meta({
          title: 'Component',
        });

        const someData = {};

        export const A = meta.story({});

        export const B = meta.story({
          ...A.input,
          args: {
            ...A.input.args,
            ...someData,
          },
        });
        export const C = meta.story({
          render: async () => {
            return JSON.stringify({
              ...A.input.argTypes,
              ...B.input,
            });
          },
        });
      `);
    });

    it('does not migrate reused properties from disallowed list', async () => {
      await expect(
        transform(dedent`
            export default { title: 'Component' };
            export const A = {};
            export const B = {
              play: async () => {
                await A.play();
              }
            };
            export const C = A.run;
            export const D = A.extends({});
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from '#.storybook/preview';

        const meta = preview.meta({
          title: 'Component',
        });

        export const A = meta.story({});
        export const B = meta.story({
          play: async () => {
            await A.play();
          },
        });
        export const C = A.run;
        export const D = A.extends({});
      `);
    });

    it('should support non-conventional formats (INCOMPLETE)', async () => {
      const transformed = await transform(dedent`
        import { A as Component } from './Button';
        import * as Stories from './Other.stories';
        import someData from './fixtures'
        export default { 
          component: Component, 
          // not supported yet (story coming from another file)
          args: Stories.A.args
        };
        const data = {};
        export const A = () => {};
        // not supported yet (story as function)
        export function B() { };
        // not supported yet (story redeclared)
        const C = { ...A, args: data, };
        export { C };
        `);

      expect(transformed).toContain('A = meta.story');
      // @TODO: when we support these, uncomment these lines
      // expect(transformed).toContain('B = meta.story');
      // expect(transformed).toContain('C = meta.story');
    });

    it('converts the preview import path based on useSubPathImports flag', async () => {
      const relativeMock = vi.spyOn(path, 'relative').mockReturnValue('../../preview.ts');

      try {
        await expect(
          formatFileContent(
            'Component.stories.tsx',
            await storyToCsfFactory(
              {
                source: dedent`
                  import preview, { extra } from '../../../.storybook/preview';
                  export default {};
                `,
                path: 'Component.stories.tsx',
              },
              { previewConfigPath: '#.storybook/preview', useSubPathImports: true }
            )
          )
        ).resolves.toMatchInlineSnapshot(`
          import preview, { extra } from '#.storybook/preview';

          const meta = preview.meta({});
        `);

        await expect(
          formatFileContent(
            'Component.stories.tsx',
            await storyToCsfFactory(
              {
                source: dedent`
                  import preview, { extra } from '#.storybook/preview';
                  export default {};
                `,
                path: 'Component.stories.tsx',
              },
              { previewConfigPath: '#.storybook/preview', useSubPathImports: false }
            )
          )
        ).resolves.toMatchInlineSnapshot(`
          import preview, { extra } from '../../preview';

          const meta = preview.meta({});
        `);
      } finally {
        relativeMock.mockRestore();
      }
    });

    it('converts CSF1 into CSF4 with render', async () => {
      await expect(
        transform(dedent`
            const meta = { title: 'Component' };
            export default meta;
            export const CSF1Story = () => <div>Hello</div>;
          `)
      ).resolves.toMatchInlineSnapshot(`
        import preview from '#.storybook/preview';

        const meta = preview.meta({ title: 'Component' });
        export const CSF1Story = meta.story({
          render: () => <div>Hello</div>,
        });
      `);
    });
  });

  describe('typescript', () => {
    const inlineMetaSatisfies = dedent`
        import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
  
        export default { title: 'Component', component: Component } satisfies Meta<ComponentProps>;
  
        export const A: CSF3<ComponentProps> = {
          args: { primary: true }
        };
      `;
    it('meta satisfies syntax', async () => {
      await expect(transform(inlineMetaSatisfies)).resolves.toMatchInlineSnapshot(`
        import preview from '#.storybook/preview';

        import { ComponentProps } from './Component';

        const meta = preview.meta({ title: 'Component', component: Component });

        export const A = meta.story({
          args: { primary: true },
        });
      `);
    });

    const inlineMetaAs = dedent`
        import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
  
        export default { title: 'Component', component: Component } as Meta<ComponentProps>;
  
        export const A: CSF3<ComponentProps> = {
          args: { primary: true }
        };
      `;
    it('meta as syntax', async () => {
      await expect(transform(inlineMetaAs)).resolves.toMatchInlineSnapshot(`
        import preview from '#.storybook/preview';

        import { ComponentProps } from './Component';

        const meta = preview.meta({ title: 'Component', component: Component });

        export const A = meta.story({
          args: { primary: true },
        });
      `);
    });
    const metaSatisfies = dedent`
        import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
  
        const meta = { title: 'Component', component: Component } satisfies Meta<ComponentProps>
        export default meta;
  
        export const A: CSF3<ComponentProps> = {
          args: { primary: true }
        };
      `;
    it('meta satisfies syntax', async () => {
      await expect(transform(metaSatisfies)).resolves.toMatchInlineSnapshot(`
        import preview from '#.storybook/preview';

        import { ComponentProps } from './Component';

        const meta = preview.meta({ title: 'Component', component: Component });

        export const A = meta.story({
          args: { primary: true },
        });
      `);
    });

    const metaAs = dedent`
        import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
  
        const meta = { title: 'Component', component: Component } as Meta<ComponentProps>
        export default meta;
  
        export const A: CSF3<ComponentProps> = {
          args: { primary: true }
        };
      `;
    it('meta as syntax', async () => {
      await expect(transform(metaAs)).resolves.toMatchInlineSnapshot(`
        import preview from '#.storybook/preview';

        import { ComponentProps } from './Component';

        const meta = preview.meta({ title: 'Component', component: Component });

        export const A = meta.story({
          args: { primary: true },
        });
      `);
    });

    const storySatisfies = dedent`
        import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
  
        const meta = { title: 'Component', component: Component } as Meta<ComponentProps>
        export default meta;
  
        export const A = {
          args: { primary: true }
        } satisfies CSF3<ComponentProps>;
      `;
    it('story satisfies syntax', async () => {
      await expect(transform(storySatisfies)).resolves.toMatchInlineSnapshot(`
        import preview from '#.storybook/preview';

        import { ComponentProps } from './Component';

        const meta = preview.meta({ title: 'Component', component: Component });

        export const A = meta.story({
          args: { primary: true },
        });
      `);
    });

    const storyAs = dedent`
        import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
  
        const meta = { title: 'Component', component: Component } as Meta<ComponentProps>
        export default meta;
  
        export const A = {
          args: { primary: true }
        } as CSF3<ComponentProps>;
      `;
    it('story as syntax', async () => {
      await expect(transform(storyAs)).resolves.toMatchInlineSnapshot(`
        import preview from '#.storybook/preview';

        import { ComponentProps } from './Component';

        const meta = preview.meta({ title: 'Component', component: Component });

        export const A = meta.story({
          args: { primary: true },
        });
      `);
    });

    it('should yield the same result to all syntaxes', async () => {
      const allSnippets = await Promise.all([
        transform(inlineMetaSatisfies),
        transform(inlineMetaAs),
        transform(metaSatisfies),
        transform(metaAs),
        transform(storySatisfies),
        transform(storyAs),
      ]);

      allSnippets.forEach((result) => {
        expect(result).toEqual(allSnippets[0]);
      });
    });

    it('should remove unused Story types', async () => {
      await expect(
        transform(
          `import { Meta, StoryObj as CSF3 } from '@storybook/react';
        import { ComponentProps } from './Component';
  
        export default {};
        type Story = StoryObj<typeof ComponentProps>;

        export const A: Story = {};`
        )
      ).resolves.toMatchInlineSnapshot(`
        import preview from '#.storybook/preview';

        import { ComponentProps } from './Component';

        const meta = preview.meta({});

        export const A = meta.story({});
      `);
    });
  });
});
