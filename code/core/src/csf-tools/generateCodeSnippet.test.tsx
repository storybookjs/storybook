import { expect, test } from 'vitest';

import { dedent } from 'ts-dedent';

import { recast } from '../babel';
import { loadCsf } from './CsfFile';
import { getAllCodeSnippets } from './generateCodeSnippet';

function generateExample(code: string) {
  const csf = loadCsf(code, { makeTitle: (userTitle?: string) => userTitle ?? 'title' }).parse();
  return recast.print(getAllCodeSnippets(csf)).code;
}

test('CSF3', async () => {
  const input = dedent`
    // Button.stories.tsx
    import type { Meta, StoryObj, StoryFn } from '@storybook/react';
    import { Button } from '@design-system/button';
    
    const meta: Meta<typeof Button> = {
      component: Button,
      args: {
        children: 'Click me'
      }
    };
    export default meta;
    
    type Story = StoryObj<typeof Button>;
    
    export const Default: Story = {};
    
    export const WithEmoji: Story = {
      args: {
        children: '🚀Launch'
      }
    };
    
    export const Disabled: Story = {
      args: {
        disabled: true,
      }
    };
    
    export const LinkButton: Story = {
      args: {
        children: <a href="/some-link">This is a link</a>,
      }
    };
    
    export const ObjectArgs: Story = {
      args: {
        string: 'string',
        number: 1,
        object: { an: 'object'},
        complexObjet: {...{a: 1}, an: 'object'},
        array: [1,2,3]
      }
    };
    
    export const CSF1: StoryFn = () => <Button label="String"></Button>
    
    export const CSF2: StoryFn = (args) => <Button {...args} label="String"></Button>    
    
    export const CustomRender: Story = {
      render: () => <Button>Render</Button>
    };
  `;

  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const Default = () => <Button>Click me</Button>;
    const WithEmoji = () => <Button>🚀Launch</Button>;
    const Disabled = () => <Button disabled>Click me</Button>;
    const LinkButton = () => <Button><a href="/some-link">This is a link</a></Button>;

    const ObjectArgs = () => <Button
        string="string"
        number={1}
        object={{ an: 'object'}}
        complexObjet={{...{a: 1}, an: 'object'}}
        array={[1,2,3]}>Click me</Button>;

    const CSF1 = () => <Button label="String"></Button>;
    const CSF2 = (args) => <Button {...args} label="String"></Button>;
    const CustomRender = () => <Button>Render</Button>;"
  `);
});


test('CSF4', async () => {
  const input = dedent`
    // Button.stories.tsx
    import preview from './preview';
    import { Button } from '@design-system/button';
    
    const meta = preview.meta({
      component: Button,
      args: {
        children: 'Click me'
      }
    });
    
    export const Default = meta.story({});
    
    export const WithEmoji = meta.story({
      args: {
        children: '🚀Launch'
      }
    });
    
    export const Disabled = meta.story({
      args: {
        disabled: true,
      }
    });
    
    export const LinkButton = meta.story({
      args: {
        children: <a href="/some-link">This is a link</a>,
      }
    });
    
    export const ObjectArgs = meta.story({
      args: {
        string: 'string',
        number: 1,
        object: { an: 'object'},
        complexObjet: {...{a: 1}, an: 'object'},
        array: [1,2,3]
      }
    });
    
    export const CSF1 = meta.story(() => <Button label="String"></Button>)
    
    export const CSF2 = meta.story((args) => <Button {...args} label="String"></Button>)    
    
    export const CustomRender = meta.story({
      render: () => <Button>Render</Button>
    });
  `;

  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const Default = () => <Button>Click me</Button>;
    const WithEmoji = () => <Button>🚀Launch</Button>;
    const Disabled = () => <Button disabled>Click me</Button>;
    const LinkButton = () => <Button><a href="/some-link">This is a link</a></Button>;

    const ObjectArgs = () => <Button
        string="string"
        number={1}
        object={{ an: 'object'}}
        complexObjet={{...{a: 1}, an: 'object'}}
        array={[1,2,3]}>Click me</Button>;

    const CSF1 = () => <Button label="String"></Button>;
    const CSF2 = (args) => <Button {...args} label="String"></Button>;
    const CustomRender = () => <Button>Render</Button>;"
  `);
});
