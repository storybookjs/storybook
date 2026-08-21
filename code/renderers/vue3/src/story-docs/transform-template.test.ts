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
  count: 'props',
  label: 'props',
  options: 'props',
  ref: 'props',
  click: 'events',
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
  importSource = "import MyButton from './MyButton.vue';"
) {
  vol.fromJSON({
    [STORY_PATH]: `
${importSource}

const meta = {
  component: MyButton,
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

async function primarySnippet(storySource: string, importSource?: string) {
  const payload = await buildPayload(storySource, importSource);
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

  it('bails when args are used in unsupported directive expressions', async () => {
    expect(
      await primarySnippet(`
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

  it('bails when setup returns anything except args', async () => {
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
