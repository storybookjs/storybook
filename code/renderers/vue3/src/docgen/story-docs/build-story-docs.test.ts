import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { babelParseFile } from 'storybook/internal/csf-tools';
import type { IndexEntry } from 'storybook/internal/types';
import { type DocgenPayload, selectLiveSnippetForStory } from 'storybook/open-service';

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
  formatter: 'props',
  default: 'slots',
  header: 'slots',
  items: 'props',
  label: 'props',
  size: 'props',
  when: 'props',
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
        <MyButton active size="large" label="Hi" />
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
        <MyButton active size="large" label="Hi" />
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
        <MyButton active size="large" label="Hi" />
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

describe('a meta that spreads the meta of another story file', () => {
  it('documents the component and renders with the render of that meta', async () => {
    vol.fromJSON({
      [STORY_PATH]: `
import meta from './base/Base.stories';
export default { ...meta, title: 'Example/MyButton/Interactions' };
export const Primary = { args: { label: 'Go' } };
`,
    });
    const base = `
import MyButton from '../MyButton.vue';
export default {
  component: MyButton,
  args: { size: 'large' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton :label="args.label" :size="args.size" />',
  }),
};
`;
    const payload = await buildStoryDocsPayload(
      { entry: ENTRY },
      {
        readDocgen: async (id) => docgen(id),
        references: {
          resolveModule: (_fromFile, specifier) =>
            specifier === './base/Base.stories'
              ? {
                  program: babelParseFile({ code: base, filename: '/stories/base/Base.stories.ts' })
                    .path,
                  filePath: '/stories/base/Base.stories.ts',
                }
              : undefined,
        },
      }
    );
    const story = payload?.stories[STORY_ID];
    expect(payload?.name).toBe('MyButton');
    expect(story?.snippet).toBe(
      [
        '<script lang="ts" setup>',
        "import MyButton from './MyButton.vue';",
        '</script>',
        '',
        '<template>',
        '  <MyButton label="Go" size="large" />',
        '</template>',
      ].join('\n')
    );
    expect(fillTemplate(story!.template!, { label: 'Hi', size: 'small' })).toContain(
      '<MyButton label="Hi" size="small" />'
    );
  });
});

describe('a meta that spreads the meta of another story file importing a name differently', () => {
  it('reads the render function with the imports of its own file', async () => {
    vol.fromJSON({
      [STORY_PATH]: `
import MyButton from './MyButton.vue';
import meta from './base/Base.stories';
export default { ...meta, title: 'Example/MyButton' };
export const Primary = { args: { label: 'Go' } };
`,
    });
    const base = `
import { MyButton } from '../index';
export default {
  component: MyButton,
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton :label="args.label" />',
  }),
};
`;
    const payload = await buildStoryDocsPayload(
      { entry: ENTRY },
      {
        readDocgen: async (id) => docgen(id),
        references: {
          resolveModule: (_fromFile, specifier) =>
            specifier === './base/Base.stories'
              ? {
                  program: babelParseFile({ code: base, filename: '/stories/base/Base.stories.ts' })
                    .path,
                  filePath: '/stories/base/Base.stories.ts',
                }
              : undefined,
        },
      }
    );
    const story = payload?.stories[STORY_ID];
    expect(story?.warning).toBeUndefined();
    expect(story?.snippet).toContain("import { MyButton } from './index';");
    expect(fillTemplate(story!.template!, { label: 'Hi' })).toContain('<MyButton label="Hi" />');
  });
});

