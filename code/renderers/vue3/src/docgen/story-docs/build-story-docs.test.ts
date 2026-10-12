import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { babelParseFile } from 'storybook/internal/csf-tools';
import type { IndexEntry } from 'storybook/internal/types';
import type { DocgenPayload } from 'storybook/open-service';

import { vol } from 'memfs';

import { fillTemplate } from '../../docs/fill-template.ts';
import { buildStoryDocsPayload } from './build-story-docs.ts';

vi.mock('node:fs/promises', { spy: true });

const STORY_PATH = '/stories/MyButton.stories.ts';
const STORY_ID = 'example-mybutton--primary';

const DOCGEN_CATEGORIES: Record<string, string> = {
  active: 'props',
  click: 'events',
  count: 'props',
  default: 'slots',
  header: 'slots',
  label: 'props',
  modelValue: 'props',
  size: 'props',
  'update:modelValue': 'events',
};

const docgen = (id: string): DocgenPayload => ({
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
});

const ENTRY: IndexEntry = {
  id: 'mybutton--primary',
  name: 'Primary',
  title: 'Example/MyButton',
  type: 'story',
  subtype: 'story',
  importPath: STORY_PATH,
};

/** Resolves imports against the virtual modules a test declares, keyed by specifier. */
const referencesFor = (modules: Record<string, string>) => ({
  resolveModule: (_fromFile: string, specifier: string) => {
    const code = modules[specifier];
    return code === undefined
      ? undefined
      : { program: babelParseFile({ code, filename: specifier }).path, filePath: specifier };
  },
});

