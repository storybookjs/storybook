import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SourceEditor } from 'storybook/internal/csf-tools';
import type { IndexEntry, StoryDoc } from 'storybook/internal/types';
import type { DocgenPayload } from 'storybook/open-service';

import { vol } from 'memfs';

import { fillTemplate } from '../../docs/fill-template.ts';
import { buildStoryDocsPayload } from './build-story-docs.ts';
import { expectTemplatesFillToSnippets } from './story-template.test-helpers.ts';

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
  const storyFile = `
import MyButton from './MyButton.vue';

const meta = { component: MyButton, title: 'Example/MyButton' };

export default meta;

${storySource}
`;
  vol.fromJSON({ [STORY_PATH]: storyFile });

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
  if (!modules) {
    expectTemplatesFillToSnippets(payload, storyFile);
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
  const filled = (story: StoryDoc | undefined, args: Record<string, unknown>) =>
    fillTemplate(story!.template!, args);

  it('is the snippet with a hole wherever it fills in an arg, and one for the args the story leaves out', async () => {
    const story = await primaryStory(`export const Primary = { args: { label: 'Hi', count: 2 } };`);
    expect(story?.template).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import MyButton from './MyButton.vue';
      </script>

      <template>
        <MyButton ⟦attr count count⟧ ⟦attr label label⟧ ⟦props -count -label⟧ />
      </template>"
    `);
    expect(filled(story, { label: 'Go', count: 3, active: true })).toContain(
      '<MyButton :count="3" label="Go" active />'
    );
  });

  it('keeps an attribute the render writes before the args when the story leaves the arg out', async () => {
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
    expect(story?.template).toContain(
      '<MyButton label="Go" ⟦attr count count⟧ ⟦props -count -label⟧ />'
    );
  });

  it('declares an arg the snippet hoists with a hole for its value', async () => {
    const story = await primaryStory(`export const Primary = { args: { size: { width: 2 } } };`);
    expect(story?.template).toContain('const size = ⟦value size script⟧;');
    expect(filled(story, { size: { width: 3 } })).toContain('const size = { width: 3 };');
  });

  it('leaves out an arg the snippet leaves out, as an undeclared function', async () => {
    const story = await primaryStory(
      `export const Primary = { args: { label: 'Hi', onHover: () => {} } };`
    );
    expect(story?.snippet).not.toContain('onHover');
    expect(story?.template).toContain('⟦props -label -onHover⟧');
  });

  it('fills to the snippet for a number written another way than it prints', async () => {
    const story = await primaryStory(`export const Primary = { args: { count: 1e3 } };`);
    expect(story?.snippet).toContain(':count="1e3"');
    expect(story?.argCode).toEqual({ count: '1e3' });
  });

  it('fills to the snippet for a slot arg set to null', async () => {
    const story = await primaryStory(
      `export const Primary = { args: { default: null } };`,
      undefined,
      { ...DOCGEN_CATEGORIES, default: 'slots' }
    );
    expect(story?.snippet).toContain('{{ null }}');
  });

  it('keeps a hoisted string from ending the script block once a control changes it', async () => {
    const story = await primaryStory(`export const Primary = { args: { size: { tag: 'a' } } };`);
    expect(filled(story, { size: { tag: '</script>' } })).toContain(`'<\\/script>'`);
  });

  it('fills to the snippet for a hoisted value holding a closing tag', async () => {
    const story = await primaryStory(`export const Primary = { args: { size: { tag: '</d>' } } };`);
    expect(story?.snippet).toContain("'</d>'");
  });

  it('is none for a story file that already holds a hole bracket', async () => {
    const story = await primaryStory(`export const Primary = { args: { label: '⟦x⟧' } };`);
    expect(story?.snippet).toContain('label="⟦x⟧"');
    expect(story?.template).toBeUndefined();
  });
});
