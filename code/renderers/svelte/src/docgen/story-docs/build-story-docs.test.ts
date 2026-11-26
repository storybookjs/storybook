// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { resolve } from 'pathe';
import { compile } from 'svelte/compiler';
import { fs as memoryFs, vol } from 'memfs';
import type { IndexEntry } from 'storybook/internal/types';

import { resolveCsfComponent } from '../component-docgen/resolve-component/resolve-component.ts';
import { buildStoryDocsPayload } from './build-story-docs.ts';
import { printTemplate } from './print-template.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('./print-template.ts', { spy: true });
vi.mock('../component-docgen/resolve-component/resolve-component.ts', { spy: true });

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
  vi.mocked(resolveCsfComponent).mockReturnValue(undefined);
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

describe('the @import tag of the @component comment', () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  const componentPath = resolve('Tag.svelte');
  const storyFile = (metaJsDoc = '') => `<script module>
    import { defineMeta } from '@storybook/svelte';
    import Tag from './Tag.svelte';
    ${metaJsDoc}
    const { Story } = defineMeta({ title: 'Example', component: Tag });
  </script>
  <Story name="Default" args={{ label: 'Design' }} />`;
  const namespaceStoryFile = (
    story = `<Story name="Default" args={{ label: 'Design' }} />`,
    declarations = ''
  ) => `<script module>
    import { defineMeta } from '@storybook/svelte';
    import * as UI from './components';
    ${declarations}
    const { Story } = defineMeta({ title: 'Example', component: UI.Tag });
  </script>
  ${story}`;
  const tagged = (statement: string) => `<!--
@component
A small label for a category.
@import ${statement}
-->
<script lang="ts">
  let { label }: { label: string } = $props();
</script>

<span>{label}</span>`;
  const component = tagged("import Tag from '#lib/Tag.svelte';");
  const story = async () =>
    (await buildStoryDocsPayload({ entry: svelteEntry }))?.stories['example--default'];

  beforeEach(() => {
    vi.mocked(resolveCsfComponent).mockReturnValue({
      componentPath,
      exportName: 'default',
      name: 'Tag',
    });
  });

  it('replaces the import of the meta component', async () => {
    vol.fromJSON({ [svelteEntry.importPath]: storyFile(), [componentPath]: component });
    expect((await story())?.snippet).toBe(
      '<script>\n  import Tag from \'#lib/Tag.svelte\';\n</script>\n\n<Tag label="Design" />'
    );
  });

  it('reads the comment that starts with @component, not an earlier one that mentions it', async () => {
    vol.fromJSON({
      [svelteEntry.importPath]: storyFile(),
      [componentPath]: `<!-- TODO: move the @component docs here -->\n${component}`,
    });
    expect((await story())?.snippet).toBe(
      '<script>\n  import Tag from \'#lib/Tag.svelte\';\n</script>\n\n<Tag label="Design" />'
    );
  });

  it.each(["import { Tag } from '@acme/ui';", "import * as Acme from '@acme/ui';"])(
    'imports the namespace of a member component from the source of `%s`',
    async (statement) => {
      vol.fromJSON({
        [svelteEntry.importPath]: namespaceStoryFile(),
        [componentPath]: tagged(statement),
      });
      expect((await story())?.snippet).toBe(
        '<script>\n  import * as UI from \'@acme/ui\';\n</script>\n\n<UI.Tag label="Design" />'
      );
    }
  );

  it('keeps the namespace import of the story file when the tag imports the member another way', async () => {
    vol.fromJSON({ [svelteEntry.importPath]: namespaceStoryFile(), [componentPath]: component });
    expect((await story())?.snippet).toBe(
      '<script>\n  import * as UI from \'./components\';\n</script>\n\n<UI.Tag label="Design" />'
    );
  });

  it.each([
    ['another member of the namespace', '<UI.Wrapper><UI.Tag {...args} /></UI.Wrapper>', ''],
    ['the namespace in an expression', '<UI.Tag {...args} size={UI.sizes.small} />', ''],
    [
      'a declaration it copies',
      '<UI.Tag {...args} size={sizes.small} />',
      'const sizes = UI.sizes;',
    ],
  ])(
    'keeps the namespace import of the story file when the snippet also reads %s',
    async (_, markup, declarations) => {
      vol.fromJSON({
        [svelteEntry.importPath]: namespaceStoryFile(
          `<Story name="Default" args={{ label: 'Design' }} asChild>${markup}</Story>`,
          declarations
        ),
        [componentPath]: tagged("import { Tag } from '@acme/ui';"),
      });
      const snippet = (await story())?.snippet;
      expect(snippet).toContain("import * as UI from './components';");
      expect(snippet).not.toContain('@acme/ui');
    }
  );

  it('gives way to the @import tag of the meta', async () => {
    vol.fromJSON({
      [svelteEntry.importPath]: storyFile("/** @import import { Tag } from 'my-ds'; */"),
      [componentPath]: component,
    });
    expect((await story())?.snippet).toBe(
      '<script>\n  import { Tag } from \'my-ds\';\n</script>\n\n<Tag label="Design" />'
    );
  });

  it.each([
    [
      'the component does not resolve',
      () =>
        vi.mocked(resolveCsfComponent).mockImplementation(() => {
          throw new Error('Could not resolve');
        }),
    ],
    ['the component file is missing', () => vol.unlinkSync(componentPath)],
    ['the component does not parse', () => vol.writeFileSync(componentPath, `${component}\n<div`)],
  ])('keeps the import of the story file when %s', async (_, arrange) => {
    vol.fromJSON({ [svelteEntry.importPath]: storyFile(), [componentPath]: component });
    arrange();
    const doc = await story();
    expect(doc?.snippet).toBe(
      '<script>\n  import Tag from \'./Tag.svelte\';\n</script>\n\n<Tag label="Design" />'
    );
    expect(doc?.warning).toBeUndefined();
  });
});

