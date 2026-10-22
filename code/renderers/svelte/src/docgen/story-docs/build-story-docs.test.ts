// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { resolve } from 'pathe';
import { compile } from 'svelte/compiler';
import { fs as memoryFs, vol } from 'memfs';
import type { IndexEntry } from 'storybook/internal/types';

import { buildStoryDocsPayload } from './build-story-docs.ts';
import { printTemplate } from './print-template.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('./print-template.ts', { spy: true });

const entry: IndexEntry = {
  id: 'example--default',
  title: 'Example',
  name: 'Default',
  type: 'story',
  subtype: 'story',
  importPath: resolve('input.stories.ts'),
};

beforeEach(() => {
  vol.reset();
  vi.mocked(fs.readFile).mockImplementation(async (path) => {
    if (typeof path !== 'string') throw new Error('Expected a story file path');
    const value = await memoryFs.promises.readFile(path, 'utf8');
    return typeof value === 'string' ? value : value.toString('utf8');
  });
});

afterEach(() => vi.restoreAllMocks());

describe('story-docs payload', () => {
  it('prints a statically resolved raw snippet inline and imports its nested component', async () => {
    vol.fromJSON({
      [entry.importPath]: `import Panel from './Panel.svelte';
import Icon from 'icons';
import { createRawSnippet as raw } from 'svelte';
const children = raw(() => ({ render: () => '<Icon />' }));
export default { title: 'Example', component: Panel };
export const Default = { args: { children } };`,
    });
    const payload = await buildStoryDocsPayload({ entry });
    expect(payload?.stories['example--default']?.snippet).toContain("import Icon from 'icons';");
    expect(payload?.stories['example--default']?.snippet).toContain(
      '{#snippet children()}<Icon />{/snippet}'
    );
    expect(payload?.stories['example--default']?.warning).toBeUndefined();
  });

  it('leaves the snippet unset for a story without a static component', async () => {
    vol.fromJSON({
      [entry.importPath]:
        'export default { title: "Example" }; export const Default = { render: () => ({ Component: getComponent() }) };',
    });
    const payload = await buildStoryDocsPayload({ entry });
    expect(payload?.stories['example--default']).toEqual({
      id: 'example--default',
      name: 'Default',
      description: undefined,
      summary: undefined,
      warning: 'The render function is not reflected in this snippet.',
    });
    expect(payload?.import).toBeUndefined();
  });

  it('keeps the component import override in the self-contained snippet', async () => {
    vol.fromJSON({
      [entry.importPath]: `import LocalButton from './Button.svelte';
/** @import import { Button } from 'my-ds'; */
const meta = { title: 'Example', component: LocalButton };
export default meta;
export const Default = { args: { label: 'Save' } };`,
    });
    const payload = await buildStoryDocsPayload({ entry });
    expect(payload?.stories['example--default']?.snippet).toBe(
      '<script>\n  import { Button as LocalButton } from \'my-ds\';\n</script>\n\n<LocalButton label="Save" />'
    );
    expect(payload?.import).toBeUndefined();
  });
});

it('warns about an unknown identifier in the final markup', async () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  vol.fromJSON({
    [svelteEntry.importPath]: `<script module>
      import { defineMeta } from '@storybook/svelte';
      import Button from './Button.svelte';
      const { Story } = defineMeta({ title: 'Example', component: Button });
    </script>
    <Story name="Default" asChild><Button value={missing} /></Story>`,
  });
  const payload = await buildStoryDocsPayload({ entry: svelteEntry });
  expect(payload?.stories['example--default']?.warning).toBe('Identifier not resolved: `missing`.');
});

it.each([
  [
    'native',
    '',
    '<button {...args}>Save</button>',
    "<button x={mock().mockName('x')}>Save</button>",
  ],
  [
    'component',
    "import Button from './Button.svelte';",
    '<Button {...args} />',
    "<Button x={mock().mockName('x')} />",
  ],
])(
  'prints a mock in a %s Svelte CSF snippet, like React does',
  async (_, imports, markup, expected) => {
    const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
    vol.fromJSON({
      [svelteEntry.importPath]: `<script module>
      import { defineMeta } from '@storybook/svelte';
      import { fn as mock } from 'storybook/test';
      ${imports}
      const { Story } = defineMeta({ title: 'Example', args: { x: mock().mockName('x') } });
    </script>
    <Story name="Default" asChild>${markup}</Story>`,
    });
    const payload = await buildStoryDocsPayload({ entry: svelteEntry });
    const snippet = payload?.stories['example--default']?.snippet;
    expect(snippet).toContain(expected);
    expect(snippet).toContain("import { fn as mock } from 'storybook/test';");
  }
);

