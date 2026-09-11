import { describe, expect, it } from 'vitest';

import { types as t } from 'storybook/internal/babel';
import {
  collectImportBindings,
  loadCsf,
  metaObjectPath,
  normalizeStoryDeclaration,
  type ReferenceContext,
  resolveArgsRecord,
  resolveBindingMembers,
  resolveObjectMembers,
  resolveRenderFunction,
  returnedExpression,
} from 'storybook/internal/csf-tools';

import {
  classifyArgs,
  type ClassifiedArg,
  type ClassifiedSlotArg,
  type VueDocgenArgInfo,
} from './classify-args.ts';
import { printH } from './print-h.ts';
import { createRenderContext } from './render-primitives.ts';
import { renderSlotArgContent } from './render-slot-content.ts';
import { transformTemplate, type TransformTemplateResult } from './transform-template.ts';

const DEFAULT_DOCGEN: VueDocgenArgInfo = { props: new Set(), events: new Set(), slots: new Set() };

interface ParsedRender {
  args: ClassifiedArg[];
  unsetArgs: ReadonlySet<string>;
  argsParam?: string;
  expression?: t.Node;
  importBindings: ReturnType<typeof collectImportBindings>;
}

/** Runs the real snippet pipeline for an h-render story: print the tree, then transform it. */
function renderStory(
  storySource: string,
  docgen: VueDocgenArgInfo = DEFAULT_DOCGEN,
  importSource = "import MyButton from './MyButton.vue';",
  metaRender?: string,
  componentImportStatement = "import MyButton from './MyButton.vue';"
): TransformTemplateResult | undefined {
  const parsed = parseRender(storySource, docgen, importSource, metaRender);
  if (!parsed.expression) {
    return undefined;
  }

  const ctx = createRenderContext();
  const printed = printH({
    argsParam: parsed.argsParam,
    componentImportStatement,
    componentName: 'MyButton',
    ctx,
    docgen,
    importBindings: parsed.importBindings,
    node: parsed.expression,
  });
  if (!printed) {
    return undefined;
  }

  return transformTemplate({
    args: parsed.args,
    componentImports: printed.componentImports,
    componentName: 'MyButton',
    ctx,
    importBindings: parsed.importBindings,
    template: printed.template,
    unsetArgs: parsed.unsetArgs,
  });
}

/** The markup the printer emits before the engine substitutes args. */
function printedTemplate(
  storySource: string,
  docgen: VueDocgenArgInfo = DEFAULT_DOCGEN
): string | undefined {
  const parsed = parseRender(storySource, docgen);
  if (!parsed.expression) {
    return undefined;
  }

  return printH({
    argsParam: parsed.argsParam,
    componentImportStatement: "import MyButton from './MyButton.vue';",
    componentName: 'MyButton',
    ctx: createRenderContext(),
    docgen,
    importBindings: parsed.importBindings,
    node: parsed.expression,
  })?.template;
}

function parseRender(
  storySource: string,
  docgen: VueDocgenArgInfo = DEFAULT_DOCGEN,
  importSource = "import MyButton from './MyButton.vue';",
  metaRender?: string
): ParsedRender {
  const csf = loadCsf(
    `
import { h } from 'vue';
${importSource}

const meta = {
  component: MyButton,
  title: 'Example/MyButton',
  args: {
    active: true,
  },${
    metaRender
      ? `
  render: ${metaRender},`
      : ''
  }
};

export default meta;

${storySource}
`,
    { makeTitle: () => 'Example/MyButton' }
  ).parse();
  const normalized = normalizeStoryDeclaration(csf._storyDeclarationPath.Primary);

  if (normalized.type !== 'config') {
    throw new Error('Expected a config story');
  }

  const metaPath = metaObjectPath(csf);
  const references: ReferenceContext = { program: csf._file.path, filePath: 'entry.ts' };
  const metaMembers = metaPath ? resolveObjectMembers(metaPath.node, references) : undefined;
  const classified = classifyArgs(
    {
      ...resolveArgsRecord(metaMembers?.properties.args, references).properties,
      ...resolveArgsRecord(
        resolveBindingMembers(references, 'Primary')?.properties.args,
        references
      ).properties,
    },
    docgen
  );
  // Mirrors resolveEffectiveRender in build-story-docs: story render wins, meta is the fallback.
  const storyRender = resolveRenderFunction(normalized.path, csf._storyDeclarationPath.Primary);
  const renderResolution =
    storyRender.kind !== 'missing'
      ? storyRender
      : resolveRenderFunction(metaPath, csf._storyDeclarationPath.Primary);

  if (renderResolution.kind !== 'resolved') {
    return {
      args: classified.args,
      unsetArgs: classified.unset,
      importBindings: collectImportBindings(csf._file.path),
    };
  }

  const [parameter] = renderResolution.path.node.params;
  return {
    args: classified.args,
    unsetArgs: classified.unset,
    argsParam: t.isIdentifier(parameter) ? parameter.name : undefined,
    expression: returnedExpression(renderResolution.path.node),
    importBindings: collectImportBindings(csf._file.path),
  };
}