async function primaryStory(storySource: string, modules?: Record<string, string>) {
  vol.fromJSON({
    [STORY_PATH]: `
import MyButton from './MyButton.vue';

const meta = { component: MyButton, title: 'Example/MyButton' };

export default meta;

${storySource}
`,
  });

  const payload = await buildStoryDocsPayload(
    { entry: ENTRY },
    {
      readDocgen: async (id) => docgen(id),
      ...(modules ? { references: referencesFor(modules) } : {}),
    }
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

describe('static arg resolution', () => {
  it('renders the args a spread of a local const contributes', async () => {
    const story = await primaryStory(`
const shared = { active: true, size: 'large' };
export const Primary = { args: { ...shared, label: 'Hi' } };
`);
    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton active label="Hi" size="large" />
      </template>"
    `);
    expect(story?.warning).toBeUndefined();
  });

  it("renders the args a spread of a sibling story's args contributes", async () => {
    const story = await primaryStory(`
export const Base = { args: { active: true, size: 'large' } };
export const Primary = { args: { ...Base.args, label: 'Hi' } };
`);
    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton active label="Hi" size="large" />
      </template>"
    `);
  });

  it('inherits the args a config-level spread copies', async () => {
    const story = await primaryStory(`
const base = { args: { active: true, label: 'Hi' } };
export const Primary = { ...base };
`);
    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton active label="Hi" />
      </template>"
    `);
  });

  it('renders the args a spread of an imported object contributes', async () => {
    const story = await primaryStory(
      `
import { shared } from './shared';
export const Primary = { args: { ...shared, label: 'Hi' } };
`,
      { './shared': `export const shared = { active: true, size: 'large' };` }
    );
    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton active label="Hi" size="large" />
      </template>"
    `);
  });

  it('carries the value of an arg that names a local const', async () => {
    const story = await primaryStory(`
const LABEL = 'Hi';
export const Primary = { args: { label: LABEL } };
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

  it('reads an args object the story names instead of writing out', async () => {
    const story = await primaryStory(`
const primaryArgs = { active: true, label: 'Hi' };
export const Primary = { args: primaryArgs };
`);
    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton active label="Hi" />
      </template>"
    `);
  });

  it('names what it could not read rather than dropping it silently', async () => {
    const story = await primaryStory(`
export const Primary = { args: { ...buildArgs(), label: 'Hi' } };
`);
    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label="Hi" />
      </template>"
    `);
    expect(story?.warning).toBe(
      'Incomplete snippet: `...buildArgs()` could not be resolved statically.'
    );
  });

  // The meta spread cannot supply a render here - the story brings its own - but it can still
  // carry args the snippet does not show, so it has to be named.
  it('reports a meta-level spread that may carry args', async () => {
    vol.fromJSON({
      [STORY_PATH]: `
import { h } from 'vue';
import MyButton from './MyButton.vue';

declare function sharedMeta(): object;

export default { component: MyButton, title: 'Example/MyButton', ...sharedMeta() };

export const Primary = {
  args: { label: 'Hi' },
  render: (args) => h(MyButton, { label: args.label }),
};
`,
    });
    const payload = await buildStoryDocsPayload(
      { entry: ENTRY },
      { readDocgen: async (id) => docgen(id) }
    );
    const story = payload?.stories[STORY_ID];
    expect(story?.snippet).toBeDefined();
    expect(story?.warning).toBe(
      'Incomplete snippet: `...sharedMeta()` could not be resolved statically.'
    );
  });
});

describe('live template', () => {
  it('keeps the args spread, naming the slots it shows as content and writing out v-models and function args', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { label: 'Hi', modelValue: 'Draft', default: 'Body', header: 'Title', onClick: () => {} },
};
`);
    expect(story?.template).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { ref } from "vue";
      import MyButton from './MyButton.vue';

      const modelValue = ref(args.modelValue);

      const onClick = () => {};
      </script>

      <template>
        <MyButton v-bind="args /* slots: default, header */" v-model="modelValue" @click="onClick">
          {{ args.default }}
          <template #header>
            {{ args.header }}
          </template>
        </MyButton>
      </template>"
    `);
    expect(
      fillTemplate(story!.template!, {
        label: 'Save',
        size: 'large',
        modelValue: 'Typed',
        header: 'New title',
        onClick: () => {},
      })
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { ref } from "vue";
      import MyButton from './MyButton.vue';

      const modelValue = ref('Typed');

      const onClick = () => {};
      </script>

      <template>
        <MyButton label="Save" size="large" v-model="modelValue" @click="onClick">
          <template #header>
            New title
          </template>
        </MyButton>
      </template>"
    `);
  });

  it('keeps the args references of an authored template and its setup', async () => {
    const story = await primaryStory(`
import { computed } from 'vue';

export const Primary = {
  args: { label: 'Hi', active: true, count: 2, modelValue: 'Draft' },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const upper = computed(() => args.label.toUpperCase());
      return { args, upper };
    },
    template: \`
      <div v-if="args.active">
        <MyButton :label="upper" :count="args.count + 1" v-model="args.modelValue">{{ args.label }}</MyButton>
      </div>
    \`,
  }),
};
`);
    expect(story?.template).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { computed, ref } from "vue";
      import MyButton from './MyButton.vue';

      const modelValue = ref(args.modelValue);

      const upper = computed(() => args.label.toUpperCase());
      </script>

      <template>
        <div v-if="args.active">
          <MyButton :label="upper" :count="args.count + 1" v-model="modelValue">{{ args.label }}</MyButton>
        </div>
      </template>"
    `);
    expect(
      fillTemplate(story!.template!, { label: 'Go', active: false, count: 5, modelValue: 'x' })
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { computed, ref } from "vue";
      import MyButton from './MyButton.vue';

      const modelValue = ref('x');

      const upper = computed(() => 'Go'.toUpperCase());
      </script>

      <template>
        <div v-if="false">
          <MyButton :label="upper" :count="5 + 1" v-model="modelValue">Go</MyButton>
        </div>
      </template>"
    `);
  });

  it('keeps the args references of an h() render', async () => {
    const story = await primaryStory(`
import { h } from 'vue';

export const Primary = {
  args: { label: 'Hi' },
  render: (args) => h('section', { class: 'toolbar' }, [h(MyButton, args), h('p', null, args.label)]),
};
`);
    expect(story?.template).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <section class="toolbar">
          <MyButton v-bind="args /* slots: default, header */">
            {{ args.default }}
            <template #header>
              {{ args.header }}
            </template>
          </MyButton>
          <p>{{ args.label }}</p>
        </section>
      </template>"
    `);
    expect(fillTemplate(story!.template!, { label: 'Go', size: 'large' })).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <section class="toolbar">
          <MyButton label="Go" size="large" />
          <p>Go</p>
        </section>
      </template>"
    `);
  });

  it('keeps a slot function as the snippet prints it, showing the other slots after it', async () => {
    const story = await primaryStory(`
export const Primary = { args: { label: 'Hi', default: () => 'Body' } };
`);
    expect(story?.template).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton v-bind="args /* slots: default, header */">
          Body
          <template #header>
            {{ args.header }}
          </template>
        </MyButton>
      </template>"
    `);
    expect(fillTemplate(story!.template!, { label: 'Hi', default: () => 'Body', header: 'Head' }))
      .toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label="Hi">
          Body
          <template #header>
            Head
          </template>
        </MyButton>
      </template>"
    `);
  });

  it('is left out when a slot arg could not be read', async () => {
    const story = await primaryStory(`
export const Primary = { args: { label: 'Hi', default: BODY } };
`);
    expect(story?.snippet).toBeDefined();
    expect(story?.template).toBeUndefined();
  });

  it('is left out when the snippet already reads like an args reference', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton v-bind="args">Pass args.label</MyButton>',
  }),
};
`);
    expect(story?.snippet).toBeDefined();
    expect(story?.template).toBeUndefined();
  });
});
