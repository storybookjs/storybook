// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { resolve } from 'pathe';
import { compile } from 'svelte/compiler';
import { fs as memoryFs, vol } from 'memfs';
import type { IndexEntry } from 'storybook/internal/types';

import { buildStoryDocsPayload } from './build-story-docs.ts';

vi.mock('node:fs/promises', { spy: true });

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
    const payload = await buildStoryDocsPayload({ entry }, { readDocgen: async () => undefined });
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
    const payload = await buildStoryDocsPayload({ entry }, { readDocgen: async () => undefined });
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
    const payload = await buildStoryDocsPayload({ entry }, { readDocgen: async () => undefined });
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
  const payload = await buildStoryDocsPayload(
    { entry: svelteEntry },
    { readDocgen: async () => undefined }
  );
  expect(payload?.stories['example--default']?.warning).toBe('Identifier not resolved: `missing`.');
});

it.each([
  ['native', '', '<button {...args}>Save</button>', '<button>Save</button>'],
  ['component', "import Button from './Button.svelte';", '<Button {...args} />', '<Button />'],
])('omits chained mocks from a %s Svelte CSF snippet', async (_, imports, markup, expected) => {
  const svelteEntry = { ...entry, importPath: resolve('input.stories.svelte') };
  vol.fromJSON({
    [svelteEntry.importPath]: `<script module>
      import { defineMeta } from '@storybook/svelte';
      import { fn as mock } from 'storybook/test';
      ${imports}
      const { Story } = defineMeta({ title: 'Example', args: { x: mock().mockName('x').mockReturnValue(1) } });
    </script>
    <Story name="Default" asChild>${markup}</Story>`,
  });
  const payload = await buildStoryDocsPayload(
    { entry: svelteEntry },
    { readDocgen: async () => undefined }
  );
  const snippet = payload?.stories['example--default']?.snippet;
  expect(snippet).toContain(expected);
  expect(snippet).not.toContain('x=');
  expect(snippet).not.toContain('storybook/test');
  expect(snippet).not.toContain('mock');
});

it('preserves a chained factory that is not a storybook mock', async () => {
  vol.fromJSON({
    [entry.importPath]: `import Button from './Button.svelte';
import { fn } from 'custom-factory';
export default { title: 'Example', component: Button };
export const Default = { args: { x: fn().mockName('x') } };`,
  });
  const payload = await buildStoryDocsPayload({ entry }, { readDocgen: async () => undefined });
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
  const payload = await buildStoryDocsPayload(
    { entry: svelteEntry },
    { readDocgen: async () => undefined }
  );
  const snippet = payload?.stories['example--default']?.snippet;
  expect(snippet).toContain("let label = 'instance';");
  expect(snippet).toContain("const _label = 'module';");
  expect(snippet).toContain('() => _label');
  expect(snippet).toContain('{label}</Button>');
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
    const payload = await buildStoryDocsPayload(
      { entry: storyEntry },
      { readDocgen: async () => undefined }
    );
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
    const payload = await buildStoryDocsPayload(
      { entry: storyEntry },
      { readDocgen: async () => undefined }
    );
    const snippet = payload?.stories['example--default']?.snippet;
    expect(snippet).toContain('const value');
    expect(snippet).toContain('let count');
    expect(snippet).toContain(typescript ? '<script module lang="ts">' : '<script module>');
    expect(snippet).toContain(typescript ? '<script lang="ts">' : '<script>');
    expect(() => compile(snippet ?? '', { generate: 'server' })).not.toThrow();
  }
);
