import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import { babelParse, types as t } from 'storybook/internal/babel';
import type { IndexEntry } from 'storybook/internal/types';
import type { DocgenPayload } from 'storybook/open-service';

import { buildStoryDocsPayload } from './build-story-docs.ts';
import type { ClassifiedArg } from './classify-args.ts';
import { transformTemplate } from './transform-template.ts';

vi.mock('node:fs/promises', { spy: true });

const STORY_PATH = '/stories/MyButton.stories.ts';

const DOCGEN_CATEGORIES: Record<string, string> = {
  active: 'props',
  columns: 'props',
  count: 'props',
  isCollapsed: 'props',
  label: 'props',
  options: 'props',
  release: 'props',
  ref: 'props',
  row: 'props',
  status: 'props',
  theme: 'props',
  updateProgressInfo: 'props',
  click: 'events',
  submit: 'events',
  'update:modelValue': 'events',
  default: 'slots',
  header: 'slots',
};

function docgen(id: string): DocgenPayload {
  return {
    id,
    name: 'MyButton',
    path: STORY_PATH,
    jsDocTags: {},
    argTypes: Object.fromEntries(
      Object.entries(DOCGEN_CATEGORIES).map(([name, category]) => [
        name,
        { name, table: { category }, type: { name: 'other', value: 'unknown' } },
      ])
    ),
  };
}

const ENTRY: IndexEntry = {
  id: 'mybutton--primary',
  name: 'Primary',
  title: 'Example/MyButton',
  type: 'story',
  subtype: 'story',
  importPath: STORY_PATH,
};

async function buildPayload(
  storySource: string,
  importSource = "import MyButton from './MyButton.vue';",
  componentName = 'MyButton'
) {
  vol.fromJSON({
    [STORY_PATH]: `
${importSource}

const meta = {
  component: ${componentName},
  title: 'Example/MyButton',
};

export default meta;

${storySource}
`,
  });

  const payload = await buildStoryDocsPayload(
    { entry: ENTRY },
    { readDocgen: async (id) => docgen(id) }
  );
  if (!payload) {
    throw new Error('Expected a story docs payload for the test story file');
  }
  return payload;
}

async function primarySnippet(storySource: string, importSource?: string, componentName?: string) {
  const payload = await buildPayload(storySource, importSource, componentName);
  return payload.stories['example-mybutton--primary']?.snippet;
}

beforeEach(async () => {
  vol.reset();
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(readFile).mockImplementation(
    memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
  );
});

