import { expect, test } from 'vitest';

import { recast, types as t } from 'storybook/internal/babel';
import { loadCsf } from 'storybook/internal/csf-tools';
import { UnprintableArgError } from 'storybook/internal/docs-tools';

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

function template(code: string, story: string) {
  const csf = loadCsf(code, { makeTitle: (userTitle?: string) => userTitle ?? 'title' }).parse();
  return getCodeSnippet(csf, story, csf._meta?.component ?? 'ComponentTitle').template;
}

const filled = (code: string, story: string, args: Record<string, unknown>) =>
  fillTemplate(template(code, story)!, args);

test('template: a story without a render function is the component with every arg', () => {
  const input = withCSF3(`export const Default: Story = {};`);
  expect(template(input, 'Default')).toBe('const Default = () => ⟦element Button⟧;');
  expect(filled(input, 'Default', { children: 'Save', primary: true })).toBe(
    'const Default = () => <Button primary>Save</Button>;'
  );
});

test('template: a render function stays as written, with a hole for each arg it reads', () => {
  const input = withCSF3(dedent`
    export const Loading: Story = {
      render: (args) => (
        <Card title={args.title}>
          {args.loading ? <Spinner /> : <Button {...args}>{args.label}</Button>}
        </Card>
      ),
    };
  `);
  expect(template(input, 'Loading')).toMatchInlineSnapshot(`
    "const Loading = () => (
      <Card ⟦attr title title⟧>
        {⟦value loading⟧ ? <Spinner /> : <Button ⟦props -children⟧>⟦text label⟧</Button>}
      </Card>
    );"
  `);
  expect(filled(input, 'Loading', { title: 'Hi', loading: false, label: 'Go', size: 'sm' }))
    .toMatchInlineSnapshot(`
      "const Loading = () => (
        <Card title="Hi">
          {false ? <Spinner /> : <Button title="Hi" loading={false} label="Go" size="sm">Go</Button>}
        </Card>
      );"
    `);
});

test('template: an element with only the spread is the component with every arg', () => {
  const input = withCSF3(dedent`
    export const Spread: Story = { render: (args) => <div><Button {...args} /></div> };
  `);
  expect(template(input, 'Spread')).toBe('const Spread = () => <div>⟦element Button⟧</div>;');
  expect(filled(input, 'Spread', { children: 'Save', size: 'sm' })).toBe(
    'const Spread = () => <div><Button size="sm">Save</Button></div>;'
  );
});

test('template: destructured args are holes too', () => {
  const input = withCSF3(dedent`
    export const Destructured: Story = {
      render: ({ label, items }) => <List label={label} items={items.map((item) => item)} />,
    };
  `);
  expect(template(input, 'Destructured')).toBe(
    'const Destructured = () => <List ⟦attr label label⟧ items={⟦operand items⟧.map((item) => item)} />;'
  );
  expect(filled(input, 'Destructured', { label: 'L', items: ['a'] })).toBe(
    'const Destructured = () => <List label="L" items={["a"].map((item) => item)} />;'
  );
  const renamed = withCSF3(
    `export const Renamed: Story = { render: ({ label: text }) => <List style={{ text }} /> };`
  );
  expect(template(renamed, 'Renamed')).toBe(
    'const Renamed = () => <List style={{ text: ⟦value label⟧ }} />;'
  );
});

test('template: keeps the indentation of lines after the first', () => {
  const input = withCSF3(dedent`
    export const Indented: Story = {
      render: (args) =>
        args.loading
          ? <Spinner />
          : <Button label={args.label} />,
    };
  `);
  expect(filled(input, 'Indented', { loading: false, label: 'Go' })).toMatchInlineSnapshot(`
    "const Indented = () => (
      false
        ? <Spinner />
        : <Button label="Go" />
    );"
  `);
});

test('template: keeps the layout, and an unset attribute leaves no gap', () => {
  const input = withCSF3(dedent`
    export const Layout: Story = {
      render: (args) => (
        <Button
          {...args}
          label={args.label}
          size={args.size}
          disabled
        />
      ),
    };
  `);
  expect(filled(input, 'Layout', { label: 'Go', primary: true })).toMatchInlineSnapshot(`
    "const Layout = () => (
      <Button
        primary
        label="Go"
        disabled
      />
    );"
  `);
});

