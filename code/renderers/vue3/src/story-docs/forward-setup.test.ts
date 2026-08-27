import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import type { IndexEntry } from 'storybook/internal/types';
import type { DocgenPayload } from 'storybook/open-service';

import { buildStoryDocsPayload } from './build-story-docs.ts';

vi.mock('node:fs/promises', { spy: true });

const STORY_PATH = '/stories/MyButton.stories.ts';
const STORY_ID = 'example-mybutton--primary';

const DOCGEN_CATEGORIES: Record<string, string> = {
  count: 'props',
  label: 'props',
  options: 'props',
  'update:modelValue': 'events',
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

async function primaryStory(
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
  return payload.stories[STORY_ID];
}

beforeEach(async () => {
  vol.reset();
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(readFile).mockImplementation(
    memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
  );
});

describe('setup forwarding', () => {
  it('forwards setup statements and their vue imports into script setup', async () => {
    const story = await primaryStory(
      `
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const count = ref(0);
      return { args, count };
    },
    template: '<MyButton :label="args.label" @click="count++" />',
  }),
};
`,
      "import { ref } from 'vue';\nimport MyButton from './MyButton.vue';"
    );

    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { ref } from "vue";
      import MyButton from './MyButton.vue';

      const count = ref(0);
      </script>

      <template>
        <MyButton label="Hi" @click="count++" />
      </template>"
    `);
    expect(story?.warning).toBeUndefined();
  });

  it('forwards setup statements from CRLF story source', async () => {
    const story = await primaryStory(
      [
        '',
        'export const Primary = {',
        "  args: { label: 'Hi' },",
        '  render: (args) => ({',
        '    components: { MyButton },',
        '    setup() {',
        '      const count = ref(0);',
        '      return { args, count };',
        '    },',
        '    template: \'<MyButton :label="args.label" @click="count++" />\',',
        '  }),',
        '};',
        '',
      ].join('\r\n'),
      "import { ref } from 'vue';\nimport MyButton from './MyButton.vue';"
    );

    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { ref } from "vue";
      import MyButton from './MyButton.vue';

      const count = ref(0);
      </script>

      <template>
        <MyButton label="Hi" @click="count++" />
      </template>"
    `);
    expect(story?.warning).toBeUndefined();
  });

  it('substitutes arg reads inside statements, sharing hoisted consts with the template', async () => {
    const story = await primaryStory(
      `
export const Primary = {
  args: { options: { tone: 'brand' } },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const tone = computed(() => args.options.tone);
      return { args, tone };
    },
    template: '<MyButton v-bind="args" :data-tone="tone" />',
  }),
};
`,
      "import { computed } from 'vue';\nimport MyButton from './MyButton.vue';"
    );

    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { computed } from "vue";
      import MyButton from './MyButton.vue';

      const options = { tone: 'brand' };

      const tone = computed(() => options.tone);
      </script>

      <template>
        <MyButton :options="options" :data-tone="tone" />
      </template>"
    `);
  });

  it('inlines primitive arg reads in forwarded statements', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const upper = args.label.toUpperCase();
      return { args, upper };
    },
    template: '<MyButton :label="upper" />',
  }),
};
`);

    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const upper = 'Hi'.toUpperCase();
      </script>

      <template>
        <MyButton :label="upper" />
      </template>"
    `);
  });

  it('parenthesizes a numeric read used as a member-expression object', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { count: 5 },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const digits = args.count.toFixed(1);
      return { args, digits };
    },
    template: '<MyButton :label="digits" />',
  }),
};
`);

    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const digits = (5).toFixed(1);
      </script>

      <template>
        <MyButton :label="digits" />
      </template>"
    `);
  });

  it('synthesizes a const for a renamed return property', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const heading = 'Welcome';
      return { args, title: heading };
    },
    template: '<MyButton :label="title" />',
  }),
};
`);

    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const heading = 'Welcome';
      const title = heading;
      </script>

      <template>
        <MyButton :label="title" />
      </template>"
    `);
  });

  it('drops the args return property under a renamed render parameter', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { label: 'Hi' },
  render: (props) => ({
    components: { MyButton },
    setup: () => ({ args: props }),
    template: '<MyButton :label="args.label" />',
  }),
};
`);

    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label="Hi" />
      </template>"
    `);
  });

  it('names the setup reference the snippet cannot declare', async () => {
    const story = await primaryStory(`
const formatLabel = (value) => value.toUpperCase();

export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const label = formatLabel('Hi');
      return { args, label };
    },
    template: '<MyButton :label="label" />',
  }),
};
`);

    expect(story?.snippet).toBeUndefined();
    expect(story?.warning).toBe(
      'No static snippet: `setup` references `formatLabel`, which the snippet cannot declare.'
    );
  });

  it('bails when setup receives parameters', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup(props) {
      return { args };
    },
    template: '<MyButton :label="args.label" />',
  }),
};
`);

    expect(story?.snippet).toBeUndefined();
    expect(story?.warning).toBe(
      'No static snippet: the `setup` function receives parameters the snippet cannot reproduce.'
    );
  });

  it('bails when the setup return value cannot be read statically', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const extras = { size: 'large' };
      return { args, ...extras };
    },
    template: '<MyButton :label="args.label" />',
  }),
};
`);

    expect(story?.snippet).toBeUndefined();
    expect(story?.warning).toBe(
      'No static snippet: the `setup` return value could not be read statically.'
    );
  });

  it('bails when setup reads the args object whole', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const all = args;
      return { args, all };
    },
    template: '<MyButton :label="args.label" />',
  }),
};
`);

    expect(story?.snippet).toBeUndefined();
    expect(story?.warning).toBe(
      'No static snippet: `setup` references `args`, which the snippet cannot declare.'
    );
  });

  it('bails when a statement reads a model arg, which the snippet turns into a ref', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { modelValue: 'Typed' },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const initial = args.modelValue;
      return { args, initial };
    },
    template: '<MyButton :label="initial" />',
  }),
};
`);

    expect(story?.snippet).toBeUndefined();
    expect(story?.warning).toBe(
      'No static snippet: the story template could not be resolved statically.'
    );
  });
});
