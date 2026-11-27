import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SourceEditor } from 'storybook/internal/csf-tools';
import {
  type SnippetTemplate,
  argChanges,
  fillTemplate,
  formatTemplate,
  printValue,
} from 'storybook/internal/docs-tools';
import type { Args, IndexEntry, StoryDoc } from 'storybook/internal/types';
import type { DocgenPayload } from 'storybook/open-service';

import { vol } from 'memfs';
import * as Vue from 'vue';
import { compileTemplate, parse } from 'vue/compiler-sfc';
import { renderToString } from 'vue/server-renderer';

import { printHole } from '../../docs/print-hole.ts';
import type { VueHolePlace } from '../../snippet-values.ts';
import { buildStoryDocsPayload } from './build-story-docs.ts';
import { expectTemplatesStripToSnippets } from './story-template.test-helpers.ts';

vi.mock('node:fs/promises', { spy: true });

const STORY_PATH = '/stories/MyButton.stories.ts';
const STORY_ID = 'example-mybutton--primary';

const DOCGEN_CATEGORIES: Record<string, string> = {
  active: 'props',
  count: 'props',
  label: 'props',
  size: 'props',
};

const docgen = (id: string, categories = DOCGEN_CATEGORIES): DocgenPayload => ({
  id,
  name: 'MyButton',
  path: STORY_PATH,
  jsDocTags: {},
  argTypes: Object.fromEntries(
    Object.entries(categories).map(([name, category]) => [
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
    if (code === undefined) {
      return undefined;
    }
    const editor = new SourceEditor(code, specifier);
    editor.parentOf(editor.program);
    return { editor, filePath: specifier };
  },
});

async function primaryStory(
  storySource: string,
  modules?: Record<string, string>,
  categories = DOCGEN_CATEGORIES
) {
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
      readDocgen: async (id) => docgen(id, categories),
      ...(modules ? { references: referencesFor(modules) } : {}),
    }
  );
  if (!payload) {
    throw new Error('Expected a story docs payload for the test story file');
  }
  expectTemplatesStripToSnippets(payload);
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

  it('carries the value of an arg that names a destructured local const', async () => {
    const story = await primaryStory(`
const defaults = { label: 'Hi', size: 'large' };
const { label } = defaults;
const { label: _, ...rest } = defaults;
export const Primary = { args: { label, ...rest } };
`);
    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton label="Hi" size="large" />
      </template>"
    `);
    expect(story?.warning).toBeUndefined();
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

describe('args that read story-file constants', () => {
  const VIEWER_CATEGORIES = { html: 'props', lines: 'props', selectedLines: 'props' };
  const viewerStory = (storySource: string) =>
    primaryStory(storySource, undefined, VIEWER_CATEGORIES);

  it('declares the constants the args of a meta and of a story read', async () => {
    vol.fromJSON({
      [STORY_PATH]: `
import preview from '#.storybook/preview';
import MyButton from './MyButton.vue';

const lines = ['a', 'b', 'c'];
const html = \`<pre>\${lines.join('\\n')}</pre>\`;

const meta = preview.meta({
  component: MyButton,
  title: 'Example/MyButton',
  args: { html, lines: lines.length, selectedLines: null },
});

export const Primary = meta.story({ args: { selectedLines: [lines[0]] } });
`,
    });
    const payload = await buildStoryDocsPayload(
      { entry: ENTRY },
      { readDocgen: async (id) => docgen(id, VIEWER_CATEGORIES) }
    );
    expectTemplatesStripToSnippets(payload!);
    const story = payload?.stories[STORY_ID];
    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const lines = ['a', 'b', 'c'];

      const html = \`<pre>\${lines.join('\\n')}</pre>\`;

      const lines2 = lines.length;

      const selectedLines = [lines[0]];
      </script>

      <template>
        <MyButton :html="html" :lines="lines2" :selectedLines="selectedLines" />
      </template>"
    `);
    expect(story?.warning).toBeUndefined();
  });

  it('binds an arg written as the name of a constant to it, until a control sets the arg', async () => {
    const story = await viewerStory(`
const items = ['a', 'b'];
export const Primary = { args: { lines: items, selectedLines: [items[0]] } };
`);
    expect(story?.snippet).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';

      const items = ['a', 'b'];

      const selectedLines = [items[0]];
      </script>

      <template>
        <MyButton :lines="items" :selectedLines="selectedLines" />
      </template>"
    `);
    expect(
      fillTemplate(
        story!.template! as SnippetTemplate<VueHolePlace>,
        {
          initialArgs: { lines: ['a', 'b'], selectedLines: ['a'] },
          unmappedArgs: { lines: ['c'], selectedLines: ['a'] },
        },
        printHole
      )
    ).toContain(`<MyButton :lines="['c']" :selectedLines="selectedLines" />`);
  });

  it.each([
    ['a method changes', `const lines = ['a'];\nlines.push('b');`],
    [
      'an assignment changes',
      `const lines = ['a', 'b'];\n[lines[0], lines[1]] = [lines[1], lines[0]];`,
    ],
    ['another name can change', `const lines = ['a'];\nconst alias = lines;`],
    [
      'a function is handed',
      `const lines = ['a'];\nconst grow = (list) => list.push('b');\ngrow(lines);`,
    ],
    ['holds objects', `const lines = [{ id: 1 }];`],
    ['is declared with var', `var lines = ['a'];`],
  ])('names an arg that reads a constant that %s', async (_how, source) => {
    const story = await viewerStory(`
${source}
export const Primary = { args: { html: 'Hi', lines: lines.length } };
`);
    expect(story?.snippet).not.toContain('lines');
    expect(story?.warning).toBe(
      'Incomplete snippet: `lines: lines.length`, `lines` could not be resolved statically.'
    );
  });

  it('declares a constant the story file reads in a type, a play function and another story', async () => {
    const story = await viewerStory(`
const lines = ['a', 'b'] as const;
type Line = (typeof lines)[number];
export const Other = {
  args: { lines },
  argTypes: { lines: { options: lines } },
  play: async () => {
    await expect(lines.map((line) => line.trim())).toHaveLength(2);
  },
};
export const Primary = { args: { selectedLines: [lines[0]] } };
`);
    expect(story?.snippet).toContain(`const lines = ['a', 'b'] as const;`);
    expect(story?.warning).toBeUndefined();
  });

  it('names an arg another module reads its own constant with', async () => {
    const story = await primaryStory(
      `
import { sharedArgs } from './shared';
const lines = ['story'];
export const Primary = { args: { ...sharedArgs, html: lines.join('') } };
`,
      {
        './shared': `const lines = ['x', 'y'];\nexport const sharedArgs = { lines: lines.length };`,
      },
      VIEWER_CATEGORIES
    );
    expect(story?.snippet).toContain(`<MyButton :html="html" />`);
    expect(story?.warning).toBe(
      'Incomplete snippet: `lines: lines.length` could not be resolved statically.'
    );
  });

  it('names an arg that reads a constant, or is itself, written with a type of the story file', async () => {
    const story = await viewerStory(`
interface Item { name: string }
const format = (item: Item): string => item.name;
const sizes = { large: 'L' } as const;
export const Primary = {
  args: { html: format({ name: 'x' }), lines: sizes.large, selectedLines: [sizes.large as Item] },
};
`);
    expect(story?.snippet).toContain(`const sizes = { large: 'L' } as const;`);
    expect(story?.snippet).toContain(`<MyButton :lines="lines" />`);
    expect(story?.warning).toBe(
      "Incomplete snippet: `html: format({ name: 'x' })`, `selectedLines: [sizes.large as Item]`, `format` could not be resolved statically."
    );
  });

  it.each([
    [
      'its setup',
      `setup() {\n      const lines = ref(0);\n      return { args, lines };\n    }`,
      ':active="lines"',
    ],
    ['a scope of its template', 'setup: () => ({ args })', 'v-for="lines in 2" :key="lines"'],
  ])(
    'names an arg that reads a constant whose name the render declares in %s',
    async (_where, setup, attributes) => {
      const story = await primaryStory(`
import { ref } from 'vue';
const lines = ['a', 'b', 'c'];
export const Primary = {
  args: { count: lines.length, label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    ${setup},
    template: '<MyButton v-bind="args" ${attributes} />',
  }),
};
`);
      expect(story?.snippet).toContain('label="Hi"');
      expect(story?.snippet).not.toContain("['a', 'b', 'c']");
      expect(story?.warning).toBe(
        'Incomplete snippet: `count: lines.length`, `lines` could not be resolved statically.'
      );
    }
  );

  it.each([
    ['a kebab-case tag resolves to', 'myButton', '<my-button v-bind="args" />'],
    [
      'a function in the template takes as a parameter',
      'items',
      '<MyButton :lines="[1].map((items) => args.lines)" :label="args.label" />',
    ],
    [
      'a block in the template declares',
      'items',
      '<MyButton :lines="(() => { const items = [1]; return args.lines })()" :label="args.label" />',
    ],
    [
      'the template reads without the render defining it',
      'title',
      '<MyButton v-bind="args" :title="title" />',
    ],
    ['a custom directive binds', 'vFocus', '<MyButton v-bind="args" v-focus />'],
    ['a same-name shorthand binds', 'title', '<MyButton v-bind="args" :title />'],
    ['a lowercase component tag resolves to', 'panel', '<panel v-bind="args" />'],
  ])('names an arg that reads a constant whose name %s', async (_what, name, template) => {
    const story = await primaryStory(
      `
const ${name} = ['a', 'b'];
export const Primary = {
  args: { lines: ${name}.length, label: 'Hi' },
  render: (args) => ({ components: { MyButton }, setup: () => ({ args }), template: '${template}' }),
};
`,
      undefined,
      { ...VIEWER_CATEGORIES, label: 'props' }
    );
    expect(story?.snippet ?? '').not.toContain(`const ${name} = ['a', 'b'];`);
    expect(story?.warning).toBeDefined();
  });

  it('names an arg that reads a constant a nested scope of forwarded setup declares', async () => {
    const story = await primaryStory(`
import { computed } from 'vue';
const items = ['a', 'b'];
export const Primary = {
  args: { label: items.join(''), count: items.length },
  render: (args) => ({
    components: { MyButton },
    setup() {
      const t = computed(() => [1].map((items) => args.count));
      return { args, t };
    },
    template: '<MyButton v-bind="args" :active="t" />',
  }),
};
`);
    expect(story?.snippet ?? '').not.toContain("const items = ['a', 'b'];");
    expect(story?.warning).toBeDefined();
  });

  it('keeps the template of an h() render with a function constant equal to its snippet', async () => {
    const story = await primaryStory(
      `
import { h } from 'vue';
const fmt = (value) => value.toUpperCase();
export const Primary = {
  args: { formatter: fmt, label: fmt.name },
  render: (args) => ({
    components: { MyButton },
    setup: () => () => h(MyButton, { formatter: (value) => value, ...args }),
  }),
};
`,
      undefined,
      { formatter: 'props', label: 'props' }
    );
    expect(story?.snippet).toContain('const fmt = (value) => value.toUpperCase();');
  });

  it('declares a constant named like a native tag the template writes', async () => {
    const story = await primaryStory(`
const label = 'Hi';
export const Primary = {
  args: { label: label + '!' },
  render: (args) => ({ components: { MyButton }, setup: () => ({ args }), template: '<label><MyButton v-bind="args" /></label>' }),
};
`);
    expect(story?.warning).toBeUndefined();
  });

  it('declares a constant named like a component the snippet writes in PascalCase', async () => {
    const story = await viewerStory(`
const myButton = ['One', 'Two'];
export const Primary = { args: { lines: myButton.length, html: myButton.join(',') } };
`);
    expect(story?.snippet).toContain("const myButton = ['One', 'Two'];");
    expect(story?.warning).toBeUndefined();
  });

  it('keeps the name of a hoisted arg a template function only takes as a parameter', async () => {
    const story = await primaryStory(
      `
export const Primary = {
  args: { lines: [{ id: 1 }], label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton :lines="args.lines" :label="args.label" @pick="(lines) => console.log(lines)" />',
  }),
};
`,
      undefined,
      { lines: 'props', label: 'props', pick: 'events' }
    );
    expect(story?.snippet).toContain('const lines = [{ id: 1 }];');
  });

  it('follows a control that clears a listener another arg reads the constant of', async () => {
    const story = await primaryStory(
      `
