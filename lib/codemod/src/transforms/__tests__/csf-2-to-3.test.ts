import { describe, expect, it } from 'vitest';

import ansiRegex from 'ansi-regex';
import type { API } from 'jscodeshift';
import { dedent } from 'ts-dedent';

import _transform from '../csf-2-to-3';

expect.addSnapshotSerializer({
  serialize: (val: any) => (typeof val === 'string' ? val : val.toString()),
  test: () => true,
});

const jsTransform = async (source: string) =>
  (await _transform({ source, path: 'Component.stories.jsx' }, {} as API, {})).trim();
const tsTransform = async (source: string) =>
  (
    await _transform({ source, path: 'Component.stories.tsx' }, {} as API, {
      parser: 'tsx',
    })
  ).trim();

describe('csf-2-to-3', () => {
  describe('javascript', () => {
    it('should replace non-simple function exports with objects', async () => {
      await expect(
        jsTransform(dedent`
          export default { title: 'Cat' };
          export const A = () => <Cat />;
          export const B = (args) => <Button {...args} />;
        `)
      ).resolves.toMatchInlineSnapshot(`
        export default { title: 'Cat' };
        export const A = () => <Cat />;
        export const B = {
          render: (args) => <Button {...args} />,
        };
      `);
    });

    it('should move annotations into story objects', async () => {
      await expect(
        jsTransform(dedent`
          export default { title: 'Cat' };

          export const A = () => <Cat />;
          A.storyName = 'foo';
          A.parameters = { bar: 2 };
          A.play = () => {};
        `)
      ).resolves.toMatchInlineSnapshot(`
        export default { title: 'Cat' };

        export const A = {
          render: () => <Cat />,
          name: 'foo',
          parameters: { bar: 2 },
          play: () => {},
        };
      `);
    });

    it('should ignore non-story exports, statements', async () => {
      await expect(
        jsTransform(dedent`
          export default { title: 'components/Fruit', includeStories: ['A'] };

          export const A = (args) => <Apple {...args} />;

          export const B = (args) => <Banana {...args} />;

          const C = (args) => <Cherry {...args} />;
        `)
      ).resolves.toMatchInlineSnapshot(`
        export default { title: 'components/Fruit', includeStories: ['A'] };

        export const A = {
          render: (args) => <Apple {...args} />,
        };

        export const B = (args) => <Banana {...args} />;

        const C = (args) => <Cherry {...args} />;
      `);
    });

    it('should do nothing when there is no meta', async () => {
      await expect(
        jsTransform(dedent`
          export const A = () => <Apple />;

          export const B = (args) => <Banana {...args} />;
        `)
      ).resolves.toMatchInlineSnapshot(`
        export const A = () => <Apple />;

        export const B = (args) => <Banana {...args} />;
      `);
    });

    it('should remove implicit global render function (react)', async () => {
      await expect(
        jsTransform(dedent`
          export default { title: 'Cat', component: Cat };
          export const A = (args) => <Cat {...args} />;
          export const B = (args) => <Banana {...args} />;
        `)
      ).resolves.toMatchInlineSnapshot(`
        export default { title: 'Cat', component: Cat };
        export const A = {};
        export const B = {
          render: (args) => <Banana {...args} />,
        };
      `);
    });

    it('should ignore object exports', async () => {
      await expect(
        jsTransform(dedent`
          export default { title: 'Cat', component: Cat };

          export const A = {
            render: (args) => <Cat {...args} />
          };
        `)
      ).resolves.toMatchInlineSnapshot(`
        export default { title: 'Cat', component: Cat };

        export const A = {
          render: (args) => <Cat {...args} />,
        };
      `);
    });

    it('should hoist template.bind (if there is only one)', async () => {
      await expect(
        jsTransform(dedent`
          export default { title: 'Cat' };
          const Template = (args) => <Cat {...args} />;
          export const A = Template.bind({});
          A.args = { isPrimary: false };
        `)
      ).resolves.toMatchInlineSnapshot(`
        export default { title: 'Cat' };
        const Template = (args) => <Cat {...args} />;

        export const A = {
          render: Template,
          args: { isPrimary: false },
        };
      `);
    });

    it('should reuse the template when there are multiple Template.bind references but no component defined', async () => {
      await expect(
        jsTransform(dedent`
          export default { title: 'Cat' };
          const Template = (args) => <Cat {...args} />;

          export const A = Template.bind({});
          A.args = { isPrimary: false };
          
          export const B = Template.bind({});
          B.args = { isPrimary: true };
          
                    
          export const C = Template.bind({});
          C.args = { bla: true };
          
          export const D = Template.bind({});
          D.args = { bla: false };
        `)
      ).resolves.toMatchInlineSnapshot(`
        export default { title: 'Cat' };
        const Template = (args) => <Cat {...args} />;

        export const A = {
          render: Template,
          args: { isPrimary: false },
        };

        export const B = {
          render: Template,
          args: { isPrimary: true },
        };

        export const C = {
          render: Template,
          args: { bla: true },
        };

        export const D = {
          render: Template,
          args: { bla: false },
        };
      `);
    });

    it('should remove implicit global render for template.bind', async () => {
      await expect(
        jsTransform(dedent`
          export default { title: 'Cat', component: Cat };

          const Template = (args) => <Cat {...args} />;

          export const A = Template.bind({});
          A.args = { isPrimary: false };

          const Template2 = (args) => <Banana {...args} />;

          export const B = Template2.bind({});
          B.args = { isPrimary: true };
        `)
      ).resolves.toMatchInlineSnapshot(`
        export default { title: 'Cat', component: Cat };

        export const A = {
          args: { isPrimary: false },
        };

        const Template2 = (args) => <Banana {...args} />;

        export const B = {
          render: Template2,
          args: { isPrimary: true },
        };
      `);
    });

    it('should ignore no-arg stories without annotations', async () => {
      await expect(
        jsTransform(dedent`
          export default { title: 'Cat', component: Cat };

          export const A = (args) => <Cat {...args} />;
          export const B = () => <Cat name="frisky" />;
          export const C = () => <Cat name="fluffy" />;
          C.parameters = { foo: 2 };
        `)
      ).resolves.toMatchInlineSnapshot(`
        export default { title: 'Cat', component: Cat };

        export const A = {};
        export const B = () => <Cat name="frisky" />;

        export const C = {
          render: () => <Cat name="fluffy" />,
          parameters: { foo: 2 },
        };
      `);
    });

    it('should work for v1-style annotations', async () => {
      await expect(
        jsTransform(dedent`
          export default { title: 'Cat' };
          export const A = (args) => <Cat {...args} />;
          A.story = {
            parameters: { foo: 2 }
          };
        `)
      ).resolves.toMatchInlineSnapshot(`
        export default { title: 'Cat' };

        export const A = {
          render: (args) => <Cat {...args} />,
          parameters: { foo: 2 },
        };
      `);
    });
  });

  describe('typescript', () => {
    it('should error with namespace imports', async () => {
      await expect.addSnapshotSerializer({
        serialize: (value) => {
          const stringVal = typeof value === 'string' ? value : value.toString();
          return stringVal.replace(ansiRegex(), '');
        },
        test: () => true,
      });
      await expect(() =>
        tsTransform(dedent`
          import * as SB from '@storybook/react';
          import { CatProps } from './Cat';

          const meta = { title: 'Cat', component: Cat } as Meta<CatProps>
          export default meta;

          export const A: SB.StoryFn<CatProps> = () => <Cat />;
        `)
      ).rejects.toThrowErrorMatchingInlineSnapshot(dedent`
        Error: This codemod does not support namespace imports for a @storybook/react package.
        Replace the namespace import with named imports and try again.
      `);
    });
    it('should keep local names', async () => {
      await expect(
        tsTransform(dedent`
          import { Meta, StoryObj as CSF3, StoryFn as CSF2 } from '@storybook/react';
          import { CatProps } from './Cat';

          const meta = { title: 'Cat', component: Cat } satisfies Meta<CatProps>
          export default meta;

          export const A: CSF2<CatProps> = () => <Cat />;
          
          export const B: CSF3<CatProps> = {
            args: { name: "already csf3" }
          };

          export const C: CSF2<CatProps> = (args) => <Cat {...args} />;
          C.args = { 
            name: "Fluffy"
          };
        `)
      ).resolves.toMatchInlineSnapshot(`
        import { StoryFn as CSF2, StoryObj as CSF3, Meta } from '@storybook/react';

        import { CatProps } from './Cat';

        const meta = { title: 'Cat', component: Cat } satisfies Meta<CatProps>;
        export default meta;

        export const A: CSF2<CatProps> = () => <Cat />;

        export const B: CSF3<CatProps> = {
          args: { name: 'already csf3' },
        };

        export const C: CSF3<CatProps> = {
          args: {
            name: 'Fluffy',
          },
        };
      `);
    });

    it('should replace function exports with objects and update type', async () => {
      await expect(
        tsTransform(dedent`
          import { Story, StoryFn, ComponentStory, ComponentStoryObj } from '@storybook/react';

          // some extra whitespace to test

          export default { 
            title: 'Cat', 
            component: Cat,
          } as Meta<CatProps>;

          export const A: Story<CatProps> = (args) => <Cat {...args} />;
          A.args = { name: "Fluffy" };

          export const B: any = (args) => <Button {...args} />;

          export const C: Story<CatProps> = () => <Cat />;

          export const D: StoryFn<CatProps> = (args) => <Cat {...args} />;
          D.args = { 
            name: "Fluffy"
          };
          
          export const E: ComponentStory<Cat> = (args) => <Cat {...args} />;
          E.args = { name: "Fluffy" };
          
          export const F: Story = (args) => <Cat {...args} />;
          F.args = { 
            name: "Fluffy"
          };
          
          export const G: ComponentStoryObj<typeof Cat> = {
            args: {
              name: 'Fluffy',
            },
          };
        `)
      ).resolves.toMatchInlineSnapshot(`
        import { StoryFn, StoryObj } from '@storybook/react';

        // some extra whitespace to test

        export default {
          title: 'Cat',
          component: Cat,
        } as Meta<CatProps>;

        export const A: StoryObj<CatProps> = {
          args: { name: 'Fluffy' },
        };

        export const B: any = {
          render: (args) => <Button {...args} />,
        };

        export const C: StoryFn<CatProps> = () => <Cat />;

        export const D: StoryObj<CatProps> = {
          args: {
            name: 'Fluffy',
          },
        };

        export const E: StoryObj<Cat> = {
          args: { name: 'Fluffy' },
        };

        export const F: StoryObj = {
          args: {
            name: 'Fluffy',
          },
        };

        export const G: StoryObj<typeof Cat> = {
          args: {
            name: 'Fluffy',
          },
        };
      `);
    });

    it('migrate Story type to StoryFn when used in an not exported Template function', async () => {
      await expect(
        tsTransform(dedent`
          import { Story, Meta } from '@storybook/react'
          
          export default {
            component: Cat,
          } satisfies Meta
          
          const Template: Story = () => <div>Hello World</div>;
          
          export const Default = Template.bind({})
        `)
      ).resolves.toMatchInlineSnapshot(`
        import { Meta, StoryFn } from '@storybook/react';

        export default {
          component: Cat,
        } satisfies Meta;

        const Template: StoryFn = () => <div>Hello World</div>;

        export const Default = {
          render: Template,
        };
      `);
    });
  });
});
