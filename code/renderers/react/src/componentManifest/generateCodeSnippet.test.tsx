import { expect, test } from 'vitest';

import { recast, types as t } from 'storybook/internal/babel';
import { loadCsf } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';

import { getCodeSnippet } from './generateCodeSnippet';

function generateExample(code: string) {
  const csf = loadCsf(code, { makeTitle: (userTitle?: string) => userTitle ?? 'title' }).parse();

  const snippets = Object.keys(csf._storyExports)
    .map((name) => getCodeSnippet(csf, name, csf._meta?.component ?? 'ComponentTitle'))
    .filter(Boolean);

  return recast.print(t.program(snippets)).code;
}

function withCSF3(body: string) {
  return dedent`
    import type { Meta } from '@storybook/react';
    import { Button } from '@design-system/button';

    const meta: Meta<typeof Button> = {
      component: Button,
      args: {
        children: 'Click me'
      }
    };
    export default meta;

    ${body}
  `;
}

function withCSF4(body: string) {
  return dedent`
    import preview from './preview';
    import { Button } from '@design-system/button';
    
    const meta = preview.meta({
      component: Button,
      args: {
        children: 'Click me'
      }
    });
    
    ${body}
  `;
}

test('Default', () => {
  const input = withCSF3(`
    export const Default: Story = {};
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const Default = () => <Button>Click me</Button>;"`
  );
});

test('Synthesizes self-closing when no children', () => {
  const input = dedent`
    import type { Meta } from '@storybook/react';
    import { Button } from '@design-system/button';

    const meta: Meta<typeof Button> = {
      component: Button,
    };
    export default meta;

    export const NoChildren: Story = {};
  `;
  expect(generateExample(input)).toMatchInlineSnapshot(`"const NoChildren = () => <Button />;"`);
});

test('Default satisfies or as', () => {
  const input = withCSF3(`
    export const Default = {} satisfies Story;
    export const Other = {} as Story;
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `
    "const Default = () => <Button>Click me</Button>;
    const Other = () => <Button>Click me</Button>;"
  `
  );
});

test('Edge case identifier we can not find', () => {
  const input = withCSF3(`
    export const Default = someImportOrWhatever;
  `);
  expect(() => generateExample(input)).toThrowErrorMatchingInlineSnapshot(
    `
    [SyntaxError: Expected story to be csf factory, function or an object expression
      11 |
      12 |
    > 13 |     export const Default = someImportOrWhatever;
         |                            ^^^^^^^^^^^^^^^^^^^^
      14 |   ]
  `
  );
});

test('Default- CSF4', () => {
  const input = withCSF4(`
    export const Default = meta.story({});
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const Default = () => <Button>Click me</Button>;"`
  );
});

test('StoryWithoutArguments - CSF4', () => {
  const input = withCSF4(`
    export const StoryWithoutArguments = meta.story();
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const StoryWithoutArguments = () => <Button>Click me</Button>;"`
  );
});

test('Replace children', () => {
  const input = withCSF3(dedent`
    export const WithEmoji: Story = {
      args: {
        children: '🚀Launch'
      }
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const WithEmoji = () => <Button>🚀Launch</Button>;"`
  );
});

test('Boolean', () => {
  const input = withCSF3(dedent`
    export const Disabled: Story = {
      args: {
        disabled: true
      }
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const Disabled = () => <Button disabled>Click me</Button>;"`
  );
});

test('JSX Children', () => {
  const input = withCSF3(dedent`
    export const LinkButton: Story = {
      args: {
        children: <a href="/some-link">This is a link</a>,
      }
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const LinkButton = () => <Button><a href="/some-link">This is a link</a></Button>;"`
  );
});

test('Object', () => {
  const input = withCSF3(dedent`
    export const ObjectArgs: Story = {
      args: {
        string: 'string',
        number: 1,
        object: { an: 'object'},
        complexObject: {...{a: 1}, an: 'object'},
        array: [1,2,3]
      }
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const ObjectArgs = () => <Button
        string="string"
        number={1}
        object={{ an: 'object'}}
        complexObject={{...{a: 1}, an: 'object'}}
        array={[1,2,3]}>Click me</Button>;"
  `);
});

test('CSF1', () => {
  const input = withCSF3(dedent`
    export const CSF1: StoryFn = () => <Button label="String"></Button>;
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const CSF1 = () => <Button label="String"></Button>;"`
  );
});

test('CSF2', () => {
  const input = withCSF3(dedent`
    export const CSF2: StoryFn = (args) => <Button {...args} label="String"></Button>;
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const CSF2 = () => <Button label="String">Click me</Button>;"`
  );
});

test('CSF2 - Template.bind', () => {
  const input = withCSF3(dedent`
    const Template = (args) => <Button {...args} label="String"></Button>
    export const CSF2: StoryFn = Template.bind({});
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const CSF2 = () => <Button label="String">Click me</Button>;"`
  );
});

