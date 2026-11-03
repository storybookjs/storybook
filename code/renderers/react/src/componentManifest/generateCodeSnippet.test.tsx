import { expect, test, vi } from 'vitest';

import {
  type ESTreeNode,
  createStoryArgsResolver,
  loadCsf,
  unresolvedWarning,
} from 'storybook/internal/csf-tools';
import { UnprintableArgError, writtenArg } from 'storybook/internal/docs-tools';
import { selectLiveSnippetForStory } from 'storybook/open-service';

import { dedent } from 'ts-dedent';

import { fillTemplate } from '../docs/fill-template.ts';
import { getCodeSnippet } from './generateCodeSnippet.ts';

/**
 * The invariant every template keeps: filled with the story's own args, as the preview has them
 * before a control changes them, it is the static snippet.
 */
function expectTemplatesFillToSnippets(csf: ReturnType<typeof loadCsf>) {
  const resolver = createStoryArgsResolver(csf);
  for (const name of Object.keys(csf._storyExports)) {
    let printed;
    try {
      printed = getCodeSnippet(csf, name, csf._meta?.component ?? 'ComponentTitle', resolver);
    } catch {
      continue;
    }
    if (printed.template === undefined) {
      continue;
    }
    const own: Record<string, unknown> = {};
    for (const [key, node] of Object.entries(resolver.resolve(name).args)) {
      own[key] =
        printed.argCode && Object.hasOwn(printed.argCode, key)
          ? writtenArg(printed.argCode[key]!)
          : literalValue(node);
    }
    expect(fillTemplate(printed.template, own), name).toBe(printed.snippet);
  }
}

const literalValue = (node: ESTreeNode): unknown =>
  node.type === 'UnaryExpression' && node.argument.type === 'Literal'
    ? -(node.argument.value as number)
    : node.type === 'Literal'
      ? node.value
      : undefined;

function generateExample(code: string) {
  const csf = loadCsf(code, { makeTitle: (userTitle?: string) => userTitle ?? 'title' }).parse();
  expectTemplatesFillToSnippets(csf);

  const snippets = Object.keys(csf._storyExports).map(
    (name) => getCodeSnippet(csf, name, csf._meta?.component ?? 'ComponentTitle').snippet
  );

  return snippets.join('\n');
}

/** Snippet plus what it still depends on, for the cases that resolve names rather than values. */
function generateResolved(code: string) {
  const csf = loadCsf(code, { makeTitle: (userTitle?: string) => userTitle ?? 'title' }).parse();
  expectTemplatesFillToSnippets(csf);

  return Object.keys(csf._storyExports).map((name) => {
    const snippet = getCodeSnippet(csf, name, csf._meta?.component ?? 'ComponentTitle');
    return {
      snippet: snippet.snippet,
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
    (13:27)
    > 13 |     export const Default = someImportOrWhatever;
         |                            ^]
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
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const ObjectArgs = () => <Button string="string" number={1} object={{ an: 'object'}} complexObject={{...{a: 1}, an: 'object'}} array={[1,2,3]}>Click me</Button>;"`
  );
});

test('CSF1', () => {
  const input = withCSF3(dedent`
    export const CSF1: StoryFn = () => <Button label="String"></Button>;
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const CSF1 = () => <Button label="String"></Button>;"`
  );
});

test('Local function story reference', () => {
  const input = withCSF3(dedent`
    const ParagraphStory = () => <Button />;
    export const Example = ParagraphStory;
  `);
  expect(generateExample(input)).toBe('const Example = () => <Button />;');
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
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"function Interactive() { return <Button label="String">Click me</Button> }"`
  );
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
    `"const CustomRenderBlockBody = () => { return <Button foo="bar">Render</Button> };"`
  );
});

test('async render with a block body', async () => {
  const input = withCSF3(
    `export const AsyncRender = {
      render: async (args) => {
        const data = await load();
        return <Button {...args} data={data}>Render</Button>;
      },
      args: { foo: 'bar' }
    };`
  );
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const AsyncRender = async () => {
      const data = await load();
      return <Button foo="bar" data={data}>Render</Button>;
    };"
  `);
});

