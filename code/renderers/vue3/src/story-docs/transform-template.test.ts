import { describe, expect, it } from 'vitest';

import type { types as t } from 'storybook/internal/babel';
import { type NodePath } from 'storybook/internal/babel';
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
  returnedObjectExpression,
} from 'storybook/internal/csf-tools';

import { classifyArgs, type VueDocgenArgInfo } from './classify-args.ts';
import {
  readTemplateRenderConfig,
  transformTemplate,
  type TransformTemplateResult,
} from './transform-template.ts';

const DEFAULT_DOCGEN: VueDocgenArgInfo = { props: new Set(), events: new Set(), slots: new Set() };

interface ParsedStory {
  args: ReturnType<typeof classifyArgs>['args'];
  imports: string[];
  template?: string;
}

function parseStory(
  storySource: string,
  docgen: VueDocgenArgInfo = DEFAULT_DOCGEN,
  importSource = "import MyButton from './MyButton.vue';"
): ParsedStory {
  const csf = loadCsf(
    `
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
    objectPropertyPaths(normalized.path),
    csf._storyDeclarationPath.Primary
  );
  const renderObject =
    renderResolution.kind === 'resolved'
      ? returnedObjectExpression(renderResolution.path.node)
      : undefined;
  const config = renderObject
    ? readTemplateRenderConfig(renderObject, collectImportBindings(csf._file.path))
    : undefined;

  return {
    args: classified.args,
    imports: config?.componentImports ? Array.from(config.componentImports.values()) : [],
    template: config?.template,
  };
}

function renderStory(
  storySource: string,
  docgen?: VueDocgenArgInfo
): TransformTemplateResult | undefined {
  const parsed = parseStory(storySource, docgen);
  return parsed.template
    ? transformTemplate({
        args: parsed.args,
        componentImports: new Map(parsed.imports.map((value) => ['MyButton', value])),
        template: parsed.template,
      })
    : undefined;
}

function objectPropertyPaths(path: NodePath<t.ObjectExpression>): NodePath<t.ObjectProperty>[] {
  return path
    .get('properties')
    .filter((property): property is NodePath<t.ObjectProperty> => property.isObjectProperty());
}

describe('transformTemplate', () => {
  it('expands v-bind args into props, v-model bindings, and slot children', () => {
    expect(
      renderStory(
        `
export const Primary = {
  args: {
    default: 'Body copy',
    header: 'Top',
    label: 'Hi',
    modelValue: 'Typed text',
  },
  render: (args) => ({
    components: { MyButton },
    setup() { return { args }; },
    template: '<MyButton v-bind="args" />',
  }),
};
`,
        {
          props: new Set(),
          events: new Set(['update:modelValue']),
          slots: new Set(['default', 'header']),
        }
      )?.snippet
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { ref } from "vue";

      const modelValue = ref('Typed text');

      const _default = 'Body copy';

      const header = 'Top';
      </script>

      <template>
        <MyButton active label="Hi" v-model="modelValue">{{ _default }}<template #header>
          {{ header }}
        </template></MyButton>
      </template>"
    `);
  });

  it('inlines primitive args in text interpolations', () => {
    expect(
      renderStory(`
export const Primary = {
  args: {
    active: false,
    count: 2,
    label: 'Hi',
  },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<p>{{ args.label }} {{ args.count }} {{ args.active }}</p>',
  }),
};
`)?.snippet
    ).toMatchInlineSnapshot(`
      "<template>
        <p>Hi 2 false</p>
      </template>"
    `);
  });

  it('rewrites direct v-bind prop expressions with shared value formatting', () => {
    expect(
      renderStory(`
export const Primary = {
  args: {
    count: 2,
    options: { density: 'compact' },
  },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<MyButton :count="args.count" v-bind:options="args.options" />',
  }),
};
`)?.snippet
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      const options = { density: 'compact' };
      </script>

      <template>
        <MyButton :count="2" :options="options" />
      </template>"
    `);
  });

  it('reserves ref before hoisting template args with v-model', () => {
    expect(
      renderStory(
        `
export const Primary = {
  args: {
    modelValue: 'Typed text',
    ref: { focus: true },
  },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton v-bind="args" />',
  }),
};
`,
        {
          props: new Set(['ref']),
          events: new Set(['update:modelValue']),
          slots: new Set(),
        }
      )?.snippet
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { ref } from "vue";

      const modelValue = ref('Typed text');

      const ref2 = { focus: true };
      </script>

      <template>
        <MyButton active v-model="modelValue" :ref="ref2" />
      </template>"
    `);
  });

  it('bails when args are used in unsupported directive expressions', () => {
    expect(
      renderStory(`
export const Primary = {
  args: { count: 2 },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<MyButton v-if="args.count" />',
  }),
};
`)
    ).toBeUndefined();
  });

  it('bails when setup returns anything except args', () => {
    expect(
      renderStory(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    setup() {
      const state = {};
      return { args, state };
    },
    template: '<MyButton v-bind="args" />',
  }),
};
`)
    ).toBeUndefined();
  });

  it('bails when the returned render object has extra properties', () => {
    expect(
      renderStory(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    data: () => ({}),
    setup: () => ({ args }),
    template: '<MyButton v-bind="args" />',
  }),
};
`)
    ).toBeUndefined();
  });

  it('bails on non-string-literal templates', () => {
    expect(
      renderStory(`
const label = 'Hi';

export const Primary = {
  args: { label },
  render: (args) => ({
    setup: () => ({ args }),
    template: \`<MyButton>\${label}</MyButton>\`,
  }),
};
`)
    ).toBeUndefined();
  });

  it('collects imports only for used components', () => {
    const parsed = parseStory(
      `
const renderStory = (args) => ({
  components: { MyButton, OtherButton },
  setup: () => ({ args }),
  template: '<OtherButton label="Saved" />',
});

export const Primary = {
  args: { label: 'Saved' },
  render: renderStory,
};
`,
      DEFAULT_DOCGEN,
      "import MyButton from './MyButton.vue';\nimport OtherButton from './OtherButton.vue';"
    );
    const transformed = parsed.template
      ? transformTemplate({
          args: parsed.args,
          componentImports: new Map([
            ['MyButton', parsed.imports[0]],
            ['OtherButton', parsed.imports[1]],
          ]),
          template: parsed.template,
        })
      : undefined;

    expect(transformed?.imports).toEqual(["import OtherButton from './OtherButton.vue';"]);
  });

  it('bails when v-bind would add slot args to an element with children', () => {
    expect(
      renderStory(
        `
export const Primary = {
  args: {
    default: 'Replacement body',
  },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<MyButton v-bind="args">Existing body</MyButton>',
  }),
};
`,
        { props: new Set(), events: new Set(), slots: new Set(['default']) }
      )
    ).toBeUndefined();
  });
});
