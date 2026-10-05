import type { IndexEntry } from 'storybook/internal/types';

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { WebComponentsDocgenPayload } from '../component-docgen/build-docgen.ts';
import { DEFAULT_TYPE_PROPERTY } from '../component-docgen/arg-types/alt-type.ts';
import { mapArgTypes } from '../component-docgen/arg-types/map-arg-types.ts';
import type {
  ManifestClassField,
  ManifestDeclaration,
} from '../component-docgen/manifest/types.ts';
import { buildStoryDocsPayload, type BuildStoryDocsContext } from './build-story-docs.ts';

const declaration = {
  kind: 'class',
  name: 'TestElement',
  customElement: true,
  tagName: 'test-element',
  attributes: [
    { name: 'label', fieldName: 'label' },
    { name: 'count', fieldName: 'count' },
    { name: 'disabled', fieldName: 'disabled' },
    { name: 'active', fieldName: 'active' },
    { name: 'is-open', fieldName: 'isOpen' },
    { name: 'variant' },
  ],
  members: [
    { kind: 'field', name: 'label', attribute: 'label' } as ManifestClassField & {
      attribute: string;
    },
    { kind: 'field', name: 'count', attribute: 'count' } as ManifestClassField & {
      attribute: string;
    },
    { kind: 'field', name: 'disabled', attribute: 'disabled' } as ManifestClassField & {
      attribute: string;
    },
    {
      kind: 'field',
      name: 'active',
      attribute: 'active',
      default: 'true',
    } as ManifestClassField & {
      attribute: string;
    },
    { kind: 'field', name: 'isOpen', attribute: 'is-open' } as ManifestClassField & {
      attribute: string;
    },
    { kind: 'field', name: 'items' },
    { kind: 'method', name: 'refresh' },
  ],
  events: [{ name: 'shape-change', type: { text: 'CustomEvent' } }],
  slots: [{ name: '' }, { name: 'actions' }],
  cssParts: [{ name: 'panel' }],
  cssStates: [{ name: 'active' }],
  cssProperties: [{ name: '--accent' }],
} satisfies ManifestDeclaration;

const entry: IndexEntry = {
  id: 'example-test-element--primary',
  name: 'Primary',
  title: 'Example/TestElement',
  type: 'story',
  subtype: 'story',
  importPath: 'input.stories.ts',
};

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const payload = (extra: Partial<WebComponentsDocgenPayload> = {}): WebComponentsDocgenPayload => ({
  id: 'example-test-element',
  name: 'test-element',
  path: 'input.stories.ts',
  argTypes: mapArgTypes(declaration, DEFAULT_TYPE_PROPERTY),
  jsDocTags: {},
  customElementsManifest: { manifestPath: 'custom-elements.json', declaration },
  ...extra,
});

const getDocgenPayload =
  (
    value: WebComponentsDocgenPayload | undefined = payload()
  ): BuildStoryDocsContext['getDocgenPayload'] =>
  async () =>
    value;

const writeFixture = (source: string, files: Record<string, string> = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'wc-story-docs-'));
  dirs.push(dir);
  const storyPath = join(dir, 'input.stories.ts');
  writeFileSync(storyPath, source);
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(dir, name), contents);
  }
  return { dir, storyPath };
};

const firstStory = async (
  source: string,
  options: {
    files?: Record<string, string>;
    docgen?: WebComponentsDocgenPayload | undefined;
  } = {}
) => {
  const { storyPath } = writeFixture(source, options.files);
  const result = await buildStoryDocsPayload(
    { entry: { ...entry, importPath: storyPath } },
    {
      getDocgenPayload: getDocgenPayload(options.docgen),
      resolvePath: (path) => path,
    }
  );
  expect(result).toBeDefined();
  return Object.values(result!.stories)[0];
};

