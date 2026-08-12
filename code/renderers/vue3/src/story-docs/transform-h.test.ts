import { describe, expect, it } from 'vitest';

import { types as t } from 'storybook/internal/babel';
import {
  argsRecordFromObjectPath,
  collectImportBindings,
  keyOf,
  loadCsf,
  mergeArgsRecords,
  metaArgsRecord,
  metaObjectPath,
  normalizeStoryDeclaration,
  resolveRenderFunction,
  returnedExpressionPath,
} from 'storybook/internal/csf-tools';

import { classifyArgs, type ClassifiedArg, type VueDocgenArgInfo } from './classify-args.ts';
import { createRenderContext } from './render-sfc.ts';
import { renderHSlotFunction, transformH, type TransformHResult } from './transform-h.ts';

const DEFAULT_DOCGEN: VueDocgenArgInfo = { props: new Set(), events: new Set(), slots: new Set() };

interface ParsedRender {
  args: ClassifiedArg[];
  argsParam?: string;
  expression?: t.Node;
  importBindings: ReturnType<typeof collectImportBindings>;
}

function renderStory(
  storySource: string,
  docgen: VueDocgenArgInfo = DEFAULT_DOCGEN,
  importSource = "import MyButton from './MyButton.vue';"
): TransformHResult | undefined {
  const parsed = parseRender(storySource, docgen, importSource);
  return parsed.expression
    ? transformH({
        args: parsed.args,
        argsParam: parsed.argsParam,
        importBindings: parsed.importBindings,
        node: parsed.expression,
      })
    : undefined;
}

function parseRender(
  storySource: string,
  docgen: VueDocgenArgInfo = DEFAULT_DOCGEN,
  importSource = "import MyButton from './MyButton.vue';"
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
  },
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

  const storyArgsPath = normalized.path
    .get('properties')
    .find((property) => property.isObjectProperty() && keyOf(property.node) === 'args')
    ?.get('value');
  const storyArgsObjectPath =
    storyArgsPath && !Array.isArray(storyArgsPath) && storyArgsPath.isObjectExpression()
      ? storyArgsPath
      : undefined;
  const storyArgs = storyArgsObjectPath ? argsRecordFromObjectPath(storyArgsObjectPath) : {};
  const classified = classifyArgs(
    mergeArgsRecords(metaArgsRecord(metaObjectPath(csf)?.node), storyArgs),
    docgen
  );
  const renderResolution = resolveRenderFunction(
    normalized.path,
    csf._storyDeclarationPath.Primary
  );

  if (renderResolution.kind !== 'resolved') {
    return {
      args: classified.args,
      importBindings: collectImportBindings(csf._file.path),
    };
  }

  const [parameter] = renderResolution.path.node.params;
  return {
    args: classified.args,
    argsParam: t.isIdentifier(parameter) ? parameter.name : undefined,
    expression: returnedExpressionPath(renderResolution.path)?.node,
    importBindings: collectImportBindings(csf._file.path),
  };
}

describe('transformH', () => {
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
      "<template>
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
      "<template>
        <MyButton active :count="2" label="Override" />
      </template>"
    `);
  });

  it('hoists prop values that resolve against JavaScript globals', () => {
    expect(
      renderStory(`
export const Primary = {
  render: () => h(MyButton, { date: new Date('2020-01-01'), ratio: Math.PI, label: \`a\${1}b\` }),
};
`)?.snippet
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      const date = new Date('2020-01-01');

      const label = \`a\${1}b\`;

      const ratio = Math.PI;
      </script>

      <template>
        <MyButton :date="date" :label="label" :ratio="ratio" />
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
      "<template>
        <MyButton><span>Body</span><template #footer>
          <strong>Foot</strong>
        </template></MyButton>
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
    const slot = parsed.args.find((arg) => arg.role === 'slot');
    const value = slot?.value;
    const rendered =
      value && (t.isArrowFunctionExpression(value) || t.isFunctionExpression(value))
        ? renderHSlotFunction({
            node: value,
            ctx: createRenderContext(),
            importBindings: parsed.importBindings,
          })
        : undefined;

    expect(rendered).toEqual({
      content: '<ChildButton label="Click me" />',
      imports: ["import ChildButton from './ChildButton.vue';"],
    });
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
      'computed values',
      `
export const Primary = {
  args: { count: 2 },
  render: (args) => h(MyButton, { count: args.count + 1 }),
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