describe('transformTemplate', () => {
  it('expands v-bind args into props and event listeners', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: {
    active: true,
    label: 'Hi',
    onClick: () => {},
  },
  render: (args) => ({
    components: { MyButton },
    setup() { return { args }; },
    template: '<MyButton v-bind="args" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const onClick = () => {};
      </script>

      <template>
        <MyButton active label="Hi" @click="onClick" />
      </template>"
    `);
  });

  it('expands a v-bind model arg into a v-model binding with a hoisted ref', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { modelValue: 'Typed text' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton v-bind="args" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { ref } from "vue";
      import MyButton from './MyButton.vue';

      const modelValue = ref('Typed text');
      </script>

      <template>
        <MyButton v-model="modelValue" />
      </template>"
    `);
  });

  it('renders v-bind slot args as slot children on the story tag', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: {
    default: 'Body copy',
    label: 'Hi',
  },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton v-bind="args" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label="Hi">
          Body copy
        </MyButton>
      </template>"
    `);
  });

  it('renders a function slot arg forwarded through v-bind', async () => {
    expect(
      await primarySnippet(
        `
export const Primary = {
  args: {
    default: () => h(OtherButton, { label: 'Nested' }),
    label: 'Hi',
  },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton v-bind="args" />',
  }),
};
`,
        "import { h } from 'vue';\nimport MyButton from './MyButton.vue';\nimport OtherButton from './OtherButton.vue';"
      )
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      import OtherButton from './OtherButton.vue';
      </script>

      <template>
        <MyButton label="Hi">
          <OtherButton label="Nested" />
        </MyButton>
      </template>"
    `);
  });

  it('preserves author markup around the component byte for byte', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<div class="wrap"><!-- keep --><MyButton disabled v-bind="args" data-x="a &amp; b" /></div>',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <div class="wrap"><!-- keep --><MyButton disabled label="Hi" data-x="a &amp; b" /></div>
      </template>"
    `);
  });

  it('accepts a template literal without expressions', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: \`<div>
  <MyButton v-bind="args" />
</div>\`,
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <div>
          <MyButton label="Hi" />
        </div>
      </template>"
    `);
  });

  it('normalizes leading and trailing whitespace from author template literals', () => {
    expect(
      transformTemplate({
        args: [prop('label', `'...'`)],
        componentImports: new Map(),
        componentName: 'C',
        importBindings: new Map(),
        template: '\n  <C :label="args.label" />\n',
        unsetArgs: new Set(),
      })?.snippet
    ).toMatchInlineSnapshot(`
      "<template>
        <C label="..." />
      </template>"
    `);
  });

  it('dedents multi-line author template literals while preserving relative indentation', () => {
    expect(
      transformTemplate({
        args: [prop('label', `'Nested'`)],
        componentImports: new Map(),
        componentName: 'C',
        importBindings: new Map(),
        template: '\n    <div>\n      <C :label="args.label" />\n    </div>\n  ',
        unsetArgs: new Set(),
      })?.snippet
    ).toMatchInlineSnapshot(`
      "<template>
        <div>
          <C label="Nested" />
        </div>
      </template>"
    `);
  });

  it('keeps internal blank lines empty when normalizing author template literals', () => {
    expect(
      transformTemplate({
        args: [prop('label', `'Blank'`)],
        componentImports: new Map(),
        componentName: 'C',
        importBindings: new Map(),
        template: '\n  <C :label="args.label" />\n    \n  <C :label="args.label" />\n',
        unsetArgs: new Set(),
      })?.snippet
    ).toMatchInlineSnapshot(`
      "<template>
        <C label="Blank" />

        <C label="Blank" />
      </template>"
    `);
  });

  it('dedents tab-indented author template literals', () => {
    expect(
      transformTemplate({
        args: [prop('label', `'Tabbed'`)],
        componentImports: new Map(),
        componentName: 'C',
        importBindings: new Map(),
        template: '\n\t<C :label="args.label" />\n',
        unsetArgs: new Set(),
      })?.snippet
    ).toMatchInlineSnapshot(`
      "<template>
        <C label="Tabbed" />
      </template>"
    `);
  });

  it('inlines primitive args in text interpolations', async () => {
    expect(
      await primarySnippet(`
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
`)
    ).toMatchInlineSnapshot(`
      "<template>
        <p>Hi 2 false</p>
      </template>"
    `);
  });

  it('escapes interpolated strings the template parser would read as markup', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: '<b>bold?</b> & 1 < 2' },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<p>{{ args.label }}</p>',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<template>
        <p>&lt;b&gt;bold?&lt;/b&gt; &amp; 1 &lt; 2</p>
      </template>"
    `);
  });

  it('rewrites direct v-bind prop expressions with shared value formatting', async () => {
    expect(
      await primarySnippet(`
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
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const options = { density: 'compact' };
      </script>

      <template>
        <MyButton :count="2" :options="options" />
      </template>"
    `);
  });

  it('drops a binding for an arg explicitly set to undefined', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: {
    label: 'Hi',
    theme: undefined,
  },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton :theme="args.theme" :label="args.label" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label="Hi" />
      </template>"
    `);
  });

  it('takes the whole line when the dropped binding was written on its own', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: {
    label: 'Hi',
    status: undefined,
    theme: undefined,
  },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: \`<MyButton
  :theme="args.theme"
  :status="args.status"
  :label="args.label"
/>\`,
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton
          label="Hi"
        />
      </template>"
    `);
  });

  it('takes the whole CRLF line when the dropped binding was written on its own', async () => {
    expect(
      (
        await primarySnippet(`
export const Primary = {
  args: {
    label: 'Hi',
    status: undefined,
    theme: undefined,
  },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton\\r\\n  :theme="args.theme"\\r\\n  :status="args.status"\\r\\n  :label="args.label"\\r\\n/>',
  }),
};
`)
      )?.replaceAll('\r\n', '\n')
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton
          label="Hi"
        />
      </template>"
    `);
  });

  it('bails when a bound arg is missing from the story args altogether', async () => {
    const payload = await buildPayload(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton :theme="args.theme" :label="args.label" />',
  }),
};
`);

    expect(payload.stories['example-mybutton--primary']?.snippet).toBeUndefined();
    expect(payload.stories['example-mybutton--primary']?.warning).toMatchInlineSnapshot(
      `"No static snippet: the story template could not be resolved statically."`
    );
  });

  it('bails when a static attribute already sets the prop an undefined arg binds', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { theme: undefined },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton theme="dark" :theme="args.theme" />',
  }),
};
`)
    ).toBeUndefined();
  });

  it('drops an event binding whose handler arg is undefined', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: {
    label: 'Hi',
    onClick: undefined,
  },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton @click="args.onClick" :label="args.label" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label="Hi" />
      </template>"
    `);
  });

  it('keeps a v-model bound to an undefined arg, starting its ref empty', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: {
    label: 'Hi',
    modelValue: undefined,
  },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton v-model="args.modelValue" :label="args.label" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { ref } from "vue";
      import MyButton from './MyButton.vue';

      const modelValue = ref();
      </script>

      <template>
        <MyButton v-model="modelValue" label="Hi" />
      </template>"
    `);
  });

  it('renders empty text for an interpolation of an undefined arg', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: {
    label: 'Hi',
    theme: undefined,
  },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton :label="args.label">{{ args.theme }}</MyButton>',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label="Hi"></MyButton>
      </template>"
    `);
  });

  it('substitutes undefined for an unset arg read inside a directive expression', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { count: undefined },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton :style="{ width: args.count }" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton :style="{ width: undefined }" />
      </template>"
    `);
  });

  it('quotes rewritten string values that contain double quotes', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'say "hi"' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton v-bind="args" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label='say "hi"' />
      </template>"
    `);
  });

  it('substitutes args references inside a wrapper style expression and expands v-bind args', async () => {
    expect(
      await primarySnippet(
        `
export const Primary = {
  args: {
    isCollapsed: false,
    release: { version: '1.2.3' },
    status: { label: 'Ready' },
    updateProgressInfo: null,
  },
  render: (args) => ({
    components: { UpdateStatusItem },
    setup: () => ({ args }),
    template: '<div :style="{ \\'--w\\': \\'52px\\', width: args.isCollapsed ? \\'52px\\' : \\'176px\\' }"><UpdateStatusItem v-bind="args" /></div>',
  }),
};
`,
        "import UpdateStatusItem from './UpdateStatusItem.vue';",
        'UpdateStatusItem'
      )
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import UpdateStatusItem from './UpdateStatusItem.vue';

      const release = { version: '1.2.3' };

      const status = { label: 'Ready' };
      </script>

      <template>
        <div :style="{ '--w': '52px', width: false ? '52px' : '176px' }"><UpdateStatusItem :isCollapsed="false" :release="release" :status="status" :updateProgressInfo="null" /></div>
      </template>"
    `);
  });

  it('substitutes inline string args as JavaScript literals inside directive expressions', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'Ready' },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<MyButton :aria-label="\\'Status: \\' + args.label" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton :aria-label="'Status: ' + 'Ready'" />
      </template>"
    `);
  });

  it('bails when a substituted string would terminate a single-quoted attribute', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<MyButton :aria-label=\\'args.label + "!"\\' v-bind="args" />',
  }),
};
`)
    ).toBeUndefined();
  });

  it('substitutes args references inside interpolation expressions', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { count: 2 },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<p>{{ args.count + 1 }}</p>',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<template>
        <p>{{ 2 + 1 }}</p>
      </template>"
    `);
  });

  it('allows double quotes from substituted args inside interpolation expressions', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: "it's" },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<p>{{ args.label + "!" }}</p>',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<template>
        <p>{{ "it's" + "!" }}</p>
      </template>"
    `);
  });

  it('wraps negative inline args before exponentiation', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { count: -2 },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<MyButton :x="args.count ** 2" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton :x="(-2) ** 2" />
      </template>"
    `);
  });

  it('wraps numeric inline args substituted before a member access', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { count: 5 },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<MyButton :label="args.count.toFixed(1)" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton :label="(5).toFixed(1)" />
      </template>"
    `);
  });

  it('substitutes hoisted object args before member access in directive expressions', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { theme: { color: 'red' } },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<MyButton :style="{ color: args.theme.color }" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const theme = { color: 'red' };
      </script>

      <template>
        <MyButton :style="{ color: theme.color }" />
      </template>"
    `);
  });

  it('reuses a hoisted object arg across directive expressions', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: {
    theme: {
      color: 'red',
      mode: 'dark',
    },
  },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<section><MyButton :style="{ color: args.theme.color }" /><div :data-mode="args.theme.mode" /></section>',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const theme = {
        color: 'red',
        mode: 'dark',
      };
      </script>

      <template>
        <section><MyButton :style="{ color: theme.color }" /><div :data-mode="theme.mode" /></section>
      </template>"
    `);
  });

  it('renames hoisted args that collide with slot and v-for template bindings', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: {
    columns: ['a'],
    row: { id: 1 },
  },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton :columns="args.columns"><template #cell="{ row }"><b :title="args.row.id" /></template></MyButton>',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const columns = ['a'];

      const row2 = { id: 1 };
      </script>

      <template>
        <MyButton :columns="columns"><template #cell="{ row }"><b :title="row2.id" /></template></MyButton>
      </template>"
    `);

    expect(
      await primarySnippet(`
export const Primary = {
  args: {
    columns: ['a'],
    row: { cells: ['b'] },
  },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<ul><li v-for="row in args.columns" :key="row"><b v-for="c in args.row.cells" :key="c">{{ c }}</b></li></ul>',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      const columns = ['a'];

      const row2 = { cells: ['b'] };
      </script>

      <template>
        <ul><li v-for="row in columns" :key="row"><b v-for="c in row2.cells" :key="c">{{ c }}</b></li></ul>
      </template>"
    `);
  });

  it('bails when expression substitution would entity-decode an arg value', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'a&amp;b' },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<MyButton :x="args.label + 1" />',
  }),
};
`)
    ).toBeUndefined();
  });

  it('bails on unquoted directive expressions but still substitutes quoted ones', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<MyButton :x=args.label+1 />',
  }),
};
`)
    ).toBeUndefined();

    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<MyButton :x="args.label+1" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton :x="'Hi'+1" />
      </template>"
    `);
  });

  it('bails on delete expressions that mutate args', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { count: 2 },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<MyButton :x="delete args.count" />',
  }),
};
`)
    ).toBeUndefined();
  });

  it('substitutes optional args member references inside expression branches', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { isCollapsed: false },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<MyButton :x="args?.isCollapsed ? \\'closed\\' : \\'open\\'" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton :x="false ? 'closed' : 'open'" />
      </template>"
    `);
  });

  it('bails when Vue entity-decodes the original directive expression', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { count: 2 },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<MyButton :disabled="args.count &gt; 1" />',
  }),
};
`)
    ).toBeUndefined();
  });

  it('keeps author-written slot templates, including the shorthand, untouched', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton :label="args.label"><template #header>Static header</template></MyButton>',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label="Hi"><template #header>Static header</template></MyButton>
      </template>"
    `);
  });

  it('hoists a handler for an event binding that references an args function', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { onClick: () => {} },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton @click="args.onClick" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const onClick = () => {};
      </script>

      <template>
        <MyButton @click="onClick" />
      </template>"
    `);
  });

  it('reuses a hoisted handler across repeated event bindings', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { onSubmit: () => {} },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<section><MyButton @submit="args.onSubmit" /><MyButton @submit="args.onSubmit" /></section>',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const onSubmit = () => {};
      </script>

      <template>
        <section><MyButton @submit="onSubmit" /><MyButton @submit="onSubmit" /></section>
      </template>"
    `);
  });

  it('hoists a ref for an author-written v-model binding', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { modelValue: 'Typed text' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton v-model="args.modelValue" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { ref } from "vue";
      import MyButton from './MyButton.vue';

      const modelValue = ref('Typed text');
      </script>

      <template>
        <MyButton v-model="modelValue" />
      </template>"
    `);
  });

  it('reserves ref before hoisting template args alongside a v-model arg', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: {
    modelValue: 'Typed text',
    ref: { focus: true },
  },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton v-model="args.modelValue" :ref="args.ref" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { ref } from "vue";
      import MyButton from './MyButton.vue';

      const modelValue = ref('Typed text');

      const ref2 = { focus: true };
      </script>

      <template>
        <MyButton v-model="modelValue" :ref="ref2" />
      </template>"
    `);
  });

  it('converts a slot-named binding on the story tag into slot children', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { header: 'Title text' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton :header="args.header" label="static" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label="static">
          <template #header>
            Title text
          </template>
        </MyButton>
      </template>"
    `);
  });

  it('drops an expanded arg when a later attribute overrides it', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'FromArgs' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton v-bind="args" label="static" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label="static" />
      </template>"
    `);
  });

  it('keeps an earlier attribute when the colliding arg is explicitly undefined', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: undefined, count: 2 },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton label="static" v-bind="args" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label="static" :count="2" />
      </template>"
    `);
  });

  it('removes an earlier attribute an expanded arg overrides', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'FromArgs' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton label="static" v-bind="args" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label="FromArgs" />
      </template>"
    `);
  });

  it.each([
    [
      'an expanded event arg collides with a listener',
      `{ onClick: () => {} }`,
      '<MyButton @click="args.onClick" v-bind="args" />',
    ],
    [
      'an expanded model arg collides with a v-model',
      `{ modelValue: 'Typed text' }`,
      '<MyButton v-model="args.modelValue" v-bind="args" />',
    ],
    [
      'an expanded class arg collides with a class attribute',
      `{ class: 'primary' }`,
      '<MyButton class="static" v-bind="args" />',
    ],
  ])('bails when %s already on the element', async (_name, argsSource, template) => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: ${argsSource},
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: ${JSON.stringify(template)},
  }),
};
`)
    ).toBeUndefined();
  });

  it('bails when a rewritten binding collides with a static attribute', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton label="static" :label="args.label" />',
  }),
};
`)
    ).toBeUndefined();
  });

  it('substitutes args references inside v-if expressions', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { isCollapsed: false },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<MyButton v-if="args.isCollapsed" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton v-if="false" />
      </template>"
    `);
  });

  it.each([
    ['spread args', '<MyButton v-bind="{ ...args }" />', { count: 2 }],
    ['computed args member', '<MyButton :x="args[key]" />', { count: 2 }],
    ['update expression in event handler', '<MyButton @click="args.count++" />', { count: 2 }],
    ['assignment in event handler', '<MyButton @click="args.count = 1" />', { count: 2 }],
    ['missing arg name', '<MyButton :x="args.missing + 1" />', { count: 2 }],
    [
      'inline string value containing a double quote',
      `<MyButton :aria-label="'Status: ' + args.label" />`,
      { label: 'say "hi"' },
    ],
    ['v-for args shadowing', '<MyButton v-for="args in items" :key="args.id" />', { count: 2 }],
    [
      'v-slot args shadowing',
      '<MyButton><template v-slot="{ args }">{{ args.label }}</template></MyButton>',
      { label: 'Hi' },
    ],
  ])('bails on %s in directive expressions', async (_name, template, args) => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: ${JSON.stringify(args)},
  render: (args) => ({
    setup: () => ({ args }),
    template: ${JSON.stringify(template)},
  }),
};
`)
    ).toBeUndefined();
  });

  it('bails on templates Vue itself cannot parse', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<div><span :label="args.label"></div>',
  }),
};
`)
    ).toBeUndefined();
  });

  it.each(['component', 'Component'])(
    'bails on dynamic <%s> tags, which a snippet cannot resolve',
    async (tag) => {
      expect(
        await primarySnippet(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<${tag} :is="args.label" />',
  }),
};
`)
      ).toBeUndefined();
    }
  );

  it('renders a component named Component when no is binding makes it dynamic', async () => {
    expect(
      await primarySnippet(
        `
export const Primary = {
  args: { modelValue: 'Typed text' },
};
`,
        "import Component from './Component.vue';",
        'Component'
      )
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { ref } from "vue";
      import Component from './Component.vue';

      const modelValue = ref('Typed text');
      </script>

      <template>
        <Component v-model="modelValue" />
      </template>"
    `);
  });

  it('bails on dynamic directive arguments, which read bindings the snippet never declares', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton :label="args.label" :[args.key]="1" />',
  }),
};
`)
    ).toBeUndefined();
  });

  it('bails on dynamic slot names', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton :label="args.label"><template #[args.slotName]>x</template></MyButton>',
  }),
};
`)
    ).toBeUndefined();
  });

  it('hoists string values containing character references, which attributes would decode', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'Tom &amp; Jerry' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton v-bind="args" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const label = 'Tom &amp; Jerry';
      </script>

      <template>
        <MyButton :label="label" />
      </template>"
    `);
  });

  it('bails when an inlined interpolation would form a new mustache with adjacent text', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'x{' },
  render: (args) => ({
    setup: () => ({ args }),
    template: '<p>{{ args.label }}{ok}</p>',
  }),
};
`)
    ).toBeUndefined();
  });

  it('forwards a setup that returns more than the args', async () => {
    expect(
      await primarySnippet(`
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
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const state = {};
      </script>

      <template>
        <MyButton label="Hi" />
      </template>"
    `);
  });

  it('substitutes undefined in a forwarded setup statement reading an unset arg', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: undefined },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const state = { label: args.label };
      return { args, state };
    },
    template: '<MyButton :label="state.label" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const state = { label: undefined };
      </script>

      <template>
        <MyButton :label="state.label" />
      </template>"
    `);
  });

  it('bails when the returned render object has extra properties', async () => {
    expect(
      await primarySnippet(`
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

  it('resolves the render method shorthand', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { label: 'Hi' },
  render(args) {
    return {
      components: { MyButton },
      setup: () => ({ args }),
      template: '<section><MyButton v-bind="args" /></section>',
    };
  },
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <section><MyButton label="Hi" /></section>
      </template>"
    `);
  });

  it('keeps the render a later spread turns out not to shadow', async () => {
    expect(
      await primarySnippet(`
const base = {};

export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton v-bind="args" />',
  }),
  ...base,
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label="Hi" />
      </template>"
    `);
  });

  it('emits no snippet when a later spread cannot be read at all', async () => {
    const payload = await buildPayload(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton v-bind="args" />',
  }),
  ...buildBase(),
};
`);
    expect(payload.stories['example-mybutton--primary']?.snippet).toBeUndefined();
  });

  it('collects imports for used components, resolving kebab-case tags', async () => {
    const payload = await buildPayload(
      `
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton, OtherButton },
    setup: () => ({ args }),
    template: '<other-button label="Saved" />',
  }),
};
`,
      "import MyButton from './MyButton.vue';\nimport OtherButton from './OtherButton.vue';"
    );

    expect(payload.import).toBeUndefined();
    expect(payload.stories['example-mybutton--primary']?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import OtherButton from './OtherButton.vue';
      </script>

      <template>
        <other-button label="Saved" />
      </template>"
    `);
  });

  it('drops an unset prop through the h-tree path', async () => {
    expect(
      await primarySnippet(
        `
export const Primary = {
  args: {
    label: 'Hi',
    theme: undefined,
  },
  render: (args) => h(MyButton, { theme: args.theme, label: args.label }),
};
`,
        "import { h } from 'vue';\nimport MyButton from './MyButton.vue';"
      )
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label="Hi" />
      </template>"
    `);
  });

  it('renders no child when an h-tree child reads an unset arg', async () => {
    expect(
      await primarySnippet(
        `
export const Primary = {
  args: { label: undefined },
  render: (args) => h(MyButton, null, args.label),
};
`,
        "import { h } from 'vue';\nimport MyButton from './MyButton.vue';"
      )
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton></MyButton>
      </template>"
    `);
  });
});

// The render-less story path synthesizes this template and hands classified args to the engine.
describe('transformTemplate with a synthesized v-bind template', () => {
  it.each<[input: string, output: string]>([
    [`'Hello'`, 'label="Hello"'],
    [`'She said "hi"'`, `label='She said "hi"'`],
    ['3', ':label="3"'],
    ['true', 'label'],
    ['false', ':label="false"'],
    ['null', ':label="null"'],
  ])('%s -> %s', (input, output) => {
    expect(render([prop('label', input)])).toBe(`<script lang="ts" setup>
import C from './C.vue';
</script>

<template>
  <C ${output} />
</template>`);
  });

  it('hoists a value that needs script scope, indented like the snippet around it', () => {
    expect(render([prop('options', `{\n    tone: "neutral"\n}`, 'hoist')]))
      .toBe(`<script lang="ts" setup>
import C from './C.vue';

const options = {
  tone: "neutral"
};
</script>

<template>
  <C :options="options" />
</template>`);
  });

  it('hoists a string that both quote styles cannot delimit', () => {
    expect(render([prop('label', `'She said "hi" and it\\'s fine'`)])).toContain(':label="label"');
  });

  it('declares hoisted bindings in the order their attributes appear', () => {
    const snippet = render(
      [
        prop('aria-label', '{}', 'hoist'),
        prop('ariaLabel', '[]', 'hoist'),
        prop('default', '{}', 'hoist'),
        prop('ref', '{}', 'hoist'),
        model('model-value', `"value"`),
      ],
      'MyComponent'
    );

    expect(snippet).toBe(`<script lang="ts" setup>
import { ref } from "vue";
import MyComponent from './MyComponent.vue';

const ariaLabel = {};

const ariaLabel2 = [];

const _default = {};

const modelValue = ref("value");

const ref2 = {};
</script>

<template>
  <MyComponent :aria-label="ariaLabel" :ariaLabel="ariaLabel2" :default="_default" v-model:model-value="modelValue" :ref="ref2" />
</template>`);
  });

  it('renders slots as children and named slots as templates', () => {
    const snippet = render([slot('header', `'Title'`), slot('default', `'Body'`)]);

    expect(snippet).toBe(`<script lang="ts" setup>
import C from './C.vue';
</script>

<template>
  <C>
    Body
    <template #header>
      Title
    </template>
  </C>
</template>`);
  });

  it('uses the overridden component import inside function slots', () => {
    const result = transformTemplate({
      args: [slot('default', `() => h(C, { label: 'Nested' })`, 'function-slot')],
      componentImports: new Map([['C', "import C from '@example/C.vue';"]]),
      componentName: 'C',
      importBindings: new Map([['C', { importId: './C.vue', importName: 'default' }]]),
      template: '<C v-bind="args" />',
      unsetArgs: new Set(),
    });

    expect(result?.snippet).toBe(`<script lang="ts" setup>
import C from '@example/C.vue';
</script>

<template>
  <C>
    <C label="Nested" />
  </C>
</template>`);
  });

  it('interpolates a hoisted slot value', () => {
    const snippet = render([slot('default', `['a']`, 'hoist')]);

    expect(snippet).toContain('{{ _default }}');
  });

  // Entity-escaping the braces keeps them out of the parser's interpolation scan, so the text
  // decodes back to the exact string the story set instead of evaluating as an expression.
  it('escapes inline slot text the template parser would read as markup', () => {
    const snippet = render([slot('default', `'<script>{{ evil }}</script>'`)]);

    expect(snippet).toContain('<C>\n    &lt;script&gt;&#123;&#123; evil }}&lt;/script&gt;\n  </C>');
    expect(snippet).toContain("import C from './C.vue';");
  });

  it('escapes an inlined slot string so it stays text', () => {
    const snippet = render([slot('default', `'a < b'`)]);

    expect(snippet).toContain('<C>\n    a &lt; b\n  </C>');
  });

  it('hoists inline slot text whose whitespace raw template text would condense', () => {
    const snippet = render([slot('default', `'  padded  '`)]);

    expect(snippet).toContain('const _default = "  padded  ";');
    expect(snippet).toContain('{{ _default }}');
  });

  it('hoists a listener and renders it as a Vue event binding', () => {
    const snippet = render([event('onSubmit', 'submit', '() => null')]);

    expect(snippet).toBe(`<script lang="ts" setup>
import C from './C.vue';

const onSubmit = () => null;
</script>

<template>
  <C @submit="onSubmit" />
</template>`);
  });

  it('sorts event attributes after prop attributes', () => {
    const snippet = render([event('onSubmit', 'submit', '() => null'), prop('label', `'Send'`)]);

    expect(snippet).toContain('<C label="Send" @submit="onSubmit" />');
  });
});