test('template: shows the static snippet once an arg overrides an attribute before the spread', () => {
  const input = withCSF3(
    `export const Before: Story = { render: (args) => <Button size="sm" {...args} /> };`
  );
  expect(template(input, 'Before')).toBe(
    'const Before = () => <Button size="sm" ⟦props ^size⟧ />;'
  );
  expect(filled(input, 'Before', { label: 'Go' })).toBe(
    'const Before = () => <Button size="sm" label="Go" />;'
  );
  expect(() => filled(input, 'Before', { size: 'lg' })).toThrow(UnprintableArgError);
});

test('template: keeps a literal the code reads on apart', () => {
  const input = withCSF3(dedent`
    export const Fields: Story = {
      render: (args) => (
        <Meter value={-args.n} text={args.n.toFixed(2)} big={args.n ** 2} />
      ),
    };
    export const Body: Story = { render: (args) => args.style };
    export const Starts: Story = { render: (args) => args.user && <Button /> };
    export const Statement: Story = { render: (args) => { args.user && log(); return <Button />; } };
  `);
  expect(filled(input, 'Fields', { n: -1 })).toBe(
    'const Fields = () => <Meter value={-(-1)} text={(-1).toFixed(2)} big={(-1) ** 2} />;'
  );
  expect(filled(input, 'Body', { style: { a: 1 } })).toBe('const Body = () => ({ a: 1 });');
  expect(filled(input, 'Starts', { user: { a: 1 } })).toBe(
    'const Starts = () => ({ a: 1 }) && <Button />;'
  );
  expect(filled(input, 'Statement', { user: { a: 1 } })).toContain('({ a: 1 }) && log();');
});

test('template: writes a component arg by its name', () => {
  const input = withCSF3(`export const Icon: Story = {};`);
  const HeartIcon = () => null;
  expect(filled(input, 'Icon', { icon: HeartIcon, onClick: () => {} })).toBe(
    'const Icon = () => <Button icon={HeartIcon} />;'
  );
});

test('template: a rest of the args is every arg but those taken before it', () => {
  const input = withCSF3(dedent`
    export const Rest: Story = {
      render: ({ label, ...rest }) => <Button {...rest}>{label}</Button>,
    };
    export const Alone: Story = {
      render: ({ disabled, ...rest }) => <Field disabled={disabled}><Button {...rest} /></Field>,
    };
    export const Read: Story = {
      render: ({ label, ...rest }) => <Button size="sm" title={rest.title} label={label} {...rest} />,
    };
    export const Taken: Story = { render: ({ label, ...rest }) => <Button title={rest.label} /> };
  `);
  expect(template(input, 'Rest')).toBe(
    'const Rest = () => <Button ⟦props -label -children⟧>⟦text label⟧</Button>;'
  );
  expect(filled(input, 'Rest', { label: 'Go', children: 'x', size: 'sm' })).toBe(
    'const Rest = () => <Button size="sm">Go</Button>;'
  );
  expect(template(input, 'Alone')).toBe(
    'const Alone = () => <Field ⟦attr disabled disabled⟧>⟦element Button -disabled⟧</Field>;'
  );
  expect(filled(input, 'Alone', { disabled: true, children: 'Save', size: 'sm' })).toBe(
    'const Alone = () => <Field disabled><Button size="sm">Save</Button></Field>;'
  );
  expect(template(input, 'Read')).toBe(
    'const Read = () => <Button size="sm" ⟦attr title title⟧ ⟦attr label label⟧ ⟦props -label ^size ^title⟧ />;'
  );
  expect(template(input, 'Taken')).toBeUndefined();
});

