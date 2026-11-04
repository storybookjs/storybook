import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SourceEditor } from 'storybook/internal/csf-tools';
import { UnprintableArgError, fillTemplate, printValue } from 'storybook/internal/docs-tools';
import type { Args, IndexEntry, ProvidedStoryDoc } from 'storybook/internal/types';
import type { DocgenPayload } from 'storybook/open-service';

import { vol } from 'memfs';

import { printHole } from '../../docs/print-hole.ts';
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

describe('template', () => {
  const filled = (story: ProvidedStoryDoc | undefined, initialArgs: Args, changed: Args) =>
    fillTemplate(
      story!.template!,
      { initialArgs, unmappedArgs: { ...initialArgs, ...changed } },
      printHole
    );

  it('wraps each arg the snippet prints in a hole, and adds the args a control adds', async () => {
    const story = await primaryStory(`export const Primary = { args: { label: 'Hi', count: 2 } };`);
    expect(story?.template).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton⟦attr count count ~%20⟫:count="2"⟧⟦attr label label ~%20⟫label="Hi"⟧⟦props * label count ~%20⟫⟧ />
      </template>"
    `);
    const initialArgs = { label: 'Hi', count: 2, theme: 'dark' };
    expect(filled(story, initialArgs, { label: 'Go', active: true })).toContain(
      '<MyButton :count="2" label="Go" active />'
    );
  });

  it('adds the args a control sets after an attribute the render writes before them', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { count: 2 },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton label="Go" v-bind="args" />',
  }),
};
`);
    expect(story?.snippet).toContain('<MyButton label="Go" :count="2" />');
    expect(filled(story, { count: 2 }, { label: 'Stop', size: 'lg' })).toContain(
      '<MyButton label="Stop" :count="2" size="lg" />'
    );
  });

  it('declares an arg the snippet hoists with a hole for its value', async () => {
    const story = await primaryStory(`export const Primary = { args: { size: { width: 2 } } };`);
    expect(story?.template).toContain('const size = ⟦value size script⟫{ width: 2 }⟧;');
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

  it('shows the static snippet for an attribute a changed string cannot be written in', async () => {
    const story = await primaryStory(`export const Primary = { args: { label: 'Hi' } };`);
    expect(() => filled(story, { label: 'Hi' }, { label: `a & "b" 'c'` })).toThrow(
      UnprintableArgError
    );
  });

  it('follows an attribute written before the args binding, which the binding writes over', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { count: 2 },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton label="Go" v-bind="args" />',
  }),
};
`);
    expect(filled(story, { count: 2 }, { label: 'Stop' })).toContain(
      '<MyButton label="Stop" :count="2" />'
    );
  });

  it('cannot follow a binding written before the args binding that reads another arg', async () => {
    const story = await primaryStory(`
export const Primary = {
  args: { label: 'Hi' },
  render: (args) => ({
    components: { MyButton },
    setup: () => ({ args }),
    template: '<MyButton :size="args.label" v-bind="args" />',
  }),
};
`);
    expect(filled(story, { label: 'Hi' }, { label: 'Ho' })).toContain(
      '<MyButton size="Ho" label="Ho" />'
    );
    expect(() => filled(story, { label: 'Hi' }, { label: 'Hi', size: 'lg' })).toThrow(
      'The snippet cannot show the current value of the `size` arg.'
    );
  });

  it('cannot follow a slot a control sets that the story leaves unset', async () => {
    const story = await primaryStory(
      `export const Primary = { args: { label: 'Hi' } };`,
      undefined,
      { ...DOCGEN_CATEGORIES, default: 'slots' }
    );
    expect(() => filled(story, { label: 'Hi' }, { default: 'Slot text' })).toThrow(
      'The snippet cannot show the current value of the `default` arg.'
    );
  });

  it('is none for a story file that already holds a hole bracket', async () => {
    const story = await primaryStory(`export const Primary = { args: { label: '⟦x⟧' } };`);
    expect(story?.snippet).toContain('label="⟦x⟧"');
    expect(story?.template).toBeUndefined();
  });
});

describe('a value a control sets', () => {
  const PLACES: Record<string, (label: string) => string> = {
    'an args binding': (label) => `export const Primary = { args: { label: ${label} } };`,
    'a bound attribute': (label) => rendered(label, '<MyButton :label="args.label" />'),
    'an interpolation': (label) => rendered(label, '<MyButton>{{ args.label }}</MyButton>'),
    'an expression': (label) => rendered(label, `<MyButton :title="args.label + '!'" />`),
    'a slot': (label) => `export const Primary = { args: { default: ${label} } };`,
  };
  const CATEGORIES = { ...DOCGEN_CATEGORIES, default: 'slots' };
  const VALUES: unknown[] = [
    'Go',
    'say "hi"',
    "it's",
    `a "b" 'c'`,
    '{x}',
    '{{ x }}',
    'a}}b',
    '<b>',
    'a & b',
    ' padded ',
    0,
    2.5,
    1000,
    -3,
    true,
    false,
    null,
  ];
  const outcome = (fill: () => string) => {
    try {
      return fill();
    } catch (error) {
      if (error instanceof UnprintableArgError) {
        return UnprintableArgError;
      }
      throw error;
    }
  };

  describe.each(Object.entries(PLACES))('in %s', (_place, story) => {
    const arg = story('x').includes('default:') ? 'default' : 'label';
    const own = (value: unknown) =>
      primaryStory(story(printValue(value, arg, { quote: "'" })), undefined, CATEGORIES);

    it.each(VALUES.map((value) => [value]))(
      'prints %j as the snippet of a story that writes it does, or not at all',
      async (value) => {
        const written = await own(value);
        const go = await own('Go');
        const filled = outcome(() =>
          fillTemplate(
            go!.template!,
            { initialArgs: { [arg]: 'Go' }, unmappedArgs: { [arg]: value } },
            printHole
          )
        );
        expect([written?.snippet ?? UnprintableArgError, UnprintableArgError]).toContain(filled);
        if (['Go', 0, 2.5, 1000, true, false].includes(value as never)) {
          expect(filled).toBe(written?.snippet);
        }
      }
    );
  });
});

function rendered(label: string, template: string) {
  return `
export const Primary = {
  args: { label: ${label} },
  render: (args) => ({ components: { MyButton }, setup: () => ({ args }), template: \`${template}\` }),
};
`;
}
