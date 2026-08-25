import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import type { IndexEntry } from 'storybook/internal/types';
import type { DocgenPayload } from 'storybook/open-service';

import { buildStoryDocsPayload } from './build-story-docs.ts';

vi.mock('node:fs/promises', { spy: true });

const STORY_PATH = '/stories/MyButton.stories.ts';

const DOCGEN_CATEGORIES: Record<string, string> = {
  active: 'props',
  columns: 'props',
  computed: 'props',
  count: 'props',
  formatter: 'props',
  isCollapsed: 'props',
  label: 'props',
  options: 'props',
  release: 'props',
  ref: 'props',
  row: 'props',
  status: 'props',
  theme: 'props',
  title: 'props',
  titleTag: 'props',
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

  it('renders a v-bind model arg as the one-way prop binding the runtime performs', async () => {
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
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton modelValue="Typed text" />
      </template>"
    `);
  });

  it('bails when v-bind args include slot content the runtime would never render', async () => {
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
    ).toBeUndefined();
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

  it('bails on interpolated strings the template parser would read as markup', async () => {
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
    ).toBeUndefined();
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

  it('declares setup locals returned alongside args before rendering the template', async () => {
    expect(
      await primarySnippet(
        `
export const Primary = {
  args: {
    title: 'Un titre',
    titleTag: 'h3',
  },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const selectedAccordion = ref(undefined);
      return { selectedAccordion, args };
    },
    template: '<MyButton v-model="selectedAccordion" :title="args.title + \\' 1\\'" :title-tag="args.titleTag">Contenu</MyButton>',
  }),
};
`,
        `
import { ref } from 'vue';
import MyButton from './MyButton.vue';
`
      )
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { ref } from "vue";
      import MyButton from './MyButton.vue';

      const selectedAccordion = ref(undefined);
      </script>

      <template>
        <MyButton v-model="selectedAccordion" :title="'Un titre' + ' 1'" title-tag="h3">Contenu</MyButton>
      </template>"
    `);
  });

  it('declares setup locals derived from args when args is not returned', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { title: 'Un titre' },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const title1 = \`\${args.title} 1\`;
      const title2 = \`\${title1} 2\`;
      return { title2 };
    },
    template: '<MyButton :title="title2">Contenu</MyButton>',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const title1 = \`\${'Un titre'} 1\`;
      const title2 = \`\${title1} 2\`;
      </script>

      <template>
        <MyButton :title="title2">Contenu</MyButton>
      </template>"
    `);
  });

  it('dedupes ref imports from setup locals and v-model arg hoists', async () => {
    expect(
      await primarySnippet(
        `
export const Primary = {
  args: { modelValue: 'Typed text' },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const selected = ref(undefined);
      return { selected, args };
    },
    template: '<MyButton v-model="args.modelValue"><span>{{ selected }}</span></MyButton>',
  }),
};
`,
        `
import { ref } from 'vue';
import MyButton from './MyButton.vue';
`
      )
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { ref } from "vue";
      import MyButton from './MyButton.vue';

      const selected = ref(undefined);

      const modelValue = ref('Typed text');
      </script>

      <template>
        <MyButton v-model="modelValue"><span>{{ selected }}</span></MyButton>
      </template>"
    `);
  });

  it('bails when a setup local named ref would shadow the v-model import', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { title: 'x', modelValue: 'On' },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const ref = { current: null };
      return { ref };
    },
    template: '<MyButton v-model="args.modelValue" :title="ref" />',
  }),
};
`)
    ).toBeUndefined();
  });

  it('renames a hoisted arg when it collides with a setup local', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { title: { text: 'From args' } },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const title = "Local title";
      return { title, args };
    },
    template: '<MyButton :title="args.title" :aria-label="title" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const title = "Local title";

      const title2 = { text: 'From args' };
      </script>

      <template>
        <MyButton :title="title2" :aria-label="title" />
      </template>"
    `);
  });

  it('hoists a function arg called in setup so the call stays intact', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { formatter: (value) => value + '!' },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const label = args.formatter('x');
      return { label };
    },
    template: '<MyButton :label="label" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const formatter = (value) => value + '!';

      const label = formatter('x');
      </script>

      <template>
        <MyButton :label="label" />
      </template>"
    `);
  });

  it('reuses one hoisted object arg for repeated setup references', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { options: { deep: true } },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const a = args.options;
      const b = args.options;
      return { a, b };
    },
    template: '<MyButton :options="a === b ? a : b" />',
  }),
};
`)
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const options = { deep: true };

      const a = options;
      const b = options;
      </script>

      <template>
        <MyButton :options="a === b ? a : b" />
      </template>"
    `);
  });

  it('bails when setup reads a slot arg', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { default: 'Hello' },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const slotText = args.default();
      return { slotText };
    },
    template: '<MyButton>{{ slotText }}</MyButton>',
  }),
};
`)
    ).toBeUndefined();
  });

  it('renames an arg hoist colliding with a setup import', async () => {
    expect(
      await primarySnippet(
        `
export const Primary = {
  args: { computed: { deep: true } },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const value = computed(() => args.computed);
      return { value };
    },
    template: '<MyButton :options="value" />',
  }),
};
`,
        `
import { computed } from 'vue';
import MyButton from './MyButton.vue';
`
      )
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { computed } from "vue";
      import MyButton from './MyButton.vue';

      const computed2 = { deep: true };

      const value = computed(() => computed2);
      </script>

      <template>
        <MyButton :options="value" />
      </template>"
    `);
  });

  it('bails when setup declares a local args binding', async () => {
    expect(
      await primarySnippet(`
export const Primary = {
  args: { title: 'Story title' },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const args = { title: 'Local title' };
      return { args };
    },
    template: '<MyButton :title="args.title" />',
  }),
};
`)
    ).toBeUndefined();
  });

  it('bails when an expanded arg collides with an attribute already on the element', async () => {
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
});