describe('printH', () => {
  it('preserves args syntax in the printed markup, in source order', () => {
    expect(
      printedTemplate(`
export const Primary = {
  args: {
    count: 2,
    onClick: () => {},
  },
  render: (args) => h(MyButton, { ...args, count: args.count, onClick: args.onClick }),
};
`)
    ).toBe('<MyButton v-bind="args" :count="args.count" @click="args.onClick" />');
  });

  it('expands a whole args object into component props', () => {
    expect(
      renderStory(`
export const Primary = {
  args: {
    label: 'Render',
  },
  render: (args) => h(MyButton, args),
};
`)?.snippet
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton active label="Render" />
      </template>"
    `);
  });

  it('applies args spread and later literal overrides', () => {
    expect(
      renderStory(`
export const Primary = {
  args: {
    count: 2,
    label: 'Render',
  },
  render: (args) => h(MyButton, { ...args, count: args.count, label: 'Override' }),
};
`)?.snippet
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton active :count="2" label="Override" />
      </template>"
    `);
  });

  it('substitutes an arbitrary args expression written into the tree', () => {
    expect(
      renderStory(`
export const Primary = {
  args: { count: 2 },
  render: (args) => h(MyButton, { count: args.count + 1 }),
};
`)?.snippet
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton :count="2 + 1" />
      </template>"
    `);
  });

  it('renames a render parameter that is not called args', () => {
    expect(
      renderStory(`
export const Primary = {
  args: {
    label: 'Render',
  },
  render: (props) => h(MyButton, { ...props, label: props.label }),
};
`)?.snippet
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton active label="Render" />
      </template>"
    `);
  });

  it('bails when renaming the render parameter would capture another args binding', () => {
    expect(
      renderStory(`
const args = { label: 'Outer' };

export const Primary = {
  render: (props) => h(MyButton, { label: args.label }),
};
`)
    ).toBeUndefined();
  });

  it('falls back to a render function defined on the meta', () => {
    expect(
      renderStory(
        `
export const Primary = {
  args: {
    label: 'Render',
  },
};
`,
        DEFAULT_DOCGEN,
        "import MyButton from './MyButton.vue';",
        `(args) => h(MyButton, args)`
      )?.snippet
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton active label="Render" />
      </template>"
    `);
  });

  it('prefers the story render function over the meta render function', () => {
    expect(
      renderStory(
        `
export const Primary = {
  args: {
    label: 'Render',
  },
  render: (args) => h(MyButton, { ...args, label: 'Story' }),
};
`,
        DEFAULT_DOCGEN,
        "import MyButton from './MyButton.vue';",
        `() => h('div', 'Meta')`
      )?.snippet
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton active label="Story" />
      </template>"
    `);
  });

  it('hoists prop values that resolve against JavaScript globals, in source order', () => {
    expect(
      renderStory(`
export const Primary = {
  render: () => h(MyButton, { date: new Date('2020-01-01'), ratio: Math.PI, label: \`a\${1}b\` }),
};
`)?.snippet
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const date = new Date('2020-01-01');

      const ratio = Math.PI;

      const label = \`a\${1}b\`;
      </script>

      <template>
        <MyButton :date="date" :ratio="ratio" :label="label" />
      </template>"
    `);
  });

  it('renders string tags, nested h children, and array children', () => {
    expect(
      renderStory(`
export const Primary = {
  render: () => h('div', { class: 'wrap' }, [h('strong', 'Title'), ' body']),
};
`)?.snippet
    ).toMatchInlineSnapshot(`
      "<template>
        <div class="wrap"><strong>Title</strong> body</div>
      </template>"
    `);
  });

  it('renders slots-object children', () => {
    expect(
      renderStory(`
export const Primary = {
  render: () => h(MyButton, null, {
    default: () => h('span', 'Body'),
    footer: () => h('strong', 'Foot'),
  }),
};
`)?.snippet
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton>
          <span>Body</span>
          <template #footer>
            <strong>Foot</strong>
          </template>
        </MyButton>
      </template>"
    `);
  });

  it('renders a slot function written directly into the props argument', () => {
    expect(
      renderStory(
        `
export const Primary = {
  render: () => h(MyButton, { default: () => h(ChildButton, { label: 'Click me' }) }),
};
`,
        { props: new Set(), events: new Set(), slots: new Set(['default']) },
        "import ChildButton from './ChildButton.vue';\nimport MyButton from './MyButton.vue';"
      )
    ).toEqual({
      snippet: `<script lang="ts" setup>
import ChildButton from './ChildButton.vue';
import MyButton from './MyButton.vue';
</script>

<template>
  <MyButton>
    <ChildButton label="Click me" />
  </MyButton>
</template>`,
    });
  });

  it('keeps story docgen roles off tags other than the story component', () => {
    expect(
      renderStory(
        `
export const Primary = {
  render: () => h('section', null, [
    h('div', { default: 'Body' }),
    h(ChildButton, { default: 'Inner' }),
  ]),
};
`,
        { props: new Set(), events: new Set(), slots: new Set(['default']) },
        "import ChildButton from './ChildButton.vue';\nimport MyButton from './MyButton.vue';"
      )?.snippet
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import ChildButton from './ChildButton.vue';
      </script>

      <template>
        <section>
          <div default="Body"></div>
          <ChildButton default="Inner" />
        </section>
      </template>"
    `);
  });

  it('bails on a function prop the story docgen does not describe', () => {
    expect(
      renderStory(
        `
export const Primary = {
  render: () => h('div', { onClick: () => null }),
};
`,
        { props: new Set(), events: new Set(['click']), slots: new Set() }
      )
    ).toBeUndefined();
  });

  it('renders a slot forwarded through an explicit args member read', () => {
    expect(
      renderStory(
        `
export const Primary = {
  args: {
    default: () => h(ChildButton, { label: 'Click me' }),
  },
  render: (args) => h(MyButton, { default: args.default }),
};
`,
        { props: new Set(), events: new Set(), slots: new Set(['default']) },
        "import ChildButton from './ChildButton.vue';\nimport MyButton from './MyButton.vue';"
      )?.snippet
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import ChildButton from './ChildButton.vue';
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton>
          <ChildButton label="Click me" />
        </MyButton>
      </template>"
    `);
  });

  // `<input …></input>` is not markup Vue will compile, so void elements have to close themselves.
  it('self-closes void elements', () => {
    expect(
      renderStory(`export const Primary = { render: () => h('input', { type: 'text' }) };`)?.snippet
    ).toMatchInlineSnapshot(`
      "<template>
        <input type="text" />
      </template>"
    `);
  });

  it.each([
    ['void elements given children', `export const Primary = { render: () => h('br', 'x') };`],
    [
      'component string tags with no import to declare',
      `export const Primary = { render: () => h('Unknown', { label: 'x' }) };`,
    ],
  ])('does not print unrepresentable %s', (_name, storySource) => {
    expect(renderStory(storySource)).toBeUndefined();
  });

  it('escapes text children so markup and interpolation cannot be injected', () => {
    expect(
      renderStory(`
export const Primary = {
  render: () => h('p', ['a < b && c > d', ' {{ notAnExpression }}']),
};
`)?.snippet
    ).toMatchInlineSnapshot(`
      "<template>
        <p>a &lt; b &amp;&amp; c &gt; d &#123;&#123; notAnExpression }}</p>
      </template>"
    `);
  });

  it('renders zero-argument h slot functions with imports', () => {
    const parsed = parseRender(
      `
export const Primary = {
  args: {
    default: () => h(ChildButton, { label: 'Click me' }),
  },
  render: (args) => h(MyButton, args),
};
`,
      { props: new Set(), events: new Set(), slots: new Set(['default']) },
      "import ChildButton from './ChildButton.vue';\nimport MyButton from './MyButton.vue';"
    );
    const arg = parsed.args.find(
      (candidate): candidate is ClassifiedSlotArg => candidate.role === 'slot'
    );
    const ctx = createRenderContext();
    const content = arg ? renderSlotArgContent(arg, ctx, parsed.importBindings) : undefined;

    expect(content).toBe('<ChildButton label="Click me" />');
    // The slot's own component import lands in the context the snippet is being assembled in.
    expect([...ctx.componentImports]).toEqual(["import ChildButton from './ChildButton.vue';"]);
  });

  it.each([
    [
      'an args expression that would end the printed attribute quote',
      `
export const Primary = {
  args: { label: 'Render' },
  render: (args) => h(MyButton, { label: args.label + '"' }),
};
`,
    ],
    [
      'an args expression containing an ampersand',
      `
export const Primary = {
  args: { label: 'Render' },
  render: (args) => h(MyButton, { label: args.label + '&' }),
};
`,
    ],
    [
      'an args text child that would end the printed interpolation',
      `
export const Primary = {
  args: { label: 'Render' },
  render: (args) => h('p', [args.label + ' }} ']),
};
`,
    ],
  ])('does not print %s', (_name, storySource) => {
    expect(renderStory(storySource)).toBeUndefined();
  });

  it.each([
    [
      'conditional props',
      `
const fallback = { label: 'Off' };

export const Primary = {
  args: { active: true },
  render: (args) => h(MyButton, args.active ? { label: 'On' } : fallback),
};
`,
    ],
    [
      'function calls other than h',
      `
const labelFor = (label: string) => label;

export const Primary = {
  args: { label: 'Render' },
  render: (args) => h(MyButton, { label: labelFor(args.label) }),
};
`,
    ],
    [
      'non-args identifier props',
      `
const sharedProps = { label: 'Shared' };

export const Primary = {
  render: () => h(MyButton, sharedProps),
};
`,
    ],
    [
      'member-expression components',
      `
const UI = { Button: MyButton };

export const Primary = {
  render: () => h(UI.Button, { label: 'Render' }),
};
`,
    ],
    [
      'non-args spreads',
      `
const sharedProps = { label: 'Shared' };

export const Primary = {
  render: (args) => h(MyButton, { ...sharedProps, label: args.label }),
};
`,
    ],
  ])('bails on %s', (_name, storySource) => {
    expect(renderStory(storySource)).toBeUndefined();
  });
});
