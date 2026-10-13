import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { babelParseFile } from 'storybook/internal/csf-tools';
import type { IndexEntry } from 'storybook/internal/types';
import type { DocgenPayload } from 'storybook/open-service';

import { vol } from 'memfs';

import { fillTemplate } from '../../docs/fill-template.ts';
import { buildStoryDocsPayload } from './build-story-docs.ts';
import { renderTemplate } from './story-template.ts';

vi.mock('node:fs/promises', { spy: true });

const STORY_PATH = '/stories/MyButton.stories.ts';
const STORY_ID = 'example-mybutton--primary';

const DOCGEN_CATEGORIES: Record<string, string> = {
  active: 'props',
  count: 'props',
  default: 'slots',
  header: 'slots',
  label: 'props',
  size: 'props',
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

describe('template', () => {
  it('is the component with every arg and its slots for a story without a render function', async () => {
    const story = await primaryStory(`export const Primary = { args: { label: 'Hi' } };`);
    expect(story?.template).toBe(
      [
        '<script lang="ts" setup>',
        "import MyButton from './MyButton.vue';",
        '</script>',
        '',
        '<template>',
        '  ⟦element MyButton default header⟧',
        '</template>',
      ].join('\n')
    );
    expect(fillTemplate(story!.template!, { label: 'Go', header: 'Title' })).toContain(
      '  <MyButton label="Go">\n    <template #header>Title</template>\n  </MyButton>'
    );
  });

  it('is the render template as written, with a hole for each arg it reads', async () => {
    const story = await primaryStory(`
import Icon from './Icon.vue';

export const Primary = {
  args: { label: 'Hi', active: true, size: 'sm' },
  render: (args) => ({
    components: { MyButton, Icon },
    setup: () => ({ args }),
    template: \`
      <div v-if="args.active" :title="args.label + '!'">
        <Icon :name="args.size" />
        <MyButton v-bind="args">{{ args.label }}</MyButton>
      </div>
    \`,
  }),
};
`);
    expect(story?.template).toBe(
      [
        '<script lang="ts" setup>',
        "import Icon from './Icon.vue';",
        "import MyButton from './MyButton.vue';",
        '</script>',
        '',
        '<template>',
        '  <div v-if="⟦value active⟧" :title="⟦value label⟧ + \'!\'">',
        '    <Icon ⟦attr name size⟧ />',
        '    <MyButton ⟦props -default -header⟧>⟦text label⟧</MyButton>',
        '  </div>',
        '</template>',
      ].join('\n')
    );
    expect(fillTemplate(story!.template!, { label: 'Go', active: false, size: 'lg' })).toContain(
      [
        '  <div v-if="false" :title="\'Go\' + \'!\'">',
        '    <Icon name="lg" />',
        '    <MyButton label="Go" :active="false" size="lg">Go</MyButton>',
      ].join('\n')
    );
  });

  it('keeps the statements of a setup as written, with a hole for each arg they read', async () => {
    const story = await primaryStory(`
import { computed, ref } from 'vue';

export const Primary = {
  args: { label: 'Hi', count: 2, size: 'sm' },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const open = ref(false);
      const title = computed(() => \`\${args.label} \${args.count.toFixed(1)}\`);
      return { args, open, title };
    },
    template: '<MyButton :label="title" :size="args.size" @click="open = !open" />',
  }),
};
`);
    expect(story?.template).toBe(
      [
        '<script lang="ts" setup>',
        'import { computed, ref } from "vue";',
        "import MyButton from './MyButton.vue';",
        '',
        'const open = ref(false);',
        'const title = computed(() => `${⟦value label script⟧} ${⟦operand count script⟧.toFixed(1)}`);',
        '</script>',
        '',
        '<template>',
        '  <MyButton :label="title" ⟦attr size size⟧ @click="open = !open" />',
        '</template>',
      ].join('\n')
    );
    const filled = fillTemplate(story!.template!, { label: '</script> & "it\'s"', count: 5 });
    expect(filled).toContain(
      `const title = computed(() => \`\${'<\\/script> & "it\\'s"'} \${(5).toFixed(1)}\`);`
    );
    expect(filled).toContain('<MyButton :label="title" @click="open = !open" />');
  });

  it('binds a v-model on an arg to a ref that starts as the arg', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton v-model:label.trim="args.label" />',
  }),
};
`);
    expect(story?.snippet).toContain("const label = ref('Hi');");
    expect(story?.template).toBe(
      [
        '<script lang="ts" setup>',
        'import { ref } from "vue";',
        "import MyButton from './MyButton.vue';",
        '',
        'const label = ref(⟦value label script⟧);',
        '</script>',
        '',
        '<template>',
        '  <MyButton v-model:label.trim="label" />',
        '</template>',
      ].join('\n')
    );
    expect(fillTemplate(story!.template!, { label: 'a & "b"' })).toContain(
      `const label = ref('a & "b"');`
    );
    expect(fillTemplate(story!.template!, {})).toContain('const label = ref(undefined);');
  });

  it('names the ref of a v-model past a setup binding and a v-for variable', () => {
    const setup = { bindings: ['open'], imports: [], statements: [] };
    const template = '<MyButton v-for="size in 3" v-model:open="args.open" v-model="args.size" />';
    expect(renderTemplate(template, new Map(), [], setup)).toContain(
      '<MyButton v-for="size in 3" v-model:open="open2" v-model="size2" />'
    );
  });

  it('is none for a setup binding or a v-for variable named args', () => {
    const setup = { bindings: ['args'], imports: [], statements: [] };
    expect(renderTemplate('<MyButton :label="args.label" />', new Map(), [], setup)).toBe(
      undefined
    );
    const template = '<MyButton v-for="args in items" :label="args.label" />';
    expect(renderTemplate(template, new Map(), [])).toBeUndefined();
  });

  it.each([
    ['an event handler reading an arg', '<MyButton @click="args.onClick" />'],
    ['a v-model on part of an arg', '<MyButton v-model="args.item.label" />'],
    ['the args passed whole', '<MyButton :item="args" />'],
  ])('is none for %s', (_, template) => {
    expect(renderTemplate(template, new Map(), [])).toBeUndefined();
  });

  it('marks the attributes written before the args spread and leaves out those after it', () => {
    const template = '<MyButton label="x" v-bind="args" :size="args.size" />';
    expect(renderTemplate(template, new Map(), [])).toContain(
      '<MyButton label="x" ⟦props ^label -size⟧ ⟦attr size size⟧ />'
    );
  });

  it('names an attribute around the args spread by the prop it sets', () => {
    const template = '<MyButton max-count="3" v-bind="args" :is-open="args.open" />';
    expect(renderTemplate(template, new Map(), [])).toContain(
      '<MyButton max-count="3" ⟦props ^maxCount -isOpen⟧ ⟦attr is-open open⟧ />'
    );
  });

  it('keeps a binding the element also writes as an attribute, or binds with a modifier', () => {
    const template = '<MyButton class="a" :class="args.c" :label.prop="args.label" />';
    expect(renderTemplate(template, new Map(), [])).toContain(
      '<MyButton class="a" :class="⟦value c⟧" :label.prop="⟦value label⟧" />'
    );
  });
});
