import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SourceEditor } from 'storybook/internal/csf-tools';
import {
  type SnippetTemplate,
  fillTemplate,
  formatTemplate,
  printValue,
} from 'storybook/internal/docs-tools';
import type { Args, IndexEntry, ProvidedStoryDoc } from 'storybook/internal/types';
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

// This provider writes the payload's templates, so their holes stand in Vue places.
const vueTemplate = (template: SnippetTemplate) => template as SnippetTemplate<VueHolePlace>;

describe('template', () => {
  const filled = (story: ProvidedStoryDoc | undefined, initialArgs: Args, changed: Args) =>
    fillTemplate(
      vueTemplate(story!.template!),
      { initialArgs, unmappedArgs: { ...initialArgs, ...changed } },
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

  it('follows a prop written before the args binding, which the binding writes over', async () => {
    const story = await primaryStory(
      rendered("'Hi'", `<MyButton size="sm" :count="2" class="big" v-bind="args" />`)
    );
    expect(story?.snippet).toContain('<MyButton size="sm" :count="2" class="big" label="Hi" />');
    expect(filled(story, { label: 'Hi' }, { count: 3, size: 'lg', active: true })).toContain(
      '<MyButton size="lg" :count="3" class="big" label="Hi" active />'
    );
    // Vue merges the class the element writes with the arg's.
    expect(filled(story, { label: 'Hi' }, { class: 'wide' })).toContain(
      `<MyButton size="sm" :count="2" class="big" label="Hi" :class="'wide'" />`
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

  it('follows a prop bound before the args binding to another arg, and the arg over it', async () => {
    const story = await primaryStory(
      rendered("'Hi'", '<MyButton :size="args.label" :count="args.label" v-bind="args" />')
    );
    expect(story?.snippet).toContain('<MyButton size="Hi" count="Hi" label="Hi" />');
    expect(filled(story, { label: 'Hi' }, { label: 'Ho' })).toContain(
      '<MyButton size="Ho" count="Ho" label="Ho" />'
    );
    expect(filled(story, { label: 'Hi' }, { size: 'lg', active: true })).toContain(
      '<MyButton size="lg" count="Hi" label="Hi" active />'
    );
    expect(filled(story, { label: 'Hi' }, { label: 'Ho', count: 3 })).toContain(
      '<MyButton size="Ho" :count="3" label="Ho" />'
    );
  });

  it('follows an arg a declared const holds, which a prop before the args binding reads', async () => {
    const story = await primaryStory(
      rendered('{ w: 1 }', '<MyButton :size="args.label" v-bind="args" />')
    );
    expect(story?.snippet).toContain('<MyButton :size="label" :label="label" />');
    const changed = filled(story, { label: { w: 1 } }, { label: { w: 2 } });
    expect(changed).toContain('const label = { w: 2 };');
    expect(changed).toContain('<MyButton :size="label" :label="label" />');
    expect(filled(story, { label: { w: 1 } }, { size: 'lg' })).toContain(
      '<MyButton size="lg" :label="label" />'
    );
  });

  it('follows a prop bound before the args binding to an expression of args', async () => {
    const story = await primaryStory(
      rendered("'Hi'", `<MyButton :size="args.label + '!'" v-bind="args" />`)
    );
    expect(story?.snippet).toContain(`<MyButton :size="'Hi' + '!'" label="Hi" />`);
    expect(filled(story, { label: 'Hi' }, { label: 'Go' })).toContain(
      `<MyButton :size="'Go' + '!'" label="Go" />`
    );
    expect(filled(story, { label: 'Hi' }, { label: 'Go', size: 'lg' })).toContain(
      '<MyButton size="lg" label="Go" />'
    );
    expect(filled(story, { label: 'Hi' }, { label: undefined })).toContain(
      `<MyButton :size="undefined + '!'" />`
    );
    // An arg declared as a const follows there.
    const declared = await primaryStory(
      rendered('{ w: 1 }', '<MyButton :size="args.label.w + 1" v-bind="args" />')
    );
    expect(declared?.snippet).toContain('<MyButton :size="label.w + 1" :label="label" />');
    expect(filled(declared, { label: { w: 1 } }, { size: 'lg' })).toContain(
      '<MyButton size="lg" :label="label" />'
    );
    expect(filled(declared, { label: { w: 1 } }, { label: { w: 2 } })).toContain(
      'const label = { w: 2 };'
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

  it('leaves an earlier one of two props of a name to the later one', async () => {
    const story = await primaryStory(
      rendered("'Hi'", `<MyButton size="sm" :size="args.label + '!'" v-bind="args" />`)
    );
    expect(filled(story, { label: 'Hi' }, { size: 'lg' })).toContain(
      '<MyButton size="lg" label="Hi" />'
    );
    const own = await primaryStory(
      rendered("'Hi'", '<MyButton size="sm" :size.prop="args.label" v-bind="args" />')
    );
    expect(filled(own, { label: 'Hi' }, { size: 'lg' })).toContain(
      `<MyButton size="lg" :size.prop="'Hi'" label="Hi" />`
    );
  });

  it('moves the lines of a prop written on several lines as the snippet does', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: \`
      <MyButton
        :style="{
          color: args.label,
        }"
        v-bind="args"
      />\`,
  }),
};
`);
    expect(story?.snippet).toContain(`  :style="{\n      color: 'Hi',\n    }"`);
    expect(filled(story, { label: 'Hi' }, { label: 'Go' })).toContain(
      `  :style="{\n      color: 'Go',\n    }"`
    );
  });

  it('binds the class a control sets with the class the template binds, as Vue merges them', async () => {
    const story = await primaryStory(
      rendered("'Hi'", `<MyButton :class="{ on: true }" v-bind="args" />`)
    );
    expect(story?.snippet).toContain('<MyButton :class="{ on: true }" label="Hi" />');
    expect(filled(story, { label: 'Hi' }, { class: 'wide' })).toContain(
      `<MyButton :class="[{ on: true }, 'wide']" label="Hi" />`
    );
    // A style bound after the args binding wins over the arg's.
    const after = await primaryStory(
      rendered("'Hi'", `<MyButton v-bind="args" :style="{ color: 'red' }" />`)
    );
    expect(filled(after, { label: 'Hi' }, { style: 'color: blue' })).toContain(
      `<MyButton label="Hi" :style="['color: blue', { color: 'red' }]" />`
    );
    // A class bound to code that reads args follows them too.
    const reads = await primaryStory(
      rendered("'Hi'", `<MyButton :class="{ [args.label]: true }" v-bind="args" />`)
    );
    expect(reads?.snippet).toContain(`<MyButton :class="{ ['Hi']: true }" label="Hi" />`);
    expect(filled(reads, { label: 'Hi' }, { label: 'Go' })).toContain(
      `<MyButton :class="{ ['Go']: true }" label="Go" />`
    );
    expect(filled(reads, { label: 'Hi' }, { label: 'Go', class: 'wide' })).toContain(
      `<MyButton :class="[{ ['Go']: true }, 'wide']" label="Go" />`
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
    'a prop an args binding writes over': {
      arg: 'label',
      template: '<MyButton :title="args.label" v-bind="args" />',
      render: true,
    },
    'an expression an args binding writes over': {
      arg: 'label',
      template: `<MyButton :title="[args.label, '!']" v-bind="args" />`,
      render: true,
    },
    'a class that merges with the args': {
      arg: 'label',
      template: `<MyButton :class="['own', args.label]" v-bind="args" />`,
      render: true,
    },
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
          { initialArgs: { [arg]: 'Go' }, unmappedArgs: { [arg]: value } },
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
    [`<MyButton :class="['own', args.label]" v-bind="args" />`, { class: 'wide', label: 'Go' }],
    [`<MyButton v-bind="args" :style="{ color: 'red' }" />`, { style: 'color: blue' }],
    [`<MyButton :class="args.label" v-bind="args" />`, { class: 'wide', label: 'Go' }],
    [`<MyButton :class="args.label" v-bind="args" />`, { class: 'wide' }],
    [`<MyButton title="sm" v-bind="args" :title="'xl'" />`, { title: 'lg' }],
  ])(
    'prints %s as it renders once a control sets the arg the args bind over it',
    async (template, changed) => {
      const story = await primaryStory(rendered("'Hi'", template), undefined, CATEGORIES);
      const args = { label: 'Hi', ...changed };
      const filled = fillTemplate(
        vueTemplate(story!.template!),
        { initialArgs: { label: 'Hi' }, unmappedArgs: args },
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