function render(args: ClassifiedArg[], componentName = 'C'): string {
  return transformTemplate({
    args,
    componentImports: new Map([
      [componentName, `import ${componentName} from './${componentName}.vue';`],
    ]),
    componentName,
    importBindings: new Map(),
    template: `<${componentName} v-bind="args" />`,
    unsetArgs: new Set(),
  })!.snippet.replaceAll('\r\n', '\n');
}

function prop(name: string, code: string, kind: 'hoist' | 'inline' = 'inline'): ClassifiedArg {
  return { name, value: expression(code), role: 'prop', plan: { kind } };
}

function slot(
  name: string,
  code: string,
  kind: 'function-slot' | 'hoist' | 'inline' = 'inline'
): ClassifiedArg {
  return { name, value: expression(code), role: 'slot', plan: { kind } };
}

function model(name: string, code: string): ClassifiedArg {
  return { name, value: expression(code), role: 'model', plan: { kind: 'inline' } };
}

function event(name: string, eventName: string, code: string): ClassifiedArg {
  return {
    name,
    eventName,
    value: expression(code),
    role: 'event',
    plan: { kind: 'hoist' },
  };
}

function expression(code: string): t.Node {
  const file = babelParse(`const value = ${code}`);
  const statement = file.program.body[0];
  if (!t.isVariableDeclaration(statement) || !statement.declarations[0]?.init) {
    throw new Error(`Not an expression: ${code}`);
  }
  return t.removePropertiesDeep(t.cloneNode(statement.declarations[0].init, true, true));
}