test('template: a default stands for its arg while that is unset', () => {
  const input = withCSF3(dedent`
    export const Defaults: Story = {
      render: ({ size = 'md', count = 2, label = 'Go', style = { a: 1 }, ...rest }) => (
        <Button size={size} style={style} title={count.toFixed()} {...rest}>
          {label}
          {{ size, total: count + 1 }.size}
        </Button>
      ),
    };
    export const Computed: Story = { render: ({ a = 1, b = a ? 2 : 3 }) => <Button a={a} b={b} /> };
    export const Called: Story = { render: ({ id = uniqueId() }) => <Button id={id} /> };
    export const Outer: Story = { render: ({ size = sizes.md }) => <Button size={size} /> };
  `);
  expect(template(input, 'Defaults')).toMatchInlineSnapshot(`
    "const Defaults = () => (
      <Button ⟦attr size size ?'md'⟧ ⟦attr style style ?%7B%20a%3A%201%20%7D⟧ title={⟦operand count ?(2)⟧.toFixed()} ⟦props -size -count -label -style ^title -children⟧>
        ⟦text label ?'Go'⟧
        {{ size: ⟦value size ?'md'⟧, total: ⟦value count ?2⟧ + 1 }.size}
      </Button>
    );"
  `);
  expect(filled(input, 'Defaults', {})).toMatchInlineSnapshot(`
    "const Defaults = () => (
      <Button size={'md'} style={{ a: 1 }} title={(2).toFixed()}>
        {'Go'}
        {{ size: 'md', total: 2 + 1 }.size}
      </Button>
    );"
  `);
  expect(filled(input, 'Defaults', { size: 'lg', count: 3, label: null, style: undefined }))
    .toMatchInlineSnapshot(`
      "const Defaults = () => (
        <Button size="lg" style={{ a: 1 }} title={(3).toFixed()}>
          {{ size: "lg", total: 3 + 1 }.size}
        </Button>
      );"
    `);
  expect(filled(input, 'Outer', {})).toBe('const Outer = () => <Button size={sizes.md} />;');
  expect(template(input, 'Computed')).toBeUndefined();
  expect(template(input, 'Called')).toBeUndefined();
});

test('template: args destructured in the body are holes, without the statement', () => {
  const input = withCSF3(dedent`
    export const Body: Story = {
      render: (args) => {
        const { count = 3, ...buttonProps } = args;
        const { onChange, ...rest } = buttonProps;
        return <Button {...rest} title={args.title}>{count}</Button>;
      },
    };
    export const Nested: Story = {
      render: (args) => {
        const { style: { color } } = args;
        return <Button color={color} />;
      },
    };
  `);
  expect(template(input, 'Body')).toMatchInlineSnapshot(`
    "const Body = () => {
      return <Button ⟦props -count -onChange -title -children⟧ ⟦attr title title⟧>⟦text count ?3⟧</Button>;
    };"
  `);
  expect(filled(input, 'Body', { title: 'Hi', onChange: () => {}, count: 5, size: 'sm' }))
    .toMatchInlineSnapshot(`
      "const Body = () => {
        return <Button size="sm" title="Hi">5</Button>;
      };"
    `);
  expect(filled(input, 'Nested', { style: { color: 'red' } })).toMatchInlineSnapshot(`
    "const Nested = () => {
      const { style: { color } } = { style: { color: "red" } };
      return <Button color={color} />;
    };"
  `);
});

test('template: args passed along whole are the object they are', () => {
  const input = withCSF3(dedent`
    export const Prop: Story = { render: (args) => <Tabs tabProps={args} /> };
    export const Called: Story = {
      render: ({ label, ...rest }) => <Button size={sizeOf(rest)} {...wrap(rest)}>{label}</Button>,
    };
    export const Spread: Story = {
      render: (args) => {
        const props = { ...args, args, value: (args as any)[key] };
        return <Button {...props} />;
      },
    };
    export const Body: Story = { render: (args) => args };
  `);
  expect(template(input, 'Prop')).toBe('const Prop = () => <Tabs tabProps={⟦args⟧} />;');
  const HeartIcon = () => null;
  expect(
    filled(input, 'Prop', { 'aria-label': 'a"b', icon: HeartIcon, onClick: () => {}, n: 1 })
  ).toBe(
    'const Prop = () => <Tabs tabProps={{ "aria-label": "a\\"b", icon: HeartIcon, n: 1 }} />;'
  );
  expect(filled(input, 'Called', { label: 'Go', size: 'sm' })).toBe(
    'const Called = () => <Button size={sizeOf({ size: "sm" })} {...wrap({ size: "sm" })}>Go</Button>;'
  );
  expect(filled(input, 'Spread', {})).toContain(
    'const props = { ...{}, args: {}, value: ({} as any)[key] };'
  );
  expect(filled(input, 'Body', { a: 1 })).toBe('const Body = () => ({ a: 1 });');
});