const handler = () => console.log('clicked');
export const Primary = {
  args: { onClick: handler, label: handler.name },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton @click="args.onClick" :label="args.label" />',
  }),
};
`,
      undefined,
      { label: 'props', click: 'events' }
    );
    expect(story?.warning).toBeUndefined();
    expect(
      fillTemplate(
        story!.template! as SnippetTemplate<VueHolePlace>,
        {
          initialArgs: { onClick: () => {}, label: 'handler' },
          unmappedArgs: { onClick: undefined, label: 'handler' },
        },
        printHole
      )
    ).toContain('const onClick = undefined;');
  });
});

// This provider writes the payload's templates, so their holes stand in Vue places.
const vueTemplate = (template: SnippetTemplate) => template as SnippetTemplate<VueHolePlace>;

describe('template', () => {
  const filled = (story: StoryDoc | undefined, initialArgs: Args, changed: Args) =>
    fillTemplate(
      vueTemplate(story!.template!),
      argChanges({ initialArgs, unmappedArgs: { ...initialArgs, ...changed } }),
      printHole
    );
  const SLOT_CATEGORIES = { ...DOCGEN_CATEGORIES, default: 'slots', header: 'slots' };

  it('wraps each arg the snippet prints in a hole, and adds the args a control adds', async () => {
    const story = await primaryStory(`export const Primary = { args: { label: 'Hi', count: 2 } };`);
    expect(formatTemplate(story!.template!)).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton⟦attr count ~" "⟫ :count="2"⟧⟦attr label ~" "⟫ label="Hi"⟧⟦props * except=["label","count"] ~" "⟫⟧ />
      </template>"
    `);
    const initialArgs = { label: 'Hi', count: 2, theme: 'dark' };
    expect(filled(story, initialArgs, { label: 'Go', active: true })).toContain(
      '<MyButton :count="2" label="Go" active />'
    );
  });

  it('declares an arg the snippet hoists with a hole for its value', async () => {
    const story = await primaryStory(`export const Primary = { args: { size: { width: 2 } } };`);
    expect(formatTemplate(story!.template!)).toContain(
      'const size = ⟦value size in="script"⟫{ width: 2 }⟧;'
    );
    expect(filled(story, { size: { width: 2 } }, { size: { tag: '</d>' } })).toContain(
      "const size = { tag: '</d>' };"
    );
  });

  it('keeps an arg written as code while it is unchanged', async () => {
    const story = await primaryStory(
      `export const Primary = { args: { count: 1e3, label: 'Hi' } };`
    );
    expect(filled(story, { count: 1000, label: 'Hi' }, { label: 'Go' })).toContain(
      '<MyButton :count="1e3" label="Go" />'
    );
  });

  it('writes a string no attribute quote holds with the entities Vue decodes', async () => {
    const story = await primaryStory(`export const Primary = { args: { label: 'Hi' } };`);
    expect(filled(story, { label: 'Hi' }, { label: `a & "b" 'c'` })).toContain(
      `<MyButton label="a &amp; &quot;b&quot; 'c'" />`
    );
  });

  it('follows the arg a prop written before the args binding names, which the binding writes over it with', async () => {
    const story = await primaryStory(
      rendered("'Hi'", `<MyButton size="sm" :count="args.label" class="big" v-bind="args" />`)
    );
    expect(story?.snippet).toContain('<MyButton size="sm" count="Hi" class="big" label="Hi" />');
    expect(filled(story, { label: 'Hi' }, { count: 3, size: 'lg', active: true })).toContain(
      '<MyButton size="lg" :count="3" class="big" label="Hi" active />'
    );
    expect(filled(story, { label: 'Hi' }, { class: 'wide' })).toContain(
      '<MyButton size="sm" count="Hi" class="wide" label="Hi" />'
    );
    // The value it reads stays as the story wrote it.
    expect(filled(story, { label: 'Hi' }, { label: 'Go' })).toContain(
      '<MyButton size="sm" count="Hi" class="big" label="Go" />'
    );
  });

  it('gives a prop before the args binding that the snippet leaves out the space before it', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { label: 'Hi', title: undefined },
  render: (args) => ({ components: { MyButton }, setup: () => ({ args }), template: \`<MyButton :title="args.title" v-bind="args" />\` }),
};
`);
    expect(filled(story, { label: 'Hi', title: undefined }, { title: 'Top' })).toContain(
      '<MyButton title="Top" label="Hi" />'
    );
  });

  it('follows a class an `h()` spread of the args writes over, as JavaScript does', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => h(MyButton, { class: 'big', ...args }),
};
`);
    expect(story?.snippet).toContain('<MyButton class="big" label="Hi" />');
    expect(filled(story, { label: 'Hi' }, { class: 'wide' })).toContain(
      '<MyButton class="wide" label="Hi" />'
    );
  });

  it('adds the arg next to a `.prop` binding, which sets a key of its own', async () => {
    const story = await primaryStory(
      rendered("'Hi'", '<MyButton :size.prop="args.label" v-bind="args" />')
    );
    expect(filled(story, { label: 'Hi' }, { label: 'Go', size: 'lg' })).toContain(
      `<MyButton :size.prop="'Go'" label="Go" size="lg" />`
    );
  });

  it('prints a slot a control sets that the story leaves unset as a story that sets it', async () => {
    const story = (args: string) =>
      primaryStory(`export const Primary = { args: { ${args} } };`, undefined, SLOT_CATEGORIES);
    const unset = await story(`label: 'Hi'`);
    expect(filled(unset, { label: 'Hi' }, { header: 'Top', default: 'Body' })).toBe(
      (await story(`label: 'Hi', header: 'Top', default: 'Body'`))?.snippet
    );
    expect(filled(unset, { label: 'Hi' }, { label: 'Go' })).toBe(
      (await story(`label: 'Go'`))?.snippet
    );
    const withDefault = await story(`default: 'Body'`);
    expect(filled(withDefault, { default: 'Body' }, { header: 'Top' })).toBe(
      (await story(`header: 'Top', default: 'Body'`))?.snippet
    );
  });

  it('leaves out a slot a control sets where the render passes the args as props', async () => {
    const story = await primaryStory(
      rendered("'Hi'", '<MyButton v-bind="args" />'),
      undefined,
      SLOT_CATEGORIES
    );
    expect(filled(story, { label: 'Hi' }, { header: 'Top' })).toBe(story?.snippet);
  });

  it('follows an arg the template prints nothing for on a line of its own', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { label: undefined },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: \`
      <div>
        <MyButton />
        {{ args.label }}
      </div>\`,
  }),
};
`);
    expect(story?.snippet).toContain('<MyButton />\n\n  </div>');
    expect(filled(story, {}, { label: 'Go' })).toContain('<MyButton />\n    Go\n  </div>');
  });

  it('follows an arg that shares the const of a value its render writes', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { size: { w: 1 } },
  render: (args) => h('div', [h(MyButton, { size: args.size }), h(MyButton, { size: { w: 1 } })]),
};
`);
    expect(story?.snippet).toContain('<MyButton :size="size" />\n    <MyButton :size="size" />');
    expect(filled(story, { size: { w: 1 } }, { size: { w: 2 } })).toContain(
      '<MyButton :size="{ w: 2 }" />\n    <MyButton :size="size" />'
    );
  });

  it('follows an arg whose value holds what a formatted hole is written with', async () => {
    const story = await primaryStory(`export const Primary = { args: { label: '⟦x⟫y⟧' } };`);
    expect(story?.snippet).toContain('label="⟦x⟫y⟧"');
    expect(filled(story, { label: '⟦x⟫y⟧' }, { label: 'Go' })).toContain('<MyButton label="Go" />');
  });
});

describe('a value a control sets', () => {
  // Each place an arg prints, as the template a story renders `args` with.
  const PLACES: Record<string, { arg: string; template: string; render?: true }> = {
    'an args binding': { arg: 'label', template: '<MyButton v-bind="args" />' },
    'a bound attribute': {
      arg: 'label',
      template: '<MyButton :label="args.label" />',
      render: true,
    },
    'an interpolation': {
      arg: 'label',
      template: '<MyButton>{{ args.label }}</MyButton>',
      render: true,
    },
    'an expression': {
      arg: 'label',
      template: `<MyButton :title="args.label + '!'" />`,
      render: true,
    },
    'a v-model': { arg: 'label', template: '<MyButton v-model="args.label" />', render: true },
    'a slot': { arg: 'default', template: '<MyButton>{{ args.default }}</MyButton>' },
  };
  const CATEGORIES = { ...DOCGEN_CATEGORIES, default: 'slots', modelValue: 'props' };
  // The values the snippet of a story that writes them prints as the filled snippet does.
  const PLAIN: unknown[] = ['Go', 0, 2.5, 1000, true, false];
  const VALUES: unknown[] = [
    ...PLAIN,
    'say "hi"',
    "it's",
    `a "b" 'c'`,
    '{x}',
    'a{',
    '{{ x }}',
    'a}}b',
    '<b>',
    'a & b',
    ' padded ',
    -3,
    null,
    ['a}}b', { c: '&amp;' }],
  ];

  describe.each(Object.entries(PLACES))('in %s', (_place, { arg, template, render }) => {
    const story = (value: unknown) => {
      const label = printValue(value, arg, { quote: "'" });
      return primaryStory(
        render
          ? rendered(label, template)
          : `export const Primary = { args: { ${arg}: ${label} } };`,
        undefined,
        CATEGORIES
      );
    };

    it.each(VALUES.map((value) => [value]))(
      'prints %j as code that renders as the story does',
      async (value) => {
        const go = await story('Go');
        const filled = fillTemplate(
          vueTemplate(go!.template!),
          argChanges({ initialArgs: { [arg]: 'Go' }, unmappedArgs: { [arg]: value } }),
          printHole
        );
        expect(await renderSnippet(filled)).toBe(await renderStory(template, { [arg]: value }));
        if (PLAIN.includes(value)) {
          expect(filled).toBe((await story(value))?.snippet);
        }
      }
    );
  });

  it.each<[string, Args]>([
    [`<MyButton :title="[args.label, '!']" v-bind="args" />`, { title: `a "b" & c` }],
    [`<MyButton :title="args.label" v-bind="args" />`, { title: 'Top', label: 'Go' }],
  ])(
    'prints %s as it renders once a control sets the arg the args bind over it',
    async (template, changed) => {
      const story = await primaryStory(rendered("'Hi'", template), undefined, CATEGORIES);
      const args = { label: 'Hi', ...changed };
      const filled = fillTemplate(
        vueTemplate(story!.template!),
        argChanges({ initialArgs: { label: 'Hi' }, unmappedArgs: args }),
        printHole
      );
      expect(await renderSnippet(filled)).toBe(await renderStory(template, args));
    }
  );
});

function rendered(label: string, template: string) {
  return `