it('preserves a chained factory that is not a storybook mock', async () => {
  vol.fromJSON({
    [entry.importPath]: `import Button from './Button.svelte';
import { fn } from 'custom-factory';
export default { title: 'Example', component: Button };
export const Default = { args: { x: fn().mockName('x') } };`,
  });
  const payload = await buildStoryDocsPayload({ entry });
  expect(payload?.stories['example--default']?.snippet).toContain("x={fn().mockName('x')}");
  expect(payload?.stories['example--default']?.snippet).toContain("from 'custom-factory'");
});

it('preserves distinct module and instance bindings in valid Svelte stories', async () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  const source = `<script module>
    import { defineMeta } from '@storybook/svelte';
    import Button from './Button.svelte';
    const label = 'module';
    const moduleValue = () => label;
    const { Story } = defineMeta({ title: 'Example', component: Button, args: { value: moduleValue() } });
  </script>
  <script>let label = 'instance';</script>
  <Story name="Default" asChild><Button {...args}>{label}</Button></Story>`;
  expect(() => compile(source, { generate: 'server' })).not.toThrow();
  vol.fromJSON({ [svelteEntry.importPath]: source });
  const payload = await buildStoryDocsPayload({ entry: svelteEntry });
  const snippet = payload?.stories['example--default']?.snippet;
  expect(snippet).toContain(
    "<script module>\n  import Button from './Button.svelte';\n\n  const label = 'module';\n  const moduleValue = () => label;\n</script>"
  );
  expect(snippet).toContain("<script>\n  let label = 'instance';\n</script>");
  expect(snippet).toContain('<Button value={moduleValue()}>{label}</Button>');
  expect(payload?.stories['example--default']?.warning).toBeUndefined();
  expect(() => compile(snippet ?? '', { generate: 'server' })).not.toThrow();
});

it.each(['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts'])(
  'uses the source language when copying declarations from plain CSF .%s',
  async (extension) => {
    const storyEntry = { ...entry, importPath: resolve(`input.stories.${extension}`) };
    vol.fromJSON({
      [storyEntry.importPath]: `import Button from './Button.svelte';
        const value = () => 'label';
        export default { title: 'Example', component: Button };
        export const Default = { args: { label: value() } };`,
    });
    const payload = await buildStoryDocsPayload({ entry: storyEntry });
    const snippet = payload?.stories['example--default']?.snippet;
    expect(snippet).toContain("const value = () => 'label';");
    expect(snippet?.split('\n')[0]).toBe(
      ['ts', 'tsx', 'mts', 'cts'].includes(extension) ? '<script lang="ts">' : '<script>'
    );
    expect(() => compile(snippet ?? '', { generate: 'server' })).not.toThrow();
  }
);

it.each([
  ['', '', false],
  [' lang="ts"', '', true],
  ['', ' lang="ts"', true],
])(
  'uses both Svelte script languages for copied declarations: %s / %s',
  async (moduleLang, instanceLang, typescript) => {
    const storyEntry = { ...entry, importPath: resolve('input.stories.svelte') };
    vol.fromJSON({
      [storyEntry.importPath]: `<script module${moduleLang}>
      import { defineMeta } from '@storybook/svelte';
      import Button from './Button.svelte';
      const value${typescript ? ': () => string' : ''} = () => 'label';
      const { Story } = defineMeta({ title: 'Example', component: Button, args: { label: value() } });
    </script>
    <script${instanceLang}>let count${typescript ? ': number' : ''} = 0;</script>
    <Story name="Default" asChild><Button {...args}>{count}</Button></Story>`,
    });
    const payload = await buildStoryDocsPayload({ entry: storyEntry });
    const snippet = payload?.stories['example--default']?.snippet;
    expect(snippet).toContain('const value');
    expect(snippet).toContain('let count');
    expect(snippet).toContain(typescript ? '<script module lang="ts">' : '<script module>');
    expect(snippet).toContain(typescript ? '<script lang="ts">' : '<script>');
    expect(() => compile(snippet ?? '', { generate: 'server' })).not.toThrow();
  }
);

it('builds snippets for a Svelte CSF file that uses preview.meta()', async () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  vol.fromJSON({
    [svelteEntry.importPath]: `<script module>
    import preview from './.storybook/preview';
    import Button from './Button.svelte';
    const meta = preview.meta({ title: 'Example', component: Button, args: { primary: true } });
    const { Story } = meta;
  </script>
  <Story name="Default" args={{ label: 'Save' }} />`,
  });
  const payload = await buildStoryDocsPayload({ entry: svelteEntry });
  expect(payload?.stories['example--default']?.snippet).toBe(
    '<script>\n  import Button from \'./Button.svelte\';\n</script>\n\n<Button primary label="Save" />'
  );
});

