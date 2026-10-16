import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildDocgenPayload } from '../../../../renderers/svelte/src/docgen/component-docgen/build-docgen.ts';
import { buildStoryDocsPayload } from '../../../../renderers/svelte/src/docgen/story-docs/build-story-docs.ts';
import { createIndexer } from '../../../../renderers/svelte/src/svelte-csf/indexer/index.ts';
import {
  createDocgenCache,
  generateDocgen,
} from '../../../../renderers/svelte/src/docgen/component-docgen/svelte2tsx/generate-docgen.ts';

const fixtureDir = fileURLToPath(
  new URL('./story-docs/__fixtures__/legacy-metadata/', import.meta.url)
);

afterEach(() => vi.restoreAllMocks());

const payload = (storyFile = 'input.stories.ts') =>
  buildDocgenPayload(
    {
      entry: {
        id: 'metadata--default',
        title: 'Metadata',
        name: 'Default',
        type: 'story',
        subtype: 'story',
        tags: [],
        importPath: join(fixtureDir, storyFile),
      },
    },
    { cache: createDocgenCache() }
  );

describe('server metadata for legacy components', () => {
  it('extracts documentation from components with SCSS', async () => {
    const result = await payload();
    expect(result).toMatchObject({
      description: 'Button with native attributes, events and slots.',
      argTypes: {
        label: { table: { defaultValue: { summary: '"Select"' } } },
      },
    });
    expect(result?.error).toBeUndefined();
  });

  it('preserves typed events and slots with documentation', async () => {
    expect((await payload())?.argTypes).toMatchObject({
      event_select: {
        name: 'select',
        description: 'Emitted after selection.',
        control: false,
        action: 'select',
        table: { category: 'events', type: { summary: 'CustomEvent<string>' } },
      },
      slot_default: {
        name: 'default',
        description: 'The button content.\n\n`label`',
        control: false,
        table: { category: 'slots', type: { summary: '{ label: string; }' } },
      },
    });
  });

  it('identifies callable native event aliases as functions', async () => {
    expect((await payload())?.argTypes).toMatchObject({
      onclick: {
        type: { name: 'function', raw: 'MouseEventHandler<HTMLButtonElement>' },
        control: false,
        table: { category: 'events', type: { summary: 'MouseEventHandler<HTMLButtonElement>' } },
      },
    });
  });

  it('preserves inherited native attributes on the server', async () => {
    expect((await payload())?.argTypes).toMatchObject({
      disabled: { name: 'disabled', table: { category: 'properties' } },
      'aria-label': { name: 'aria-label', table: { category: 'properties' } },
    });
  });
});

it('keeps the native attribute filter for legacy engine consumers', () => {
  const docgen = generateDocgen(join(fixtureDir, 'Metadata.svelte'), createDocgenCache());
  expect(docgen.props.map((prop) => prop.name)).toEqual(['label']);
});

it('returns an extraction error for malformed templates', async () => {
  const broken = await fs.readFile(join(fixtureDir, 'Broken.svelte.txt'), 'utf8');
  const readSource = ts.sys.readFile;
  vi.spyOn(ts.sys, 'readFile').mockImplementation((filename, encoding) =>
    filename === join(fixtureDir, 'Metadata.svelte') ? broken : readSource(filename, encoding)
  );
  const result = await payload();
  expect(result?.error).toMatchObject({ name: 'Svelte docgen failed' });
  expect(result?.error?.message).toContain('attempted to close an element that was not open');
  expect(result?.argTypes).toBeUndefined();
});

it('infers typed dispatcher events without an explicit events interface', async () => {
  expect((await payload('inferred.stories.ts'))?.argTypes).toMatchObject({
    event_change: {
      name: 'change',
      action: 'change',
      control: false,
      table: { category: 'events', type: { summary: 'CustomEvent<number>' } },
    },
  });
});

it('indexes wrapped stories and preserves their server snippets', async () => {
  const filename = join(fixtureDir, 'nested.stories.svelte');
  const entries = await createIndexer().createIndex(filename, {
    makeTitle: (title) => title ?? '',
  });
  expect(entries.map((entry) => entry.exportName)).toEqual(['NestedButton']);
  const result = await buildStoryDocsPayload(
    {
      entry: {
        id: 'nested--nested-button',
        title: 'Nested',
        name: 'Nested button',
        type: 'story',
        subtype: 'story',
        tags: [],
        importPath: filename,
      },
    },
    { readDocgen: async () => undefined }
  );
  expect(result?.stories['nested--nested-button']?.snippet).toContain('<Inferred');
});

it('preserves imported expressions and local dependencies without evaluating story code', async () => {
  const result = await buildStoryDocsPayload(
    {
      entry: {
        id: 'expressions--imported',
        title: 'Expressions',
        name: 'Imported',
        type: 'story',
        subtype: 'story',
        importPath: join(fixtureDir, 'expressions.stories.svelte'),
      },
    },
    { readDocgen: async () => undefined }
  );
  const imported = result?.stories['expressions--imported'];
  expect(imported?.snippet).toContain("import data from './data.json';");
  expect(imported?.snippet).toContain('data={data.filter((row) => row.enabled)}');
  expect(imported?.warning).toBeUndefined();
  const nested = result?.stories['expressions--nested'];
  expect(nested?.snippet).toContain("const path = '/image.png';");
  expect(nested?.snippet).toContain('const makeTab = (label: string) => ({ label });');
  expect(nested?.snippet).toContain('value={{');
  expect(nested?.snippet).toContain('tabs={[makeTab(');
  expect(nested?.warning).toBeUndefined();
  const literal = result?.stories['expressions--literal'];
  expect(literal?.snippet).toContain('label={[ "Line one\\nLine two" ]}');
  expect(literal?.warning).toBeUndefined();
});

it('keeps explicit spread overrides and preserves later args without duplicate attributes', async () => {
  const result = await buildStoryDocsPayload(
    {
      entry: {
        id: 'spreads--overrides',
        title: 'Spreads',
        name: 'Overrides',
        type: 'story',
        subtype: 'story',
        importPath: join(fixtureDir, 'spreads.stories.svelte'),
      },
    },
    { readDocgen: async () => undefined }
  );
  const story = result?.stories['spreads--overrides'];
  expect(story?.snippet).toContain('<Metadata disabled label="Explicit" />');
  expect(story?.snippet).toContain('<Metadata label={"From args"} disabled />');
  expect(story?.warning).toBeUndefined();
});

it('prints strings with Svelte syntax as expressions and keeps bindings free of duplicate props', async () => {
  const result = await buildStoryDocsPayload(
    {
      entry: {
        id: 'unsafe-strings--markup',
        title: 'Unsafe strings',
        name: 'Markup',
        type: 'story',
        subtype: 'story',
        importPath: join(fixtureDir, 'unsafe-strings.stories.svelte'),
      },
    },
    { readDocgen: async () => undefined }
  );
  expect(result?.stories['unsafe-strings--markup']?.snippet).toContain(
    'label={"<span title=\\"quoted\\">{content}</span> & end"}'
  );
  expect(result?.stories['unsafe-strings--multiline']?.snippet).toContain(
    'label={"First line\\nSecond line"}'
  );
  const binding = result?.stories['unsafe-strings--binding'];
  expect(binding?.snippet).toContain('let files = [];');
  expect(binding?.snippet).toMatch(/<Metadata bind:files\s*\/>/);
  expect(binding?.snippet).not.toContain('files={');
  for (const story of Object.values(result?.stories ?? {})) expect(story.warning).toBeUndefined();
});
