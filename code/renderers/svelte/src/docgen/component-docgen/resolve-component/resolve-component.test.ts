// @vitest-environment node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { IndexEntry } from 'storybook/internal/types';

import { expect, it } from 'vitest';

import { resolveStoryComponent, resolveStorySubcomponents } from './resolve-component.ts';

// oxc-resolver reads the real file system, so the projects are committed fixtures.
const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../__testfixtures__');

const entryFor = (file: string): IndexEntry => ({
  id: 'button--primary',
  name: 'Primary',
  title: 'Button',
  type: 'story',
  subtype: 'story',
  importPath: join(fixtures, file),
  tags: [],
});

it.each([
  ['a tsconfig.json path', 'alias-tsconfig/Button.stories.ts'],
  ['a package.json subpath import', 'subpath-imports/Button.stories.js'],
])('resolves a component imported through %s', async (_, file) => {
  expect(await resolveStoryComponent(entryFor(file))).toEqual({
    componentPath: join(fixtures, dirname(file), 'src/lib/Button.svelte'),
    exportName: 'default',
    name: 'Button',
  });
});

it.each(['define-meta', 'preview-meta'])(
  'resolves the component of a Svelte CSF file that uses %s',
  async (file) => {
    expect(await resolveStoryComponent(entryFor(`svelte-csf/${file}.stories.svelte`))).toEqual({
      componentPath: join(fixtures, 'svelte-csf/Button.svelte'),
      exportName: 'default',
      name: 'Button',
    });
  }
);

it.each(['member-expression', 'member-expression-trap', 'member-expression-exported'])(
  'resolves the component of a Svelte CSF file with a member expression of a named import (%s)',
  async (file) => {
    expect(await resolveStoryComponent(entryFor(`svelte-csf/${file}.stories.svelte`))).toEqual({
      componentPath: join(fixtures, 'svelte-csf/Select.svelte'),
      // The property value binds the component's default export, not the property name.
      exportName: 'default',
      name: 'Select',
    });
  }
);

it('resolves a member expression through a spread that overrides the property', async () => {
  expect(
    await resolveStoryComponent(entryFor('svelte-csf/member-expression-spread.stories.svelte'))
  ).toEqual({
    componentPath: join(fixtures, 'svelte-csf/Other.svelte'),
    exportName: 'default',
    name: 'Select',
  });
});

it('declines a member expression an unreadable spread may replace', async () => {
  await expect(
    resolveStoryComponent(entryFor('svelte-csf/member-expression-opaque-spread.stories.svelte'))
  ).resolves.toBeUndefined();
});

it('declines a member expression whose binding an unrelated export shadows', async () => {
  await expect(
    resolveStoryComponent(entryFor('svelte-csf/member-expression-masquerade.stories.svelte'))
  ).resolves.toBeUndefined();
});

it('resolves the component of a Svelte CSF file with a member expression of a namespace import', async () => {
  expect(
    await resolveStoryComponent(entryFor('svelte-csf/namespace-import.stories.svelte'))
  ).toEqual({
    componentPath: join(fixtures, 'svelte-csf/Button.svelte'),
    exportName: 'Button',
    name: 'Button',
  });
});

it('reports an unresolved component import', async () => {
  await expect(resolveStoryComponent(entryFor('unresolved/missing.stories.ts'))).rejects.toThrow(
    'Could not resolve `./Missing.svelte` export `default`'
  );
});

it('reports a component expression it cannot follow', async () => {
  await expect(resolveStoryComponent(entryFor('unresolved/global.stories.ts'))).rejects.toThrow(
    'Cannot resolve the component `globalThis.__TEMPLATE_COMPONENTS__.Button`'
  );
});

it.each([
  'default-as',
  'named',
  'star',
  'local',
  'namespace',
  'star-svelte',
  'module-svelte',
  'js-extension',
])('resolves a plain CSF component through the %s barrel', async (barrel) => {
  expect(await resolveStoryComponent(entryFor(`barrels/${barrel}.stories.ts`))).toEqual({
    componentPath: join(fixtures, 'barrels/Button.svelte'),
    exportName: 'Button',
    name: 'Button',
  });
});

it('reports a circular barrel export instead of publishing empty argTypes', async () => {
  await expect(resolveStoryComponent(entryFor('circular/Button.stories.ts'))).rejects.toThrow(
    'Could not resolve `./lib` export `Button`'
  );
});

it('resolves a component that a barrel exports as its default', async () => {
  expect(await resolveStoryComponent(entryFor('barrels/default-export.stories.ts'))).toEqual({
    componentPath: join(fixtures, 'barrels/Button.svelte'),
    exportName: 'default',
    name: 'Button',
  });
});

it.each(['plain.stories.ts', 'svelte-csf.stories.svelte'])(
  'resolves the subcomponents of %s and leaves out the ones that do not resolve',
  async (file) => {
    expect(await resolveStorySubcomponents(entryFor(`subcomponents/${file}`))).toEqual({
      Icon: {
        componentPath: join(fixtures, 'subcomponents/Icon.svelte'),
        exportName: 'default',
        name: 'Icon',
      },
    });
  }
);