it.each([
  [
    'TypeScript in the markup',
    "{ label: 'Save' }",
    '<Button label={args.label as string} />',
    "<Button label={'Save' as string} />",
  ],
  [
    'a negative number',
    '{ count: -5 }',
    '<Button count={-args.count} />',
    '<Button count={-(-5)} />',
  ],
  [
    'TypeScript in an arg value',
    "{ label: 'Save' as string }",
    '<Button {...args} />',
    '<Button label="Save" />',
  ],
  [
    'a generic call in an arg value',
    '{ label: make<string>() }',
    '<Button {...args} />',
    "<script lang=\"ts\">\n  import Button from './Button.svelte';\n  import { make } from './make';\n</script>\n\n<Button label={make<string>()} />",
  ],
])(
  'prints a story with %s and keeps the snippet of its sibling',
  async (_, args, markup, expected) => {
    const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
    vol.fromJSON({
      [svelteEntry.importPath]: `<script module lang="ts">
    import { defineMeta } from '@storybook/svelte';
    import Button from './Button.svelte';
    import { make } from './make';
    const { Story } = defineMeta({ title: 'Example', component: Button });
  </script>
  <Story name="Default" args={${args}} asChild>${markup}</Story>
  <Story name="Plain" args={{ label: 'Plain' }} />`,
    });
    const payload = await buildStoryDocsPayload({ entry: svelteEntry });
    expect(payload?.stories['example--default']?.snippet).toContain(expected);
    expect(payload?.stories['example--default']?.warning).toBeUndefined();
    expect(payload?.stories['example--plain']?.snippet).toContain('<Button label="Plain" />');
  }
);

it('keeps the other stories of a file when the snippet of one story fails', async () => {
  vi.mocked(printTemplate).mockImplementationOnce(() => {
    throw new Error('the markup could not be read');
  });
  vol.fromJSON({
    [entry.importPath]: `import Button from './Button.svelte';
export default { title: 'Example', component: Button };
export const Default = { args: { label: 'Broken' } };
export const Plain = { args: { label: 'Plain' } };`,
  });
  const payload = await buildStoryDocsPayload({ entry });
  expect(payload?.stories['example--default']).toMatchObject({
    name: 'Default',
    warning: 'No static snippet: the markup could not be read',
  });
  expect(payload?.stories['example--default']?.snippet).toBeUndefined();
  expect(payload?.stories['example--plain']?.snippet).toContain('<Button label="Plain" />');
});

it('reads the args of a template snippet that destructures them', async () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  vol.fromJSON({
    [svelteEntry.importPath]: `<script module>
    import { defineMeta } from '@storybook/svelte';
    import Button from './Button.svelte';
    const { Story } = defineMeta({ title: 'Example', component: Button, args: { label: 'Save' } });
  </script>
  <Story name="Default" args={{ icon: '★', primary: true }}>
    {#snippet template({ icon, label, ...args })}
      <Button {...args} label="{icon} {label}" />
    {/snippet}
  </Story>`,
  });
  const payload = await buildStoryDocsPayload({ entry: svelteEntry });
  expect(payload?.stories['example--default']).toMatchObject({
    snippet:
      '<script>\n  import Button from \'./Button.svelte\';\n</script>\n\n<Button primary label="★ Save" />',
  });
  expect(payload?.stories['example--default']?.warning).toBeUndefined();
});

it('builds snippets for a plain CSF file that uses meta.story()', async () => {
  vol.fromJSON({
    [entry.importPath]: `import preview from './.storybook/preview';
import Button from './Button.svelte';
const meta = preview.meta({ title: 'Example', component: Button, args: { primary: true } });
export const Default = meta.story({ args: { label: 'Save' } });`,
  });
  const payload = await buildStoryDocsPayload({ entry });
  expect(payload?.stories['example--default']?.snippet).toBe(
    '<script>\n  import Button from \'./Button.svelte\';\n</script>\n\n<Button primary label="Save" />'
  );
});