it('writes a template for a story whose snippet has a warning', async () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  vol.fromJSON({
    [svelteEntry.importPath]: `<script module>
      import { defineMeta } from '@storybook/svelte';
      import Button from './Button.svelte';
      const { Story } = defineMeta({ title: 'Example', component: Button });
    </script>
    <Story name="Default" args={{ label: 'Go' }}>
      {#snippet template(args)}<Button {...args} value={missing} />{/snippet}
    </Story>`,
  });
  const story = (await buildStoryDocsPayload({ entry: svelteEntry }))?.stories['example--default'];
  expect(story?.template).toBeDefined();
  expect(story?.warning).toBe('Identifier not resolved: `missing`.');
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

it('builds the snippets of Svelte CSF stories that extend a story, with its content and args', async () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  vol.fromJSON({
    [svelteEntry.importPath]: `<script module>
    import preview from './.storybook/preview';
    import Button from './Button.svelte';
    const { Story } = preview.meta({ title: 'Example', component: Button });
  </script>
  <Story extend="Button" name="Small" args={{ size: 'small' }} />
  <Story name="Button" args={{ primary: true, size: 'medium' }}>Click me</Story>
  <Story extend="Small" name="Starred" args={{ disabled: true }}>
    {#snippet template(args)}<Button {...args}>★</Button>{/snippet}
  </Story>
  <Story extend="Starred" name="Starred Enabled" args={{ disabled: false }} />
  <Story extend="Button" name="Static" asChild />`,
  });
  const payload = await buildStoryDocsPayload({ entry: svelteEntry });
  const snippets = Object.fromEntries(
    Object.values(payload?.stories ?? {}).map(({ name, snippet }) => [
      name,
      snippet?.split('\n\n').at(-1),
    ])
  );
  expect(snippets).toEqual({
    Button: '<Button primary size="medium">\n  Click me\n</Button>',
    Small: '<Button primary size="small">\n  Click me\n</Button>',
    Starred: '<Button primary size="small" disabled>★</Button>',
    'Starred Enabled': '<Button primary size="small" disabled={false}>★</Button>',
    Static: 'Click me',
  });
});

it('builds the snippet of a Svelte CSF story that extends a story with named args', async () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  vol.fromJSON({
    [svelteEntry.importPath]: `<script module>
    import preview from './.storybook/preview';
    import Button from './Button.svelte';
    const { Story } = preview.meta({ title: 'Example', component: Button });
    const sharedArgs = { primary: true };
  </script>
  <Story name="Primary" args={sharedArgs}>Click me</Story>
  <Story extend="Primary" name="Small" args={{ size: 'small' }} />`,
  });
  const payload = await buildStoryDocsPayload({ entry: svelteEntry });
  expect(payload?.stories['example--small']).toMatchObject({
    snippet: expect.stringContaining('<Button primary size="small">'),
  });
  expect(payload?.stories['example--small']?.warning).toBeUndefined();
});