test('CSF2 - with args', () => {
  const input = withCSF3(dedent`
    const Template = (args) => <Button {...args} override="overide" />;
    export const CSF2: StoryFn = Template.bind({});
    CSF2.args = { foo: 'bar', override: 'value' }
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const CSF2 = () => <Button foo=\"bar\" override=\"overide\">Click me</Button>;"`
  );
});

test('Custom Render', () => {
  const input = withCSF3(dedent`
    export const CustomRender: Story = { render: () => <Button label="String"></Button> }
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const CustomRender = () => <Button label="String"></Button>;"`
  );
});

test('CustomRenderWithOverideArgs only', async () => {
  const input = withCSF3(
    `export const CustomRenderWithOverideArgs = {
      render: (args) => <Button {...args} override="overide">Render</Button>,
      args: { foo: 'bar', override: 'value' }
    };`
  );
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const CustomRenderWithOverideArgs = () => <Button foo="bar" override="overide">Render</Button>;"`
  );
});

test('Meta level render', async () => {
  const input = dedent`
    import type { Meta } from '@storybook/react';
    import { Button } from '@design-system/button';

    const meta: Meta<typeof Button> = {
      render: (args) => <Button {...args} override="overide" />,
      args: {
        children: 'Click me'
      }
    };
    export default meta;

    export const CustomRenderWithOverideArgs = {
      args: { foo: 'bar', override: 'value' }
    };
  `;
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const CustomRenderWithOverideArgs = () => <Button foo="bar" override="overide">Click me</Button>;"`
  );
});

test('CustomRenderWithNoArgs only', async () => {
  const input = withCSF3(
    `export const CustomRenderWithNoArgs = {
      render: (args) => <Button {...args}>Render</Button>
    };`
  );
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const CustomRenderWithNoArgs = () => <Button>Render</Button>;"`
  );
});

test('CustomRenderWithDuplicateOnly only', async () => {
  const input = withCSF3(
    `export const CustomRenderWithDuplicateOnly = {
      render: (args) => <Button {...args} override="overide">Render</Button>,
      args: { override: 'value' }
    };`
  );
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const CustomRenderWithDuplicateOnly = () => <Button override="overide">Render</Button>;"`
  );
});

test('CustomRenderWithMultipleSpreads only', async () => {
  const input = withCSF3(
    `export const CustomRenderWithMultipleSpreads = {
      render: (args) => <Button foo="a" {...args} bar="b" {...args} baz="c">Render</Button>,
      args: { qux: 'q' }
    };`
  );
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const CustomRenderWithMultipleSpreads = () => <Button foo="a" qux="q" bar="b" baz="c">Render</Button>;"`
  );
});

test('CustomRenderBlockBody only', async () => {
  const input = withCSF3(
    `export const CustomRenderBlockBody = {
      render: (args) => { return <Button {...args}>Render</Button> },
      args: { foo: 'bar' }
    };`
  );
  expect(generateExample(input)).toMatchInlineSnapshot(
    `
    "const CustomRenderBlockBody = () => {
        return <Button foo="bar">Render</Button>;
    };"
  `
  );
});

test('ObjectFalsyArgs only', async () => {
  const input = withCSF3(
    `export const ObjectFalsyArgs = {
      args: { disabled: false, count: 0, empty: '' }
    };`
  );
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const ObjectFalsyArgs = () => <Button disabled={false} count={0} empty="">Click me</Button>;"`
  );
});

test('ObjectUndefinedNull only', async () => {
  const input = withCSF3(
    `export const ObjectUndefinedNull = {
      args: { thing: undefined, nada: null }
    };`
  );
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const ObjectUndefinedNull = () => <Button thing={undefined} nada={null}>Click me</Button>;"`
  );
});

test('ObjectDataAttr only', async () => {
  const input = withCSF3(
    `export const ObjectDataAttr = {
      args: { 'data-test-id': 'x' }
    };`
  );
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const ObjectDataAttr = () => <Button data-test-id="x">Click me</Button>;"`
  );
});

test('ObjectInvalidAttr only', async () => {
  const input = withCSF3(
    `export const ObjectInvalidAttr = {
      args: { '1x': 'a', 'bad key': 'b', '@foo': 'c', '-dash': 'd' }
    };`
  );
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const ObjectInvalidAttr = () => <Button
        {...{
            "1x": 'a',
            "bad key": 'b',
            "@foo": 'c',
            "-dash": 'd'
        }}>Click me</Button>;"
  `);
});

test('Inline nested args in child element (string)', () => {
  const input = withCSF3(dedent`
    export const NestedInline: Story = {
      render: (args) => <Button><OtherElement prop={args.foo} /></Button>,
      args: { foo: 'bar' }
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const NestedInline = () => <Button><OtherElement prop="bar" /></Button>;"`
  );
});