test('template literal inside a render body keeps its lines', async () => {
  const input = withCSF3(
    `export const Template = {
      render: (args) => {
        const code = \`line1
line2\`;
        return <Button {...args}>{code}</Button>;
      },
      args: { foo: 'bar' }
    };`
  );
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const Template = () => {
      const code = \`line1
    line2\`;
      return <Button foo="bar">{code}</Button>;
    };"
  `);
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
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const ObjectInvalidAttr = () => <Button {...{ "1x": 'a', "bad key": 'b', "@foo": 'c', "-dash": 'd' }}>Click me</Button>;"`
  );
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

test('an imported bound story keeps its helper and resolved args', () => {
  const input = dedent`
    import { Button } from '@design-system/button';
    import { renderMatch as Match } from './match-helper';
    export default { title: 'Match', component: Button };
    export const FirstHalf = Match.bind({});
    FirstHalf.args = { home: 'Arsenal', away: 'Aston Villa' };
  `;

  expect(generateResolved(input)).toEqual([
    {
      snippet:
        'const FirstHalf = () => Match.bind({})({\n    "home": \'Arsenal\',\n    "away": \'Aston Villa\'\n});',
      imports: ['renderMatch from ./match-helper'],
      unresolved: [],
    },
  ]);
  expect(template(input, 'FirstHalf')).toBe('const FirstHalf = () => Match.bind({})(⟦args⟧);');
});

test('a comma expression arg keeps its parentheses', () => {
  const input = withCSF3(dedent`
    export const Synthesized: Story = { args: { label: (f(), 'x'), '2x': (f(), 'y') } };
    export const Rendered: Story = {
      args: { label: (f(), 'x'), children: (f(), 'z') },
      render: (args) => <Button {...args} />,
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const Synthesized = () => <Button label={(f(), 'x')} {...{ "2x": (f(), 'y') }}>Click me</Button>;
    const Rendered = () => <Button label={(f(), 'x')}>{(f(), 'z')}</Button>;"
  `);
});

test('an imported bound story keeps the parentheses of a comma expression arg', () => {
  const input = dedent`
    import { renderMatch as Match } from './match-helper';
    export default { title: 'Match' };
    export const FirstHalf = Match.bind({});
    FirstHalf.args = { home: (f(), 'Arsenal') };
  `;

  expect(generateExample(input)).toBe(
    'const FirstHalf = () => Match.bind({})({\n    "home": (f(), \'Arsenal\')\n});'
  );
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
  expect(generateExample(input)).toMatchInlineSnapshot(
    `
    "const Shorthand = () => <Button cfg={{
      dep,
      nested: {
        size: 'md'
      }
    }}>Click me</Button>;"
  `
  );
});

test('a string arg prints as an attribute only when JSX reads it back unchanged', () => {
  const input = withCSF3(dedent`
    export const Strings: Story = {
      args: { quote: 'say "hi"', entity: 'a &amp; b', lines: 'a\\nb', path: 'C:\\\\temp' },
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const Strings = () => <Button quote={'say "hi"'} entity={'a &amp; b'} lines={'a\\nb'} path="C:\\temp">Click me</Button>;"`
  );
});

test('children that JSX text cannot hold stay an expression', () => {
  const input = withCSF3(dedent`
    export const Braces: Story = { args: { children: 'a {b} <c>' } };
    export const Entity: Story = { args: { children: 'a &amp; b' } };
    export const Lines: Story = { args: { children: 'a\\nb' } };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const Braces = () => <Button>{'a {b} <c>'}</Button>;
    const Entity = () => <Button>{'a &amp; b'}</Button>;
    const Lines = () => <Button>{'a\\nb'}</Button>;"
  `);
});

test('a read of a name every object inherits is not an arg', () => {
  const input = withCSF3(dedent`
    export const Inherited: Story = {
      render: (args) => <Button title={args.constructor} />,
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const Inherited = (args) => <Button title={args.constructor} />;"`
  );
});

test('a multi-line arg lands at the indent of the line it is placed on', () => {
  const input = withCSF3(dedent`
    export const Spread: Story = {
      args: {
        style: {
          color: 'red',
        },
      },
      render: (args) => (
        <div>
          <Button {...args} />
        </div>
      ),
    };

    export const Read: Story = {
      args: {
        onClick: () => {
          console.log('clicked');
        },
      },
      render: (args) => (
        <div>
          <Button onClick={args.onClick} />
        </div>
      ),
    };

    export const Synthesized: Story = {
      args: {
        items: [
          'one',
          'two',
        ],
      },
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const Spread = () => <div>
      <Button style={{
        color: 'red',
      }}>Click me</Button>
    </div>;
    const Read = () => <div>
      <Button onClick={() => {
        console.log('clicked');
      }} />
    </div>;
    const Synthesized = () => <Button items={[
      'one',
      'two',
    ]}>Click me</Button>;"
  `);
});

test('a rebuilt arg object keeps its members inside the line it is placed on', () => {
  const input = withCSF3(dedent`
    const base = { color: 'red' };

    export const Rebuilt: Story = {
      args: { style: { ...base, size: 2 } },
      render: (args) => (
        <div>
          <Button {...args} />
        </div>
      ),
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const Rebuilt = () => <div>
      <Button style={{
        color: 'red',
        size: 2
      }}>Click me</Button>
    </div>;"
  `);
});

test('a multi-line template literal arg keeps the lines of its value', () => {
  const input = withCSF3(dedent`
    export const Template: Story = {
      args: {
        code: \`first
      second\`,
      },
      render: (args) => (
        <div>
          <Button code={args.code} />
        </div>
      ),
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const Template = () => <div>
      <Button code={\`first
      second\`} />
    </div>;"
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

test('template: an arg next fills in is a hole, and one the story does not set prints as written until a control sets it', () => {
  const input = withCSF3(dedent`
    export const Card: Story = {
      args: { title: 'Hi' },
      render: (args) => <Card title={args.title} label={args.label}>{args.children}</Card>,
    };
  `);
  expect(template(input, 'Card')).toBe(
    'const Card = (args) => <Card ⟦attr title title⟧ ⟦attr label label ?label%3D%7Bargs.label%7D⟧>⟦text children⟧</Card>;'
  );
  expect(filled(input, 'Card', { title: 'Bye', children: 'Save' })).toBe(
    'const Card = (args) => <Card title="Bye" label={args.label}>Save</Card>;'
  );
  expect(filled(input, 'Card', { title: 'Bye', label: 'Go', children: 'Save' })).toBe(
    'const Card = (args) => <Card title="Bye" label="Go">Save</Card>;'
  );
});

test('template: code that reads an arg some other way stays as written', () => {
  const input = withCSF3(dedent`
    export const Read: Story = {
      args: { value: 10, label: 'Go' },
      render: (args) => {
        const [value] = useState(args.value);
        return <Input value={value} label={args.label} />;
      },
    };
  `);
  expect(template(input, 'Read')).toMatchInlineSnapshot(`
    "const Read = (args) => {
      const [value] = useState(args.value);
      return <Input value={value} ⟦attr label label⟧ />;
    };"
  `);
});

test('template: a spread is a hole for every arg but the attributes written next to it', () => {
  const input = withCSF3(dedent`
    export const Before: Story = { render: (args) => <Button size="sm" {...args} /> };
    export const Both: Story = { render: (args) => <Button size="sm" {...args} size="md" /> };
    export const Nested: Story = { render: (args) => <div><Button {...args} /></div> };
    export const Dynamic: Story = {
      render: (args) => <Button size="sm" {...args} {...dynamicArgs} onClick={log} />,
    };
  `);
  expect(template(input, 'Before')).toBe(
    'const Before = () => <Button size="sm" ⟦props -size -children⟧⟦close Button ?%20%2F%3E⟧;'
  );
  expect(filled(input, 'Before', { label: 'Go', size: 'lg' })).toBe(
    'const Before = () => <Button size="sm" label="Go" />;'
  );
  expect(filled(input, 'Before', { label: 'Go', children: 'Save' })).toBe(
    'const Before = () => <Button size="sm" label="Go">Save</Button>;'
  );
  expect(template(input, 'Both')).toBe(
    'const Both = () => <Button size="sm" ⟦props -size -children⟧ size="md"⟦close Button ?%20%2F%3E⟧;'
  );
  expect(template(input, 'Nested')).toBe(
    'const Nested = () => <div><Button ⟦props -children⟧⟦close Button ?%20%2F%3E⟧</div>;'
  );
  expect(template(input, 'Dynamic')).toBe(
    'const Dynamic = () => <Button size="sm" ⟦props -size -onClick -children⟧ {...dynamicArgs} onClick={log}⟦close Button ?%20%2F%3E⟧;'
  );
});

test('template: a component that names no element is the element as printed', () => {
  const input = dedent`
    import { Button } from './Button';
    export default { component: Button as any };
    export const Cast = { args: { label: 'Go' } };
  `;
  expect(template(input, 'Cast')).toBe('const Cast = () => ⟦element %Button%20as%20any⟧;');
});

test('template: prints a component arg as the story writes it, and none a control maps to', () => {
  const input = withCSF3(
    `export const Icon: Story = { args: { icon: HeartIcon, render: () => <b /> } };`
  );
  const csf = loadCsf(input, { makeTitle: () => 'T' }).parse();
  expect(getCodeSnippet(csf, 'Icon', 'Button').snippet).toBe(
    'const Icon = () => <Button icon={HeartIcon} render={() => <b />}>Click me</Button>;'
  );
  const HeartIcon = () => null;
  expect(() => filled(input, 'Icon', { icon: HeartIcon })).toThrow(UnprintableArgError);
});

test('template: an arg named with a space is one word', () => {
  const input = withCSF3(dedent`
    export const Spaced: Story = {
      args: { 'Button title': 'Go' },
      render: (args) => <Button title={args['Button title']} />,
    };
  `);
  expect(template(input, 'Spaced')).toBe(
    'const Spaced = () => <Button ⟦attr title %Button%20title⟧ />;'
  );
  expect(filled(input, 'Spaced', { 'Button title': 'Go on' })).toBe(
    'const Spaced = () => <Button title="Go on" />;'
  );
});

test('template: an arg that still holds the value the story writes stays as written', () => {
  const input = withCSF3(dedent`
    import { fn } from 'storybook/test';
    import { FormControl } from '@angular/forms';
    import { shout } from './format';

    export const Form: Story = {
      args: {
        label: 'Go',
        formatter: shout,
        select: fn((o) => o.name),
        control: new FormControl('x'),
      },
    };
  `);
  const csf = loadCsf(input, { makeTitle: () => 'T' }).parse();
  const { snippet, template, argCode } = getCodeSnippet(csf, 'Form', 'Button');
  expect(argCode).toEqual({
    formatter: 'shout',
    select: 'fn((o) => o.name)',
    control: "new FormControl('x')",
  });
  class FormControl {
    constructor(readonly value: string) {}
  }
  const initialArgs = {
    children: 'Click me',
    label: 'Go',
    formatter: (text: string) => text.toUpperCase(),
    select: vi.fn((o: { name: string }) => o.name),
    control: new FormControl('x'),
  };
  const args = { ...initialArgs, label: 'Stop' };
  const payload = {
    id: 't',
    name: 'T',
    path: './T.stories.tsx',
    stories: {
      't--form': {
        id: 't--form',
        name: 'Form',
        snippet,
        template,
        argCode,
      },
    },
  };
  expect(
    selectLiveSnippetForStory(
      payload,
      't--form',
      { args, unmappedArgs: args, initialArgs },
      fillTemplate
    ).snippet
  ).toMatchInlineSnapshot(
    `"const Form = () => <Button label="Stop" formatter={shout} select={fn((o) => o.name)} control={new FormControl('x')}>Click me</Button>;"`
  );
});

test('template: the filled snippet keeps the warning of the static one', () => {
  const input = withCSF3(dedent`
    function shout(text) { return text.toUpperCase(); }
    export const Shout: Story = { args: { format: shout, label: 'Go' } };
  `);
  const csf = loadCsf(input, { makeTitle: () => 'T' }).parse();
  const { template, unresolved, templateWarning } = getCodeSnippet(csf, 'Shout', 'Button');
  expect(template).toBeDefined();
  expect(unresolved).not.toEqual([]);
  expect(templateWarning).toBe(unresolvedWarning(unresolved));
});

test('template: an arg no attribute can be named as is spread', () => {
  const input = withCSF3(dedent`
    export const Spaced: Story = { args: { 'my label': 'Go' } };
  `);
  const csf = loadCsf(input, { makeTitle: () => 'T' }).parse();
  const { snippet, template } = getCodeSnippet(csf, 'Spaced', 'Button');
  expect(template).toBe('const Spaced = () => ⟦element Button⟧;');
  expect(snippet).toMatchInlineSnapshot(
    `"const Spaced = () => <Button {...{ "my label": 'Go' }}>Click me</Button>;"`
  );
  expect(filled(input, 'Spaced', { 'my label': 'Go' })).toBe(
    'const Spaced = () => <Button {...{ "my label": "Go" }} />;'
  );
});

test('template: a long literal prints in full', () => {
  const label = `&${'x'.repeat(2000)}`;
  const input = withCSF3(`export const Long: Story = { args: { label: '${label}' } };`);
  const csf = loadCsf(input, { makeTitle: () => 'T' }).parse();
  expect(getCodeSnippet(csf, 'Long', 'Button').template).toBe(
    'const Long = () => ⟦element Button⟧;'
  );
  expect(filled(input, 'Long', { label })).toContain(`label={"${label}"}`);
});

test('template: none for a story file that already holds a hole bracket', () => {
  const input = withCSF3(`export const Bracket: Story = { args: { label: '⟦x⟧' } };`);
  const csf = loadCsf(input, { makeTitle: () => 'T' }).parse();
  const { snippet, template } = getCodeSnippet(csf, 'Bracket', 'Button');
  expect(template).toBeUndefined();
  expect(snippet).toBe('const Bracket = () => <Button label="⟦x⟧">Click me</Button>;');
});

test('template: an element that closes on its own line fills to the snippet, also with content', () => {
  const input = withCSF3(dedent`
    export const OwnLine: Story = {
      args: { label: 'Go' },
      render: (args) => (
        <Button
          {...args}
          onClick={() => alert('clicked')}
        />
      ),
    };
    export const OwnLineChildren: Story = {
      args: { children: <span>
        hi
      </span> },
      render: (args) => (
        <div>
          <Button
            {...args}
          />
        </div>
      ),
    };
  `);
  // `generateExample` checks that each template filled with the story's own args is its snippet.
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const OwnLine = () => <Button
      label="Go"
      onClick={() => alert('clicked')}>Click me</Button>;
    const OwnLineChildren = () => <div>
      <Button><span>
        hi
      </span></Button>
    </div>;"
  `);
  expect(filled(input, 'OwnLine', { label: 'Stop' })).toContain(`label="Stop"`);
});