export const Primary = {
  args: { label: ${label} },
  render: (args) => ({ components: { MyButton }, setup: () => ({ args }), template: \`${template}\` }),
};
`;
}

// A component that shows the props it gets, and its default slot. A bare `label` is `true`.
const ANY = [Boolean, Number, String, Array, Object, null];
const MyButton = compiled({
  props: { label: ANY, title: ANY, modelValue: ANY },
  template: `<b>{{ JSON.stringify([label, title, modelValue]) }}<slot /></b>`,
});

// The test build of Vue has no template compiler, so a template is compiled here.
function compiled<T extends { template: string }>(component: T) {
  const { code } = compileTemplate({
    source: component.template,
    filename: 'Story.vue',
    id: 'story',
    compilerOptions: { mode: 'function' },
  });
  return { ...component, render: new Function('Vue', code)(Vue) };
}

// The HTML a component renders, but the whitespace at the edges of its text, which the snippet
// writes slot text on lines of its own with.
const renderHtml = async (component: object) =>
  (await renderToString(Vue.createSSRApp(component))).replace(/>\s+|\s+</g, (edge) => edge.trim());

const renderStory = (template: string, args: Args) =>
  renderHtml(compiled({ components: { MyButton }, setup: () => ({ args }), template }));

// A snippet as a component: its script, which imports only `MyButton` and `ref`, runs as the
// `setup` of its template.
function renderSnippet(code: string) {
  const { descriptor } = parse(code);
  const body = (descriptor.scriptSetup?.content ?? '').replace(/^import .*$/gm, '');
  const names = [...body.matchAll(/^const (\w+)/gm)].map(([, name]) => name);
  const setup = new Function(
    'Vue',
    `const { ref } = Vue;\n${body}\nreturn { ${names.join(', ')} };`
  );
  return renderHtml(
    compiled({
      components: { MyButton },
      setup: () => setup(Vue),
      template: descriptor.template!.content,
    })
  );
}