describe('snippet args', () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  const storyFile = (markup: string) => `<script module>
    import { defineMeta } from '@storybook/svelte';
    import Button from './Button.svelte';
    import Icon from './Icon.svelte';
    import Wrapper from './Wrapper.svelte';
    const { Story } = defineMeta({ title: 'Example', component: Button });
  </script>
  {#snippet kids()}<b>k</b>{/snippet}
  <Story name="Default" args={{ children: kids }} asChild>${markup}</Story>`;

  it.each([
    [
      'markup after the component',
      '<Button {...args} /><p>after</p>',
      '<Button>\n{#snippet children()}<b>k</b>{/snippet}\n</Button><p>after</p>',
    ],
    [
      'a self-closing sibling',
      '<Button {...args} />\n<Icon />',
      '<Button>\n{#snippet children()}<b>k</b>{/snippet}\n</Button>\n<Icon />',
    ],
    [
      'a wrapper around the component that spreads the args',
      '<Wrapper><Button {...args} /></Wrapper>',
      '<Wrapper><Button>\n{#snippet children()}<b>k</b>{/snippet}\n</Button></Wrapper>',
    ],
    [
      'a read of the snippet',
      '<div>{@render args.children()}</div>',
      '<div>{@render kids()}</div>\n\n{#snippet kids()}<b>k</b>{/snippet}',
    ],
    [
      'content that sets the children itself',
      '<Button {...args}>Text</Button>',
      '<Button>Text</Button>',
    ],
  ])(
    'passes a snippet arg to the component that spreads it, with %s',
    async (_, markup, expected) => {
      const source = storyFile(markup);
      expect(() => compile(source, { generate: 'server' })).not.toThrow();
      vol.fromJSON({ [svelteEntry.importPath]: source });
      const story = (await buildStoryDocsPayload({ entry: svelteEntry }))?.stories[
        'example--default'
      ];
      expect(story?.snippet).toContain(expected);
      expect(story?.warning).toBeUndefined();
      expect(() => compile(story?.snippet ?? '', { generate: 'server' })).not.toThrow();
    }
  );
});

it.each([
  ['a render tag', '<Button>{@render icon()}</Button>', '{#snippet icon()}<b>i</b>{/snippet}'],
  ['another snippet', '<Button {nested} />', '{#snippet icon()}<b>i</b>{/snippet}'],
  ['a name with a dollar sign', '<Button {icon$x} />', '{#snippet icon$x()}<b>x</b>{/snippet}'],
])(
  'declares a story file snippet that the markup reads through %s',
  async (_, markup, expected) => {
    const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
    vol.fromJSON({
      [svelteEntry.importPath]: `<script module>
    import { defineMeta } from '@storybook/svelte';
    import Button from './Button.svelte';
    const { Story } = defineMeta({ title: 'Example', component: Button });
  </script>
  {#snippet icon()}<b>i</b>{/snippet}
  {#snippet nested()}{@render icon()}{/snippet}
  {#snippet icon$x()}<b>x</b>{/snippet}
  <Story name="Default" asChild>${markup}</Story>`,
    });
    const story = (await buildStoryDocsPayload({ entry: svelteEntry }))?.stories[
      'example--default'
    ];
    expect(story?.snippet).toContain(expected);
    expect(story?.warning).toBeUndefined();
  }
);

it('prints the braces of a raw snippet as text', async () => {
  vol.fromJSON({
    [entry.importPath]: `import Button from './Button.svelte';
import { createRawSnippet } from 'svelte';
export default { title: 'Example', component: Button };
export const Default = { args: { children: createRawSnippet(() => ({ render: () => '<b>{name}</b>' })) } };`,
  });
  const story = (await buildStoryDocsPayload({ entry }))?.stories['example--default'];
  expect(story?.snippet).toContain('{#snippet children()}<b>&#123;name&#125;</b>{/snippet}');
  expect(story?.warning).toBeUndefined();
});

it('builds the snippets of a Svelte CSF file whose story shares a name with a module binding', async () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  const source = `<script module>
    import { defineMeta } from '@storybook/svelte';
    import Button from './Button.svelte';
    const { Story } = defineMeta({ title: 'Example', component: Button });
  </script>
  <Story name="Button" args={{ label: 'Save' }} />
  <Story name="Other" args={{ label: 'Other' }} />`;
  vol.fromJSON({ [svelteEntry.importPath]: source });
  const payload = await buildStoryDocsPayload({ entry: svelteEntry });
  expect(payload?.stories['example--button']).toMatchObject({ name: 'Button' });
  expect(payload?.stories['example--button']?.snippet).toContain('<Button label="Save" />');
  expect(payload?.stories['example--other']?.snippet).toContain('<Button label="Other" />');
});

it('documents only the stories of a Svelte CSF file whose module script exports a helper', async () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  vol.fromJSON({
    [svelteEntry.importPath]: `<script module>
    import { defineMeta } from '@storybook/svelte';
    import Button from './Button.svelte';
    export const helper = 'Save';
    const { Story } = defineMeta({ title: 'Example', component: Button });
  </script>
  <Story name="Default" args={{ label: helper }} />`,
  });
  const payload = await buildStoryDocsPayload({ entry: svelteEntry });
  expect(Object.keys(payload?.stories ?? {})).toEqual(['example--default']);
  expect(payload?.stories['example--default']?.snippet).toContain('<Button label="Save" />');
});

it('names a plain CSF story without a name after its export, like the index does', async () => {
  vol.fromJSON({
    [entry.importPath]: `import Button from './Button.svelte';
export default { title: 'Example', component: Button };
export const IconBefore = { args: { label: 'Save' } };`,
  });
  const payload = await buildStoryDocsPayload({ entry });
  expect(payload?.stories['example--icon-before']?.name).toBe('Icon Before');
});