test('template: an element without children that closes on its own line keeps that line', () => {
  const input = dedent`
    import { Button } from './Button';
    export default { component: Button };
    export const OwnLine = {
      args: { label: 'Go' },
      render: (args) => (
        <Button
          {...args}
          onClick={() => alert('clicked')}
        />
      ),
    };
  `;
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const OwnLine = () => <Button
      label="Go"
      onClick={() => alert('clicked')}
    />;"
  `);
  expect(filled(input, 'OwnLine', { label: 'Stop' })).toContain(`  label="Stop"`);
});

test('template: children print as the snippet prints them', () => {
  const input = withCSF3(dedent`
    export const Empty: Story = { args: { children: '' } };
    export const Spaced: Story = { args: { children: ' Hello ' } };
    export const SpreadEmpty: Story = { args: { children: '' }, render: (args) => <Button {...args} /> };
    export const Count: Story = { args: { children: 5, label: 'a' } };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(`
    "const Empty = () => <Button />;
    const Spaced = () => <Button> Hello </Button>;
    const SpreadEmpty = () => <Button></Button>;
    const Count = () => <Button label="a">{5}</Button>;"
  `);
  expect(filled(input, 'Count', { label: 'b', children: 6 })).toBe(
    'const Count = () => <Button label="b">{6}</Button>;'
  );
  expect(filled(input, 'Count', { label: 'b', children: true })).toBe(
    'const Count = () => <Button label="b">{true}</Button>;'
  );
});

test('template: an arg the story does not set is a hole that prints the read as written', () => {
  const input = withCSF3(dedent`
    export const Unset: Story = {
      args: { size: 'sm' },
      render: (args) => <Button size={args.size} label={args.label} />,
    };
  `);
  expect(generateExample(input)).toMatchInlineSnapshot(
    `"const Unset = (args) => <Button size="sm" label={args.label} />;"`
  );
  expect(filled(input, 'Unset', { size: 'sm', label: 'Go' })).toBe(
    'const Unset = (args) => <Button size="sm" label="Go" />;'
  );
});
