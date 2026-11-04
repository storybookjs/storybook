import type { Args, IndexEntry } from 'storybook/internal/types';

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { WebComponentsDocgenPayload } from '../component-docgen/build-docgen.ts';
import { mapArgTypes } from '../component-docgen/arg-types/map-arg-types.ts';
import type {
  ManifestClassField,
  ManifestDeclaration,
} from '../component-docgen/manifest/types.ts';
import {
  type SnippetTemplate,
  fillTemplate,
  formatTemplate,
  stripHoles,
} from 'storybook/internal/docs-tools';

import { printHole } from '../../docs/print-hole.ts';
import type { HtmlSnippetTemplate } from '../../snippet-holes.ts';
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
    { name: 'heading', fieldName: 'heading' },
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
    { kind: 'field', name: 'heading', attribute: 'heading' } as ManifestClassField & {
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
  argTypes: mapArgTypes(declaration),
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
  // The template is next's snippet with holes; these cases are about the snippet.
  const { template: _template, ...story } = Object.values(result!.stories)[0];
  return story;
};

// The template of the first story, and its snippet.
const firstTemplate = async (source: string) => {
  const { storyPath } = writeFixture(source);
  const result = await buildStoryDocsPayload(
    { entry: { ...entry, importPath: storyPath } },
    { getDocgenPayload: getDocgenPayload(), resolvePath: (path) => path }
  );
  const { snippet, template, warning } = Object.values(result!.stories)[0];
  return { snippet, template, warning };
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
      name: 'story render template',
      source: `
        import { html } from 'lit';
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: { label: 'Template', count: 2 },
          render: (args) => html\`<test-element label=\${args.label} count=\${args.count}></test-element>\`,
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: '<test-element label="Template" count="2"></test-element>',
      },
    },
    {
      name: 'story render block template aliases',
      source: `
        import { html } from 'lit';
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: { label: 'Aliased', count: 7, heading: 'Head' },
          render: (args) => {
            const { label, count: n } = args;
            const heading = args.heading;
            const tag = html\`<b>\${label}</b>\`;
            return html\`<test-element label=\${label} count=\${n} .heading=\${heading}>\${tag}</test-element>\`;
          },
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: `<test-element label="Aliased" count="7" heading="Head">
  <b>Aliased</b>
</test-element>`,
      },
    },
    {
      name: 'meta render fallback',
      source: `
        import { html } from 'lit';
        export default {
          title: 'Example/TestElement',
          component: 'test-element',
          render: (args) => html\`<test-element label=\${args.label}></test-element>\`,
        };
        export const Primary = { args: { label: 'Meta render' } };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: '<test-element label="Meta render"></test-element>',
      },
    },
    {
      name: 'story render unresolved does not fall back to meta render',
      source: `
        import { html } from 'lit';
        import { ImportedRender } from './shared-render';
        export default {
          title: 'Example/TestElement',
          component: 'test-element',
          render: (args) => html\`<test-element label="meta-\${args.label}"></test-element>\`,
        };
        export const Primary = { args: { label: 'Story' }, render: ImportedRender };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: '<test-element label="Story"></test-element>',
        warning: 'Incomplete snippet: `ImportedRender` could not be resolved statically.',
      },
      files: { 'shared-render.ts': `export const ImportedRender = () => null;` },
    },
    {
      name: 'csf2 function story',
      source: `
        import { html } from 'lit';
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = (args) => html\`<test-element label=\${args.label}></test-element>\`;
        Primary.args = { label: 'csf2' };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: '<test-element label="csf2"></test-element>',
      },
    },
    {
      name: 'unbound args warning for render template',
      source: `
        import { html } from 'lit';
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: { label: 'Bound', count: 2 },
          render: (args) => html\`<test-element label=\${args.label}></test-element>\`,
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: '<test-element label="Bound"></test-element>',
        warning: 'Incomplete snippet: args not bound by the render template: `count`.',
      },
    },
    {
      name: 'unresolved template expression arg is not unbound',
      source: `
        import { html } from 'lit';
        import { classMap } from 'lit/directives/class-map.js';
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: { active: true },
          render: (args) => html\`<test-element class=\${classMap({ active: Boolean(args.active) })}></test-element>\`,
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: '<test-element></test-element>',
        warning:
          'Incomplete snippet: `classMap({ active: Boolean(args.active) })` could not be resolved statically.',
      },
    },
    {
      name: 'args event row listener',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: { 'shape-change-event': (event) => event.preventDefault() },
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: `<test-element></test-element>
<script>
  {
    const host = document.currentScript.previousElementSibling;
    host.addEventListener('shape-change', (event) => event.preventDefault());
  }
</script>`,
      },
    },
    {
      name: 'keeps the lines and comments of a multi-line listener',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: {
            onShapeChange: (e) => {
              // log the event
              console.log(e);
            },
          },
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: `<test-element></test-element>
<script>
  {
    const host = document.currentScript.previousElementSibling;
    host.addEventListener('shape-change', (e) => {
      // log the event
      console.log(e);
    });
  }
</script>`,
      },
    },
    {
      name: 'indents a listener that does not end on a bracket from its first line',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: {
            onShapeChange: (e) =>
              console.log(e),
          },
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: `<test-element></test-element>
<script>
  {
    const host = document.currentScript.previousElementSibling;
    host.addEventListener('shape-change', (e) =>
      console.log(e));
  }
</script>`,
      },
    },
    {
      name: 'args on-convention listener',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: { onShapeChange: () => {} },
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: `<test-element></test-element>
<script>
  {
    const host = document.currentScript.previousElementSibling;
    host.addEventListener('shape-change', () => {});
  }
</script>`,
      },
    },
    {
      name: 'args duplicate event listeners',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: { 'shape-change-event': (event) => first(event), onShapeChange: (event) => second(event) },
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: `<test-element></test-element>
<script>
  {
    const host = document.currentScript.previousElementSibling;
    host.addEventListener('shape-change', (event) => first(event));
  }
</script>`,
      },
    },
    {
      name: 'args listener without matching event',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: { onUnknown: () => {} },
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: '<test-element></test-element>',
        warning: 'Incomplete snippet: listeners the HTML snippet cannot express: `onUnknown`.',
      },
    },
    {
      name: 'function arg in non-event argTypes row warns as listener',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: { label: () => 'x' },
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: '<test-element></test-element>',
        warning: 'Incomplete snippet: listeners the HTML snippet cannot express: `label`.',
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
  ])('$name', async ({ source, expected, files }) => {
    await expect(firstStory(source, { files })).resolves.toEqual(expected);
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

describe('the template', () => {
  const fill = (template: SnippetTemplate | undefined, initialArgs: Args, changed: Args) =>
    fillTemplate(
      template as HtmlSnippetTemplate,
      { initialArgs, unmappedArgs: { ...initialArgs, ...changed } },
      printHole
    );

  it('wraps each value an arg prints in a hole, with one for each declared arg it leaves unset', async () => {
    const { snippet, template } = await firstTemplate(`
      export default { title: 'Example/TestElement', component: 'test-element', args: { label: 'Meta' } };
      export const Primary = { args: { count: 2, disabled: true, 'default-slot': 'Hi' } };
    `);
    expect(snippet).toBe('<test-element label="Meta" count="2" disabled>Hi</test-element>');
    expect(stripHoles(template!)).toBe(snippet);
    const initialArgs = { label: 'Meta', count: 2, disabled: true, 'default-slot': 'Hi' };
    expect(fill(template, initialArgs, { label: 'Changed', variant: 'primary', theme: 'x' })).toBe(
      '<test-element label="Changed" count="2" disabled variant="primary">Hi</test-element>'
    );
    expect(fill(template, initialArgs, { '--accent': 'red', 'panel-part': 'color: red' })).toBe(
      '<style>\n  test-element::part(panel) { color: red }\n</style>\n<test-element label="Meta" count="2" disabled style="--accent: red;">Hi</test-element>'
    );
  });

  it('wraps each value the lit template of the render prints of an arg in a hole', async () => {
    const { snippet, template } = await firstTemplate(`
      import { html } from 'lit';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        args: { label: 'Go', disabled: false },
        render: (args) => html\`<test-element label=\${args.label} ?disabled=\${args.disabled}>\${args.label}</test-element>\`,
      };
    `);
    expect(snippet).toBe('<test-element label="Go">Go</test-element>');
    expect(formatTemplate(template!)).toBe(
      '<test-element⟦attr label mode="bind" ~" "⟫ label="Go"⟧⟦bool disabled ~" "⟫⟧>⟦text label⟫Go⟧</test-element>'
    );
    expect(
      fill(template, { label: 'Go', disabled: false }, { label: 'a < b', disabled: true })
    ).toBe('<test-element label="a &lt; b" disabled>a &lt; b</test-element>');
  });

  it('shows an arg the server cannot read once a control changes it', async () => {
    const { snippet, template } = await firstTemplate(`
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = { args: { label: makeLabel(), count: 2 } };
    `);
    expect(snippet).toBe('<test-element count="2"></test-element>');
    const initialArgs = { label: 'Made', count: 2 };
    expect(fill(template, initialArgs, {})).toBe(snippet);
    expect(fill(template, initialArgs, { label: 'Changed' })).toBe(
      '<test-element count="2" label="Changed"></test-element>'
    );
  });

  it('sets a property without an attribute a control changes in a script', async () => {
    const { snippet, template } = await firstTemplate(`
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = { args: { label: 'Go', items: ['a'] } };
    `);
    expect(snippet).toBe('<test-element label="Go"></test-element>');
    expect(fill(template, { label: 'Go', items: ['a'] }, {})).toBe(snippet);
    expect(fill(template, { label: 'Go', items: ['a'] }, { items: ['a', '</script>'] })).toBe(
      [
        '<test-element label="Go"></test-element>',
        '<script>',
        "  document.querySelector('test-element').items = ['a', '<\\/script>'];",
        '</script>',
      ].join('\n')
    );
    expect(fill(template, { label: 'Go', items: ['a'] }, { items: undefined })).toBe(snippet);
  });

  it('sets a property a lit template binds without an attribute in a script', async () => {
    const { template } = await firstTemplate(`
      import { html } from 'lit';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        args: { label: 'Go', data: { items: [1] }, onShapeChange: () => {} },
        render: (args) => html\`<test-element label=\${args.label} .items=\${args.data.items} @shape-change=\${args.onShapeChange}></test-element>\`,
      };
    `);
    const initialArgs = { label: 'Go', data: { items: [1] } };
    expect(fill(template, initialArgs, { label: 'Stop', data: { items: [1, 2] } })).toBe(
      [
        '<test-element label="Stop"></test-element>',
        '<script>',
        '  {',
        '    const host = document.currentScript.previousElementSibling;',
        "    host.addEventListener('shape-change', () => {});",
        '  }',
        '</script>',
        '<script>',
        "  document.querySelector('test-element').items = [1, 2];",
        '</script>',
      ].join('\n')
    );
  });

  it('follows a member of an arg and an arg a nested template reads', async () => {
    const { template } = await firstTemplate(`
      import { html } from 'lit';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        args: { user: { name: 'Bob' }, label: 'Go' },
        render: (args) => {
          const badge = html\`<b>\${args.label}</b>\`;
          return html\`<test-element label=\${args.user.name}>\${badge}</test-element>\`;
        },
      };
    `);
    const initialArgs = { user: { name: 'Bob' }, label: 'Go' };
    expect(fill(template, initialArgs, { user: { name: 'Ann' }, label: 'Stop' })).toBe(
      '<test-element label="Ann">\n  <b>Stop</b>\n</test-element>'
    );
  });

  it('prints the branch of a conditional on an arg a control picks', async () => {
    const { snippet, template } = await firstTemplate(`
      import { html, nothing } from 'lit';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        args: { open: true, badge: false },
        render: (args) => html\`<test-element class="card \${args.open ? 'open' : ''}" label=\${args.open ? 'Open' : 'Closed'}>\${args.badge ? html\`<b>New</b>\` : nothing}</test-element>\`,
      };
    `);
    expect(snippet).toBe('<test-element class="card open" label="Open"></test-element>');
    const initialArgs = { open: true, badge: false };
    expect(fill(template, initialArgs, { open: 0, badge: 'yes' })).toBe(
      '<test-element class="card" label="Closed"><b>New</b></test-element>'
    );
  });

  it('cannot follow an arg a conditional reads', async () => {
    const { template } = await firstTemplate(`
      import { html } from 'lit';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        args: { label: 'Go', open: true },
        render: (args) => html\`<test-element label=\${args.open ? args.label : 'Closed'}></test-element>\`,
      };
    `);
    expect(() => fill(template, { label: 'Go', open: true }, { open: false })).toThrow(
      'The snippet cannot show the current value of the `open` arg.'
    );
  });

  it('cannot follow an arg an attribute reads next to code it cannot resolve', async () => {
    const { template } = await firstTemplate(`
      import { html } from 'lit';
      import { suffix } from './suffix';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        args: { label: 'Go' },
        render: (args) => html\`<test-element title="\${args.label} \${suffix}"></test-element>\`,
      };
    `);
    expect(() => fill(template, { label: 'Go' }, { label: 'Stop' })).toThrow(
      'The snippet cannot show the current value of the `label` arg.'
    );
  });

  it('is not there where next prints no snippet', async () => {
    const { snippet, template } = await firstTemplate(`
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = { args: { label: makeLabel() } };
    `);
    expect(snippet).toBeUndefined();
    expect(template).toBeUndefined();
  });
});
