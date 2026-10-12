import { expect, test } from 'vitest';

import { recast, types as t } from 'storybook/internal/babel';
import { loadCsf } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';

import { fillTemplate } from '../docs/fill-template.ts';
import { getCodeSnippet } from './generateCodeSnippet.ts';

function generateExample(code: string) {
  const csf = loadCsf(code, { makeTitle: (userTitle?: string) => userTitle ?? 'title' }).parse();

  const snippets = Object.keys(csf._storyExports).map(
    (name) => getCodeSnippet(csf, name, csf._meta?.component ?? 'ComponentTitle').node
  );

  return recast.print(t.program(snippets)).code;
}

/** Snippet plus what it still depends on, for the cases that resolve names rather than values. */
function generateResolved(code: string) {
  const csf = loadCsf(code, { makeTitle: (userTitle?: string) => userTitle ?? 'title' }).parse();

  return Object.keys(csf._storyExports).map((name) => {
    const snippet = getCodeSnippet(csf, name, csf._meta?.component ?? 'ComponentTitle');
    return {
      snippet: recast.print(snippet.node).code,
      imports: snippet.imports.map((ref) => `${ref.importName} from ${ref.importId}`),
      unresolved: snippet.unresolved,
    };
  });
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

test('render: Template (identifier referencing local function)', () => {
  const input = withCSF3(dedent`
    const Template = (args) => <Button {...args} label="String"></Button>
    export const Interactive: Story = { render: Template }
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const Interactive = () => <Button label="String">Click me</Button>;"`
  );
});

test('render: Template (identifier referencing local function declaration)', () => {
  const input = withCSF3(dedent`
    function Template(args) { return <Button {...args} label="String"></Button> }
    export const Interactive: Story = { render: Template }
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "function Interactive() {
        return <Button label="String">Click me</Button>;
    }"
  `);
});

test('render: Template (identifier referencing unresolvable function)', () => {
  // When Template can't be resolved (e.g. imported), fall back to no-function JSX synthesis
  const input = withCSF3(dedent`
    export const Interactive: Story = { render: Template }
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const Interactive = () => <Button>Click me</Button>;"`
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

test('Meta level render: Template (identifier referencing local function)', async () => {
  const input = dedent`
    import type { Meta } from '@storybook/react';
    import { Button } from '@design-system/button';

    const Template = (args) => <Button {...args} override="overide" />;

    const meta: Meta<typeof Button> = {
      render: Template,
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

test('Meta level render: Template (identifier referencing unresolvable function)', async () => {
  const input = dedent`
    import type { Meta } from '@storybook/react';
    import { Button } from '@design-system/button';

    const meta: Meta<typeof Button> = {
      component: Button,
      render: Template,
      args: {
        children: 'Click me'
      }
    };
    export default meta;

    export const Fallback = {
      args: { foo: 'bar' }
    };
  `;
  // Falls back to no-function JSX synthesis using component name
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const Fallback = () => <Button foo="bar">Click me</Button>;"`
  );
});

test('Story unresolvable render does not fall back to meta render', async () => {
  // When a story has `render: ImportedTemplate` (unresolvable) and meta has an inline render,
  // the story's render should take precedence — fall through to no-function JSX synthesis,
  // NOT use meta's render function.
  const input = dedent`
    import type { Meta } from '@storybook/react';
    import { Button } from '@design-system/button';

    const meta: Meta<typeof Button> = {
      component: Button,
      render: (args) => <Button {...args} extra="from-meta" />,
      args: {
        children: 'Click me'
      }
    };
    export default meta;

    export const StoryWithImportedRender = {
      render: ImportedTemplate,
      args: { label: 'hello' }
    };
  `;
  // Should NOT contain extra="from-meta" — that would mean meta's render leaked through
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const StoryWithImportedRender = () => <Button label="hello">Click me</Button>;"`
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

test('render method shorthand resolves like a render function', () => {
  const input = withCSF3(dedent`
    export const Default: Story = {
      render(args) {
        return <Button {...args}>method body</Button>;
      }
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const Default = () => {
        return <Button>method body</Button>;
    };"
  `);
});

test('a render shadowed by a later spread stays the snippet, not the synthesized fallback', () => {
  const input = withCSF3(dedent`
    const base = {};
    export const Default: Story = {
      render: (args) => <Button {...args}>custom body</Button>,
      ...base,
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const Default = () => <Button>custom body</Button>;"`
  );
});

test('a spread of a local const object contributes its args', () => {
  const input = withCSF3(dedent`
    const shared = { primary: true, size: 'large' };
    export const Default: Story = { args: { ...shared, label: 'local' } };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const Default = () => <Button primary size="large" label="local">Click me</Button>;"`
  );
});

test("a spread of a sibling story's args contributes the args it does not override", () => {
  const input = withCSF3(dedent`
    export const Base: Story = { args: { label: 'base', primary: true } };
    export const Sibling: Story = { args: { ...Base.args, label: 'sibling' } };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const Base = () => <Button label="base" primary>Click me</Button>;
    const Sibling = () => <Button label="sibling" primary>Click me</Button>;"
  `);
});

test('a config-level spread inherits the args the story it extends declares', () => {
  const input = withCSF3(dedent`
    export const Base: Story = { args: { label: 'base', primary: true } };
    export const Inherits: Story = { ...Base };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const Base = () => <Button label="base" primary>Click me</Button>;
    const Inherits = () => <Button label="base" primary>Click me</Button>;"
  `);
});

test("a spread of a CSF4 story's args contributes the args it does not override", () => {
  const input = withCSF4(dedent`
    export const Base = meta.story({ args: { label: 'base', primary: true } });
    export const Sibling = meta.story({ args: { ...Base.input.args, label: 'sibling' } });
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const Base = () => <Button label="base" primary>Click me</Button>;
    const Sibling = () => <Button label="sibling" primary>Click me</Button>;"
  `);
});

test('an arg naming a local const carries the value, not the name', () => {
  const input = withCSF3(dedent`
    const LOCAL_LABEL = 'local';
    export const Default: Story = { args: { label: LOCAL_LABEL } };
  `);
  expect(generateResolved(input)).toMatchInlineSnapshot(`
    [
      {
        "imports": [],
        "snippet": "const Default = () => <Button label="local">Click me</Button>;",
        "unresolved": [],
      },
    ]
  `);
});

test('an arg naming an imported value keeps the name and reports the import it needs', () => {
  const input = withCSF3(dedent`
    import { IMPORTED_LABEL } from './constants';
    export const Default: Story = { args: { label: IMPORTED_LABEL } };
  `);
  expect(generateResolved(input)).toMatchInlineSnapshot(`
    [
      {
        "imports": [
          "IMPORTED_LABEL from ./constants",
        ],
        "snippet": "const Default = () => <Button label={IMPORTED_LABEL}>Click me</Button>;",
        "unresolved": [],
      },
    ]
  `);
});

test('args assembled at runtime are reported rather than dropped', () => {
  const input = withCSF3(dedent`
    export const Default: Story = { args: { ...buildArgs(), label: 'runtime' } };
  `);
  expect(generateResolved(input)).toMatchInlineSnapshot(`
    [
      {
        "imports": [],
        "snippet": "const Default = () => <Button label="runtime">Click me</Button>;",
        "unresolved": [
          "...buildArgs()",
        ],
      },
    ]
  `);
});

test('args assigned to a function-declaration story are inlined', () => {
  const input = withCSF3(dedent`
    export function Usage(args) {
      return <Button {...args}></Button>;
    }
    Usage.args = { label: 'assigned' };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "function Usage() {
        return <Button label="assigned">Click me</Button>;
    }"
  `);
});

test('a meta-level spread that may carry args is reported', () => {
  const input = dedent`
    import { Button } from '@design-system/button';
    declare function sharedMeta(): object;
    export default { component: Button, ...sharedMeta() };
    export const Default = { args: { label: 'x' } };
  `;
  expect(generateResolved(input)).toMatchInlineSnapshot(`
    [
      {
        "imports": [],
        "snippet": "const Default = () => <Button label="x" />;",
        "unresolved": [
          "...sharedMeta()",
        ],
      },
    ]
  `);
});

test('a body still reading args after a partial inline keeps the parameter', () => {
  const input = withCSF3(dedent`
    export function Usage(args) {
      return <Button {...args} title={args.notAnArg} />;
    }
    Usage.args = { label: 'assigned' };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "function Usage(args) {
        return <Button label="assigned" title={args.notAnArg}>Click me</Button>;
    }"
  `);
});

test('an arg value keeps a shorthand property shorthand', () => {
  const input = withCSF3(dedent`
    import { dep } from './dep';
    const base = { size: 'md' };
    export const Shorthand: Story = { args: { cfg: { dep, nested: { ...base } } } };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const Shorthand = () => <Button
        cfg={{
            dep,

            nested: {
                size: 'md'
            }
        }}>Click me</Button>;"
  `);
});

function generateTemplates(code: string) {
  const csf = loadCsf(code, { makeTitle: (userTitle?: string) => userTitle ?? 'title' }).parse();

  return Object.keys(csf._storyExports)
    .map((name) => {
      const { template } = getCodeSnippet(csf, name, csf._meta?.component ?? 'ComponentTitle');
      return template ? recast.print(template).code : `// ${name}: no template`;
    })
    .join('\n');
}

function liveSnippet(code: string, story: string, args: Record<string, unknown>) {
  const csf = loadCsf(code, { makeTitle: (userTitle?: string) => userTitle ?? 'title' }).parse();
  const { template } = getCodeSnippet(csf, story, csf._meta?.component ?? 'ComponentTitle');
  return fillTemplate(recast.print(template!).code, args);
}

test('template spreads the args into a story without a render function', () => {
  const input = withCSF3(`export const Default: Story = {};`);
  expect(generateTemplates(input)).toMatchInlineSnapshot(
    `"const Default = () => <Button {...args}>{args.children}</Button>;"`
  );
  expect(liveSnippet(input, 'Default', { children: 'Save', primary: true })).toBe(
    'const Default = () => <Button primary>Save</Button>;'
  );
  expect(liveSnippet(input, 'Default', { primary: true })).toBe(
    'const Default = () => <Button primary />;'
  );
});

test('template keeps a render function as written, without its args parameter', () => {
  const input = withCSF3(dedent`
    export const Loading: Story = {
      render: (args) => (args.loading ? <Spinner /> : <Button {...args} label={args.label} />),
    };
  `);
  expect(generateTemplates(input)).toMatchInlineSnapshot(
    `"const Loading = () => (args.loading ? <Spinner /> : <Button {...args/* omit: label */} label={args.label}>{args.children}</Button>);"`
  );
  expect(liveSnippet(input, 'Loading', { loading: true, label: 'Go' })).toBe(
    'const Loading = () => (true ? <Spinner /> : <Button loading label="Go" />);'
  );
});

test('filled with the args it is written with, a story reads like its snippet', () => {
  const stories = {
    Default: {},
    Primary: { primary: true, label: 'Save' },
    Sized: { size: 'large', count: 2, disabled: false },
  };
  const input = withCSF3(
    Object.entries(stories)
      .map(([name, args]) => `export const ${name}: Story = { args: ${JSON.stringify(args)} };`)
      .join('\n')
  );
  for (const [name, args] of Object.entries(stories)) {
    const snippet = generateResolved(input).find(({ snippet }) => snippet.includes(` ${name} =`));
    expect(liveSnippet(input, name, { children: 'Click me', ...args })).toBe(snippet!.snippet);
  }
});

test('template keeps a prop written before the spread, which the spread overrides', () => {
  const input = withCSF3(dedent`
    export const Ghost: Story = {
      render: (args) => <Button variant="solid" {...args} />,
    };
  `);
  expect(generateTemplates(input)).toMatchInlineSnapshot(
    `"const Ghost = () => <Button variant="solid" {...args}>{args.children}</Button>;"`
  );
});

test('template writes destructured args as args members', () => {
  const input = withCSF3(dedent`
    export const Destructured: Story = {
      render: ({ label, 'data-id': id, items }) => (
        <List id={id} title={label} {...{ items }}>
          {items.map((item) => <li key={item}>{item}</li>)}
        </List>
      ),
    };
  `);
  expect(generateTemplates(input)).toMatchInlineSnapshot(`
    "const Destructured = () => (<List
      id={args["data-id"]}
      title={args.label}
      {...{
        items: args.items
      }}>
      {args.items.map((item) => <li key={item}>{item}</li>)}
    </List>);"
  `);
  expect(liveSnippet(input, 'Destructured', { label: 'Fruit', 'data-id': 7, items: ['apple'] }))
    .toMatchInlineSnapshot(`
    "const Destructured = () => (<List
      id={7}
      title="Fruit"
      {...{
        items: ["apple"]
      }}>
      {["apple"].map((item) => <li key={item}>{item}</li>)}
    </List>);"
  `);
});

test('template reads args destructured in the body of the render function', () => {
  const input = withCSF3(dedent`
    export const Counter: Story = {
      render: function Render(props) {
        const { label } = props;
        const [count, setCount] = useState(0);
        return <Button {...props} onClick={() => setCount(count + 1)}>{label}: {count}</Button>;
      },
    };
  `);
  expect(generateTemplates(input)).toMatchInlineSnapshot(`
    "const Counter = () => {
      const [count, setCount] = useState(0);
      return <Button {...args/* omit: onClick */} onClick={() => setCount(count + 1)}>{args.label}: {count}</Button>;
    };"
  `);
});

test('template keeps a function declaration story a function declaration', () => {
  const input = withCSF3(dedent`
    export function Plain(args) {
      return <Button {...args} />;
    }
  `);
  expect(generateTemplates(input)).toMatchInlineSnapshot(`
    "function Plain() {
      return <Button {...args}>{args.children}</Button>;
    }"
  `);
});

test('template falls back to the meta render function', () => {
  const input = dedent`
    import { Button } from './Button';
    export default { component: Button, render: (args) => <div><Button {...args} /></div> };
    export const Primary = {};
  `;
  expect(generateTemplates(input)).toMatchInlineSnapshot(
    `"const Primary = () => <div><Button {...args}>{args.children}</Button></div>;"`
  );
});

test('no template when the story reads no args', () => {
  const input = withCSF3(`export const Static: Story = { render: () => <Button>Hi</Button> };`);
  expect(generateTemplates(input)).toMatchInlineSnapshot(`"// Static: no template"`);
});

test('no template when the args are read in a way the preview cannot fill', () => {
  const input = withCSF3(dedent`
    export const PassedOn: Story = { render: (args) => <Wrapper args={args} /> };
    export const Defaulted: Story = { render: ({ label = 'Hi' }) => <Button label={label} /> };
    export const Rest: Story = { render: ({ label, ...rest }) => <Button {...rest}>{label}</Button> };
    export const Reassigned: Story = { render: (args) => { args = {}; return <Button {...args} />; } };
    export const Computed: Story = { render: (args) => <Button label={args[key]} /> };
    export const Shadowed: Story = {
      render: ({ label }) => <List render={(args) => <Button {...args} label={label} />} />,
    };
    export const Global: Story = { render: ({ label }) => <Button label={label} {...args} /> };
  `);
  expect(generateTemplates(input)).toMatchInlineSnapshot(`
    "// PassedOn: no template
    // Defaulted: no template
    // Rest: no template
    // Reassigned: no template
    // Computed: no template
    // Shadowed: no template
    // Global: no template"
  `);
});

test('no template when a string or text in the story reads like an arg path', () => {
  const input = withCSF3(dedent`
    export const Attribute: Story = { render: (args) => <Button {...args} title="see args.label" /> };
    export const Text: Story = { render: ({ label }) => <p>Set args.label: {label}</p> };
    export const Quasi: Story = { render: ({ label }) => <p>{\`args.label is \${label}\`}</p> };
  `);
  expect(generateTemplates(input)).toMatchInlineSnapshot(`
    "// Attribute: no template
    // Text: no template
    // Quasi: no template"
  `);
});