it('builds the snippet of a Svelte CSF story that extends a story and has only whitespace or a comment as children', async () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  vol.fromJSON({
    [svelteEntry.importPath]: `<script module>
    import preview from './.storybook/preview';
    import Button from './Button.svelte';
    const { Story } = preview.meta({ title: 'Example', component: Button });
  </script>
  <Story name="Primary" args={{ primary: true }}>Click me</Story>
  <Story extend="Primary" name="Spaces">
  </Story>
  <Story extend="Primary" name="Comment"><!-- A note --></Story>`,
  });
  const payload = await buildStoryDocsPayload({ entry: svelteEntry });
  const snippets = Object.fromEntries(
    Object.values(payload?.stories ?? {}).map(({ name, snippet }) => [
      name,
      snippet?.split('\n\n').at(-1),
    ])
  );
  expect(snippets).toEqual({
    Primary: '<Button primary>\n  Click me\n</Button>',
    Spaces: '<Button primary>\n  Click me\n</Button>',
    Comment: '<Button primary>\n  Click me\n</Button>',
  });
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

describe('the HTML comment above a Svelte CSF story', () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  const storyFile = (comment: string) => `<script module>
    import { defineMeta } from '@storybook/svelte';
    import Tag from './Tag.svelte';
    const { Story } = defineMeta({ title: 'Example', component: Tag });
  </script>
  ${comment}
  <Story name="Default" args={{ label: 'Design' }} />`;

  it('gives the story the summary of its @summary tag, like the JSDoc of a CSF story', async () => {
    vol.fromJSON({
      [svelteEntry.importPath]: storyFile(`<!--
    The default tag, in a list of posts.
    @summary the default tag
  -->`),
    });
    const story = (await buildStoryDocsPayload({ entry: svelteEntry }))?.stories[
      'example--default'
    ];
    expect(story).toMatchObject({
      description: 'The default tag, in a list of posts.',
      summary: 'the default tag',
    });
  });

  it('takes the description of a @describe tag over the text of the comment', async () => {
    vol.fromJSON({
      [svelteEntry.importPath]: storyFile(`<!--
    The default tag, in a list of posts.
    @describe A tag that names a topic.
  -->`),
    });
    const story = (await buildStoryDocsPayload({ entry: svelteEntry }))?.stories[
      'example--default'
    ];
    expect(story?.description).toBe('A tag that names a topic.');
    expect(story?.summary).toBeUndefined();
  });

  it('keeps an @ inside a line as text, like the JSDoc of a CSF story', async () => {
    vol.fromJSON({
      [svelteEntry.importPath]: storyFile('<!-- Ask @design before you add a tag. -->'),
    });
    const story = (await buildStoryDocsPayload({ entry: svelteEntry }))?.stories[
      'example--default'
    ];
    expect(story?.description).toBe('Ask @design before you add a tag.');
    expect(story?.summary).toBeUndefined();
  });

  it.each([
    [
      'above a snippet block',
      '<!--\n  The template of every story.\n  @summary template\n-->\n  {#snippet template(args)}<Tag {...args} />{/snippet}',
    ],
    ['above an element', '<!-- svelte-ignore a11y_missing_attribute -->\n  <h1>Tags</h1>'],
    [
      'inside an element',
      '<div>\n    <!-- svelte-ignore a11y_no_static_element_interactions -->\n    <span>Tags</span>\n  </div>',
    ],
  ])('leaves the description and summary unset when the comment is %s', async (_, markup) => {
    vol.fromJSON({ [svelteEntry.importPath]: storyFile(markup) });
    const story = (await buildStoryDocsPayload({ entry: svelteEntry }))?.stories[
      'example--default'
    ];
    expect(story?.description).toBeUndefined();
    expect(story?.summary).toBeUndefined();
  });

  it('keeps the lines after a line that ends in */', async () => {
    vol.fromJSON({
      [svelteEntry.importPath]: storyFile(`<!--
    Reset the styles with /* reset */
    before you add a tag.
    @summary reset first
  -->`),
    });
    const story = (await buildStoryDocsPayload({ entry: svelteEntry }))?.stories[
      'example--default'
    ];
    // The indentation of the second line is #37476.
    expect(story?.description).toMatch(
      /^Reset the styles with \/\* reset \*\/\n\s*before you add a tag\.$/
    );
    expect(story?.summary).toBe('reset first');
  });

  it('leaves the description and summary unset for a story without a comment', async () => {
    vol.fromJSON({ [svelteEntry.importPath]: storyFile('') });
    const story = (await buildStoryDocsPayload({ entry: svelteEntry }))?.stories[
      'example--default'
    ];
    expect(story?.description).toBeUndefined();
    expect(story?.summary).toBeUndefined();
  });
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

describe('Svelte CSF files that Svelte compiles only after preprocessing', () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  const storyDocs = async (file: string) => {
    vol.fromJSON({ [svelteEntry.importPath]: file });
    return buildStoryDocsPayload({ entry: svelteEntry });
  };
  const storiesFile = ({ lang = '', instanceScript = '', style = '' }) => `<script module${lang}>
  import { defineMeta } from '@storybook/svelte';
  import Button from './Button.svelte';
  const { Story } = defineMeta({ title: 'Example', component: Button });
</script>
${instanceScript}
<Story name="Default" args={{ label: 'Save' }} />
${style}`;

  it('reads a file with a style block in a preprocessor language', async () => {
    const style = `<style lang="scss">
  $gap: 1rem;
  .story {
    padding: $gap;
  }
</style>`;

    expect(await storyDocs(storiesFile({ style }))).toEqual(await storyDocs(storiesFile({})));
  });

  it('reads a file with TypeScript that only a preprocessor removes', async () => {
    const instanceScript = `<script lang="ts">
  enum Size {
    Small = 'small',
  }
</script>`;

    expect(
      (await storyDocs(storiesFile({ lang: ' lang="ts"', instanceScript })))?.stories[
        'example--default'
      ]?.snippet
    ).toBe(
      '<script>\n  import Button from \'./Button.svelte\';\n</script>\n\n<Button label="Save" />'
    );
  });
});

it('reads a Svelte CSF file that starts with a byte order mark', async () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  const storyDocs = async (source: string) => {
    vol.fromJSON({ [svelteEntry.importPath]: source });
    return buildStoryDocsPayload({ entry: svelteEntry });
  };
  const source = `<script module>
  import { defineMeta } from '@storybook/svelte';
  import Button from './Button.svelte';
  const { Story } = defineMeta({ title: 'Example', component: Button });
</script>

<Story name="Default" args={{ label: 'Save' }} />
`;

  expect(await storyDocs(`\uFEFF${source}`)).toEqual(await storyDocs(source));
});