test('template: keeps another spread on the element as written', () => {
  const input = withCSF3(dedent`
    export const Dynamic: Story = {
      render: (args) => <Button size="sm" {...args} {...dynamicArgs} onClick={log} />,
    };
  `);
  expect(template(input, 'Dynamic')).toBe(
    'const Dynamic = () => <Button size="sm" ⟦props ^size -onClick⟧ {...dynamicArgs} onClick={log} />;'
  );
});

test('template: none for args no hole stands for', () => {
  const input = withCSF3(dedent`
    export const NoArgs: Story = { render: () => <Button /> };
    export const Twice: Story = { render: (args) => <Button {...args} {...args} /> };
    export const Changed: Story = { render: (args) => { normalize(args); return <Button {...args} />; } };
    export const Compared: Story = { render: (args) => { useEffect(log, [args]); return <Button {...args} />; } };
    export const Written: Story = { render: (args) => { args.label = 'x'; return <Button {...args} />; } };
    export const Keyed: Story = { render: (args) => { args[key] = 'x'; return <Button {...args} />; } };
    export const Reassigned: Story = { render: ({ label }) => { label = 'x'; return <Button label={label} />; } };
    export const Shadowed: Story = { render: (args) => <Button label={args.label} />, ...Base };
    export const Tag: Story = { render: ({ as: Tag, label }) => <Tag>{label}</Tag> };
    export const Member: Story = { render: (args) => <args.Icon /> };
  `);
  const stories = ['NoArgs', 'Twice', 'Changed', 'Compared', 'Written', 'Keyed', 'Reassigned'];
  const unusual = ['Shadowed', 'Tag', 'Member'];
  for (const story of [...stories, ...unusual]) {
    expect(template(input, story)).toBeUndefined();
  }
});

test('template: a render behind a spread of a story or a helper call', () => {
  const input = withCSF3(dedent`
    const createStory = (label) => ({ args: { label }, render: (args) => <Button {...args} /> });
    const hideAllControls = () => ({ parameters: { controls: { disable: true } } });
    export const Made: Story = { ...createStory('Go'), args: { primary: true } };
    export const Copied: Story = { ...Made, args: { label: 'Copy' } };
    export const Hidden: Story = { render: (args) => <Button {...args} />, ...hideAllControls() };
  `);
  for (const story of ['Made', 'Copied', 'Hidden']) {
    expect(template(input, story)).toBe(`const ${story} = () => ⟦element Button⟧;`);
  }
  expect(
    getCodeSnippet(loadCsf(input, { makeTitle: () => 'T' }).parse(), 'Made', 'Button').unresolved
  ).toEqual([]);
});

test('template: an arg named with a space is one word', () => {
  const input = withCSF3(dedent`
    export const Spaced: Story = {
      render: ({ 'Render header?': header = true }) => <Button header={header} />,
    };
    export const SpacedRead: Story = {
      render: (args) => <Button title={args['Button title']}>{args['Button title']}</Button>,
    };
  `);
  expect(template(input, 'Spaced')).toMatchInlineSnapshot(
    `"const Spaced = () => <Button ⟦attr header %Render%20header%3F ?true⟧ />;"`
  );
  expect(filled(input, 'Spaced', {})).toMatchInlineSnapshot(
    `"const Spaced = () => <Button header={true} />;"`
  );
  expect(filled(input, 'Spaced', { 'Render header?': false })).toMatchInlineSnapshot(
    `"const Spaced = () => <Button header={false} />;"`
  );
  expect(template(input, 'SpacedRead')).toMatchInlineSnapshot(
    `"const SpacedRead = () => <Button ⟦attr title %Button%20title⟧>⟦text %Button%20title⟧</Button>;"`
  );
  expect(filled(input, 'SpacedRead', { 'Button title': 'Go on' })).toMatchInlineSnapshot(
    `"const SpacedRead = () => <Button title="Go on">Go on</Button>;"`
  );
});