describe('template', () => {
  it('keeps an arg that still holds the value the story writes as written', async () => {
    const story = await primaryStory(`
const shout = (text: string) => text.toUpperCase();

export const Primary = {
  args: { label: 'Go', formatter: shout, when: new Date('2024-01-01'), items: [{ id: 1 }] },
};
`);
    expect(story?.argCode).toEqual({
      formatter: '((text: string) => text.toUpperCase())',
      when: "new Date('2024-01-01')",
      items: '[{ id: 1 }]',
    });
    const initialArgs = {
      label: 'Go',
      formatter: (text: string) => text.toUpperCase(),
      when: new Date('2024-01-01'),
      items: [{ id: 1 }],
    };
    const args = { ...initialArgs, label: 'Stop' };
    const payload = { id: 'p', name: 'P', path: STORY_PATH, stories: { [STORY_ID]: story! } };
    expect(
      selectLiveSnippetForStory(
        payload,
        STORY_ID,
        { args, unmappedArgs: args, initialArgs },
        fillTemplate
      ).snippet
    ).toContain(
      `<MyButton label="Stop" :formatter="((text: string) => text.toUpperCase())" :when="new Date('2024-01-01')" :items="[{ id: 1 }]" />`
    );
  });

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
      '<MyButton max-count="3" ⟦props ^max-count ^maxCount -is-open -isOpen⟧ ⟦attr is-open open⟧ />'
    );
  });

  it('reads an arg named with a space, as one word', () => {
    const template = `<MyButton :title="args['Button title']">{{ args['Button title'] }}</MyButton>`;
    const code = renderTemplate(template, new Map(), [])!;
    expect(code).toContain(
      '<MyButton ⟦attr title %Button%20title⟧>⟦text %Button%20title⟧</MyButton>'
    );
    expect(fillTemplate(code, { 'Button title': 'Go on' })).toContain(
      '<MyButton title="Go on">Go on</MyButton>'
    );
  });

  it('keeps a binding the element also writes as an attribute, or binds with a modifier', () => {
    const template = '<MyButton class="a" :class="args.c" :label.prop="args.label" />';
    expect(renderTemplate(template, new Map(), [])).toContain(
      '<MyButton class="a" :class="⟦value c⟧" :label.prop="⟦value label⟧" />'
    );
  });
  it('reads an object arg through one const, as the static snippet does', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { items: [{ id: 1 }, { id: 2 }] },
  render: (args) => ({
    components: { MyButton },
    setup() {
      args.items.push({ id: 3 });
      return { args };
    },
    template: '<p v-for="item in args.items">{{ item === args.items[0] }}</p><MyButton :items="args.items" />',
  }),
};
`);
    expect(story?.snippet).toContain(
      'const items = [{ id: 1 }, { id: 2 }];\n\nitems.push({ id: 3 });'
    );
    expect(story?.template).toContain(
      'const items = ⟦value items script⟧;\n\nitems.push({ id: 3 });'
    );
    expect(story?.template).toContain(
      '<p v-for="item in items">{{ item === items[0] }}</p><MyButton :items="items" />'
    );
    expect(fillTemplate(story!.template!, { items: [{ id: 5 }] })).toContain(
      'const items = [{ id: 5 }];'
    );
  });

  it('has a hole at each read of a setup that writes to its args', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { label: 'Go', count: 1 },
  render: (args) => ({
    components: { MyButton },
    setup() {
      args.label = 'Fixed';
      args.count++;
      const text = args.label + args.count;
      return { args, text };
    },
    template: '<MyButton :label="text" :count="args.count" />',
  }),
};
`);
    const written = "args.label = 'Fixed';\nargs.count++;\n";
    expect(story?.template).toContain(
      `${written}const text = ⟦value label script⟧ + ⟦value count script⟧;`
    );
    expect(story?.template).toContain('<MyButton :label="text" ⟦attr count count⟧ />');
    expect(fillTemplate(story!.template!, { label: 'Stop', count: 2 })).toContain(
      `${written}const text = 'Stop' + 2;`
    );
  });

  it('binds an object arg a spread passes to its const', () => {
    const args = [
      {
        name: 'items',
        value: {} as never,
        role: 'prop' as const,
        plan: { kind: 'hoist' as const },
      },
    ];
    const code = renderTemplate(
      '<MyButton v-bind="args" :label="args.items[0]" />',
      new Map(),
      [],
      undefined,
      args
    )!;
    expect(code).toContain('const items = ⟦value items script⟧;');
    expect(code).toContain('<MyButton ⟦props -label -items⟧ :items="items" :label="items[0]" />');
    expect(fillTemplate(code, { items: ['a'], size: 'sm' })).toContain(
      `<MyButton size="sm" :items="items" :label="items[0]" />`
    );
  });

  it('starts a statement reading an arg with a `;` after one without', async () => {
    const story = await primaryStory(`
import { ref } from 'vue'

export const Primary = {
  args: { count: 1 },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const digits = ref([])
      args.count.toString().split('').forEach((digit) => digits.value.push(digit))
      return { digits }
    },
    template: '<MyButton :label="digits.join()" />',
  }),
};
`);
    expect(story?.snippet).toContain('const digits = ref([])\n;(1).toString()');
    expect(story?.template).toContain(
      'const digits = ref([])\n⟦operand count script ;⟧.toString()'
    );
    expect(fillTemplate(story!.template!, { count: -1 })).toContain(
      'const digits = ref([])\n;(-1).toString()'
    );
    expect(fillTemplate(story!.template!, { count: 'x' })).toContain(
      "const digits = ref([])\n'x'.toString()"
    );
  });

  it('reads an arg after a binary minus as an operand', async () => {
    const story = await primaryStory(`
import { computed } from 'vue';

export const Primary = {
  args: { count: 1 },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const left = computed(() => 10 -args.count);
      return { args, left };
    },
    template: '<MyButton :count="left" :label="10 -args.count" />',
  }),
};
`);
    const filled = fillTemplate(story!.template!, { count: -1 });
    expect(filled).toContain('const left = computed(() => 10 -(-1));');
    expect(filled).toContain('<MyButton :count="left" :label="10 -(-1)" />');
  });

  it('marks a hole in an attribute written in single quotes, and none in one without quotes', () => {
    const code = renderTemplate(`<MyButton :label='args.label + "!"' />`, new Map(), [])!;
    expect(code).toContain(`<MyButton :label='⟦value label '⟧ + "!"' />`);
    expect(fillTemplate(code, { label: `it's "x"` })).toContain(
      `<MyButton :label='"it&#39;s \\"x\\"" + "!"' />`
    );
    expect(renderTemplate('<MyButton :label=args.label+1 />', new Map(), [])).toBeUndefined();
  });

  it('leaves out an arg a spread passes under the other spelling of an attribute', () => {
    const code = renderTemplate('<div v-bind="args" :aria-label="args.label" />', new Map(), [])!;
    expect(fillTemplate(code, { 'aria-label': 'x', ariaLabel: 'y', label: 'z' })).toContain(
      '<div label="z" aria-label="z" />'
    );
  });
});