describe('Svelte CSF files with TypeScript expressions', () => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  const storySnippets = async (wrap: (value: string) => string) => {
    vol.fromJSON({
      [svelteEntry.importPath]: `<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';
  import Button from './Button.svelte';
  const { Story } = defineMeta(${wrap(`{ title: 'Example', component: ${wrap('Button')}, render: ${wrap('meta')}, args: ${wrap("{ variant: 'primary' }")} }`)});
</script>

{#snippet meta(args)}
  <Button {...args} />
{/snippet}

{#snippet template(args)}
  <Button {...args} size="small" />
{/snippet}

<Story name="Default" args={${wrap("{ label: 'Save' }")}} />

<Story name="Small" template={${wrap('template')}} args={${wrap("{ label: 'Discard' }")}} />
`,
    });
    return (await buildStoryDocsPayload({ entry: svelteEntry }))?.stories;
  };

  it('reads the values without TypeScript', async () => {
    const stories = await storySnippets((value) => value);

    expect(stories?.['example--default']?.snippet).toBe(
      '<script>\n  import Button from \'./Button.svelte\';\n</script>\n\n<Button variant="primary" label="Save" />'
    );
    expect(stories?.['example--small']?.snippet).toBe(
      '<script>\n  import Button from \'./Button.svelte\';\n</script>\n\n<Button variant="primary" label="Discard" size="small" />'
    );
  });

  it.for([
    ['as', (value: string) => `${value} as any`],
    ['satisfies', (value: string) => `${value} satisfies unknown`],
    ['a non-null assertion', (value: string) => `${value}!`],
    ['a type assertion', (value: string) => `<any>${value}`],
    ['nested TypeScript expressions', (value: string) => `(<any>${value}!) satisfies unknown`],
  ] as const)('reads values with %s like values without TypeScript', async ([, wrap]) => {
    expect(await storySnippets(wrap)).toEqual(await storySnippets((value) => value));
  });

  it('reads a generic component with type arguments like the component', async () => {
    const snippets = async (component: string) => {
      vol.fromJSON({
        [svelteEntry.importPath]: `<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';
  import List from './List.svelte';
  const { Story } = defineMeta({ title: 'Example', component: ${component} });
</script>

<Story name="Default" args={{ items: ['Save'] }} />

<Story name="Children">
  <span>Discard</span>
</Story>
`,
      });
      return (await buildStoryDocsPayload({ entry: svelteEntry }))?.stories;
    };

    expect(await snippets('List<string>')).toEqual(await snippets('List'));
  });
});