describe('buildStoryDocsPayload', () => {
  it.each([
    {
      name: 'args story',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element', args: { label: 'Meta' } };
        export const Primary = { args: { count: 2, disabled: true } };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: '<test-element label="Meta" count="2" disabled></test-element>',
      },
    },
    {
      name: 'authored code',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          parameters: { docs: { source: { code: '<test-element label="authored"></test-element>' } } },
          args: { label: 'Ignored' },
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: '<test-element label="authored"></test-element>',
      },
    },
    {
      name: 'authored null',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          parameters: { docs: { source: { code: null } } },
          args: { label: 'Ignored' },
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
      },
    },
    {
      name: 'render fallback warning',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: { label: 'Fallback' },
          render: () => document.createElement('test-element'),
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: '<test-element label="Fallback"></test-element>',
        warning:
          "Incomplete snippet: `() => document.createElement('test-element')` could not be resolved statically.",
      },
    },
    {
      name: 'uses the docgen declaration tag',
      source: `
        const Button = {};
        export default { title: 'Example/TestElement', component: Button };
        export const Primary = { args: { label: 'Meta' } };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: '<test-element label="Meta"></test-element>',
      },
    },
  ])('$name', async ({ source, expected }) => {
    await expect(firstStory(source)).resolves.toEqual(expected);
  });

  it('records story-level errors', async () => {
    const story = await firstStory(`
      declare function makeStory(): unknown;
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = makeStory();
    `);

    expect(story.id).toBe('example-testelement--primary');
    expect(story.name).toBe('Primary');
    expect(story.error?.name).toBe('SyntaxError');
    expect(story.error?.message).toContain(
      'Expected story to be csf factory, function or an object expression'
    );
  });

  it('resolves a spread from a sibling file', async () => {
    await expect(
      firstStory(
        `
          import { sharedArgs } from './shared-args';
          export default { title: 'Example/TestElement', component: 'test-element' };
          export const Primary = { args: { ...sharedArgs, count: 2 } };
        `,
        { files: { 'shared-args.ts': `export const sharedArgs = { label: 'Shared' };` } }
      )
    ).resolves.toEqual({
      id: 'example-testelement--primary',
      name: 'Primary',
      snippet: '<test-element label="Shared" count="2"></test-element>',
    });
  });

  it('classifies an imported property identifier without resolving the value', async () => {
    await expect(
      firstStory(
        `
          import { itemsFixture } from './shared-args';
          export default { title: 'Example/TestElement', component: 'test-element', args: { label: 'Meta' } };
          export const Primary = { args: { items: itemsFixture } };
        `,
        { files: { 'shared-args.ts': `export const itemsFixture = [{ name: 'Alpha' }];` } }
      )
    ).resolves.toEqual({
      id: 'example-testelement--primary',
      name: 'Primary',
      snippet: '<test-element label="Meta"></test-element>',
      warning: 'Incomplete snippet: properties without an attribute: `items`.',
    });
  });

  it('warns when an imported attribute identifier is unresolved', async () => {
    await expect(
      firstStory(
        `
          import { importedLabel } from './shared-args';
          export default { title: 'Example/TestElement', component: 'test-element' };
          export const Primary = { args: { label: importedLabel } };
        `,
        { files: { 'shared-args.ts': `export const importedLabel = 'From module';` } }
      )
    ).resolves.toEqual({
      id: 'example-testelement--primary',
      name: 'Primary',
      warning: 'No static snippet: `importedLabel` could not be resolved statically.',
    });
  });

  it('warns when no declaration is available', async () => {
    await expect(
      firstStory(
        `
          export default { title: 'Example/TestElement', component: 'test-element' };
          export const Primary = { args: { label: 'Missing' } };
        `,
        {
          docgen: payload({
            customElementsManifest: undefined,
            error: { name: 'tag-not-found', message: 'No declaration for "test-element".' },
          }),
        }
      )
    ).resolves.toEqual({
      id: 'example-testelement--primary',
      name: 'Primary',
      warning: 'No static snippet: No declaration for "test-element".',
    });
  });

  it.each([
    {
      name: 'no declaration',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const A = { parameters: { docs: { source: { code: '<p>authored</p>' } } } };
        export const B = { parameters: { docs: { source: { code: null } } }, args: { label: 'x' } };
      `,
      docgen: payload({
        customElementsManifest: undefined,
        error: { name: 'tag-not-found', message: 'No declaration for "test-element".' },
      }),
    },
    {
      name: 'no meta component',
      source: `
        export default { title: 'Example/TestElement' };
        export const A = { parameters: { docs: { source: { code: '<p>authored</p>' } } } };
        export const B = { parameters: { docs: { source: { code: null } } }, args: { label: 'x' } };
      `,
      docgen: undefined,
    },
  ])('uses authored source before falling back for $name', async ({ source, docgen }) => {
    const { storyPath } = writeFixture(source);
    const result = await buildStoryDocsPayload(
      { entry: { ...entry, importPath: storyPath } },
      {
        getDocgenPayload: getDocgenPayload(docgen),
        resolvePath: (path) => path,
      }
    );

    expect(Object.values(result!.stories).map(({ snippet, warning }) => ({ snippet, warning })))
      .toMatchInlineSnapshot(`
      [
        {
          "snippet": "<p>authored</p>",
          "warning": undefined,
        },
        {
          "snippet": undefined,
          "warning": undefined,
        },
      ]
    `);
  });

  it('warns when meta.component is missing', async () => {
    await expect(
      firstStory(
        `
          export default { title: 'Example/TestElement', render: (args) => \`<p>\${args.label}</p>\` };
          export const Primary = { args: { label: 'Page' } };
        `,
        { docgen: undefined }
      )
    ).resolves.toEqual({
      id: 'example-testelement--primary',
      name: 'Primary',
      warning: 'No static snippet: `meta.component` is not set.',
    });
  });

  it('uses the title segment as the payload name when meta.component is missing', async () => {
    const { storyPath } = writeFixture(`
      export default { title: 'Example/TestElement', render: (args) => \`<p>\${args.label}</p>\` };
      export const Primary = { args: { label: 'Page' } };
    `);

    await expect(
      buildStoryDocsPayload(
        { entry: { ...entry, importPath: storyPath } },
        {
          getDocgenPayload: getDocgenPayload(undefined),
          resolvePath: (path) => path,
        }
      )
    ).resolves.toMatchObject({ name: 'TestElement' });
  });

  it.each([
    {
      name: 'property true then attribute false',
      args: `{ isOpen: true, 'is-open': false }`,
      expected: '<test-element></test-element>',
    },
    {
      name: 'attribute false then property true',
      args: `{ 'is-open': false, isOpen: true }`,
      expected: '<test-element is-open></test-element>',
    },
    {
      name: 'property true then attribute string',
      args: `{ isOpen: true, 'is-open': 'later' }`,
      expected: '<test-element is-open="later"></test-element>',
    },
    {
      name: 'attribute string then property false',
      args: `{ 'is-open': 'earlier', isOpen: false }`,
      expected: '<test-element></test-element>',
    },
  ])('uses the last write for duplicate attributes: $name', async ({ args, expected }) => {
    const story = await firstStory(`
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = { args: ${args} };
    `);

    expect(story.snippet).toBe(expected);
  });

  it.each([
    {
      name: 'field-backed empty string',
      args: `{ label: '' }`,
      expected: '<test-element label=""></test-element>',
    },
    {
      name: 'attribute-only empty string',
      args: `{ variant: '' }`,
      expected: '<test-element></test-element>',
    },
  ])(
    'prints empty strings according to their runtime binding: $name',
    async ({ args, expected }) => {
      const story = await firstStory(`
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = { args: ${args} };
    `);

      expect(story.snippet).toBe(expected);
    }
  );

  it.each([
    {
      name: 'default true',
      args: `{ active: false }`,
      expected: {
        snippet: '<test-element></test-element>',
        warning: 'Incomplete snippet: false values that HTML cannot express: `active`.',
      },
    },
    {
      name: 'no true default',
      args: `{ disabled: false }`,
      expected: {
        snippet: '<test-element></test-element>',
        warning: undefined,
      },
    },
  ])(
    'warns only for false boolean args whose default is true: $name',
    async ({ args, expected }) => {
      const story = await firstStory(`
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = { args: ${args} };
    `);

      expect({ snippet: story.snippet, warning: story.warning }).toEqual(expected);
    }
  );
});