test('Inline nested args in child element (boolean)', () => {
  const input = withCSF3(dedent`
    export const NestedBoolean: Story = {
      render: (args) => <Button><OtherElement active={args.active} /></Button>,
      args: { active: true }
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const NestedBoolean = () => <Button><OtherElement active /></Button>;"`
  );
});

test('Remove nested attr when arg is null/undefined', () => {
  const input = withCSF3(dedent`
    export const NestedRemove: Story = {
      render: (args) => <Button><OtherElement gone={args.gone} /></Button>,
      args: { gone: null }
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const NestedRemove = () => <Button><OtherElement gone={null} /></Button>;"`
  );
});

test('Inline args.children when used as child expression', () => {
  const input = withCSF3(dedent`
    export const ChildrenExpr: Story = {
      render: (args) => <Button>{args.children}</Button>
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const ChildrenExpr = () => <Button>Click me</Button>;"`
  );
});

// Deeper tree examples

test('Deeply nested prop replacement (string)', () => {
  const input = withCSF3(dedent`
    export const DeepNestedProp: Story = {
      render: (args) => (
        <Button>
          <Level1>
            <Level2>
              <Leaf val={args.foo} />
            </Level2>
          </Level1>
        </Button>
      ),
      args: { foo: 'bar' }
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `
    "const DeepNestedProp = () => <Button>
        <Level1>
            <Level2>
                <Leaf val="bar" />
            </Level2>
        </Level1>
    </Button>;"
  `
  );
});

test('Deeply nested prop replacement (boolean)', () => {
  const input = withCSF3(dedent`
    export const DeepNestedBoolean: Story = {
      render: (args) => (
        <Button>
          <Level1>
            <Level2>
              <Leaf active={args.active} />
            </Level2>
          </Level1>
        </Button>
      ),
      args: { active: true }
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `
    "const DeepNestedBoolean = () => <Button>
        <Level1>
            <Level2>
                <Leaf active />
            </Level2>
        </Level1>
    </Button>;"
  `
  );
});

test('Deeply nested children expression', () => {
  const input = withCSF3(dedent`
    export const DeepNestedChildren: Story = {
      render: (args) => (
        <Button>
          <Level1>
            <Level2>{args.children}</Level2>
          </Level1>
        </Button>
      )
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `
    "const DeepNestedChildren = () => <Button>
        <Level1>
            <Level2>Click me</Level2>
        </Level1>
    </Button>;"
  `
  );
});

test('Deeply nested multiple replacements', () => {
  const input = withCSF3(dedent`
    export const DeepNestedMultiple: Story = {
      render: (args) => (
        <Button>
          <Level1>
            <Leaf1 a={args.a} />
            <Level2>
              <Leaf2 b={args.b} />
            </Level2>
          </Level1>
        </Button>
      ),
      args: { a: 'x', b: 'y' }
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `
    "const DeepNestedMultiple = () => <Button>
        <Level1>
            <Leaf1 a="x" />
            <Level2>
                <Leaf2 b="y" />
            </Level2>
        </Level1>
    </Button>;"
  `
  );
});

test('Deeply nested multiple replacements and using args spread', () => {
  const input = withCSF3(dedent`
    export const DeepNestedMultiple: Story = {
      render: (args) => (
        <Button {...args}>
          <Level1>
            <Leaf1 a={args.a} />
            <Level2>
              <Leaf2 b={args.b} />
            </Level2>
          </Level1>
        </Button>
      ),
      args: { a: 'x', b: 'y' }
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `
    "const DeepNestedMultiple = () => <Button a="x" b="y">
        <Level1>
            <Leaf1 a="x" />
            <Level2>
                <Leaf2 b="y" />
            </Level2>
        </Level1>
    </Button>;"
  `
  );
});

test('top level args injection and spreading in different places', async () => {
  const input = withCSF3(dedent`
    export const MultipleSpreads: Story = {
      args: { disabled: false, count: 0, empty: '' },
      render: (args) => (
        <div count={args.count}>
          <Button {...args} />
          <Button {...args} />
        </div>
      ),
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const MultipleSpreads = () => <div count={0}>
        <Button disabled={false} count={0} empty="">Click me</Button>
        <Button disabled={false} count={0} empty="">Click me</Button>
    </div>;"
  `);
});

test('allow top level export functions', async () => {
  const input = withCSF3(dedent`
    export function Usage(args) {
      return (
        <div style={{ padding: 40 }}>
          <Button {...args}></Button>
        </div>
      );
    }
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "function Usage() {
        return (
            <div style={{ padding: 40 }}>
                <Button>Click me</Button>
            </div>
        );
    }"
  `);
});
