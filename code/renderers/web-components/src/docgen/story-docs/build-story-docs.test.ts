import { UnprintableArgError } from 'storybook/internal/docs-tools';
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
import { fillTemplate } from '../../docs/fill-template.ts';
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

const firstStory = async (...args: Parameters<typeof firstStoryWithTemplate>) => {
  const { template: _template, ...doc } = await firstStoryWithTemplate(...args);
  return doc;
};

const firstStoryWithTemplate = async (
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

const story = (body: string, imports = '') => `
  import { html, nothing } from 'lit';
  ${imports}
  export default { title: 'Example/TestElement', component: 'test-element' };
  export const Primary = ${body};
`;

describe('buildStoryDocsPayload template', () => {
  it('spreads the args of a story without a render with the binding each maps to', async () => {
    const doc = await firstStoryWithTemplate(
      story(`{ args: { label: 'Hi', isOpen: true, items: [1], '--accent': 'red' } }`)
    );
    expect(doc.template).toMatchInlineSnapshot(
      `"<test-element \${...args/* {"label":".label=label","isOpen":".isOpen=is-open","items":".items","--accent":"--accent","default-slot":null,"actions-slot":null,"panel-part":null,"active-state":null,"count":".count=count","disabled":".disabled=disabled","active":".active=active","is-open":"is-open","variant":"variant","heading":".heading=heading"} */}></test-element>"`
    );
    expect(
      fillTemplate(doc.template!, {
        label: 'Bye',
        isOpen: false,
        items: [1],
        variant: 'outline',
        '--accent': 'red',
      })
    ).toMatchInlineSnapshot(
      `"<test-element label="Bye" .isOpen=\${false} .items=\${[1]} variant="outline" style="--accent: red;"></test-element>"`
    );
  });

  it.each([
    { name: 'slot content', args: { 'default-slot': 'Body' } },
    { name: 'a css part', args: { 'panel-part': 'color: red;' } },
    { name: 'a css state', args: { 'active-state': 'color: red;' } },
  ])('cannot fill $name set from the controls', async ({ args }) => {
    const doc = await firstStoryWithTemplate(story(`{ args: { label: 'Hi' } }`));
    expect(() => fillTemplate(doc.template!, { label: 'Hi', ...args })).toThrow(
      UnprintableArgError
    );
  });

  it('keeps the listener script of the snippet', async () => {
    const doc = await firstStoryWithTemplate(
      story(`{ args: { label: 'Hi', onShapeChange: () => {} } }`)
    );
    expect(fillTemplate(doc.template!, { label: 'Bye', onShapeChange: () => {} }))
      .toMatchInlineSnapshot(`
        "<test-element label="Bye"></test-element>
        <script>
          {
            const host = document.currentScript.previousElementSibling;
            host.addEventListener('shape-change', () => {});
          }
        </script>"
      `);
  });

  it('fills args the static pass cannot read', async () => {
    const doc = await firstStoryWithTemplate(
      story(`{ args: { label: imported } }`, `import { imported } from './values.ts';`),
      { files: { 'values.ts': 'export const imported = String(1);' } }
    );
    expect(doc.snippet).toBeUndefined();
    expect(fillTemplate(doc.template!, { label: '1' })).toBe(
      '<test-element label="1"></test-element>'
    );
  });

  it.each([
    { name: 'slot content', args: `{ 'default-slot': 'Body' }` },
    { name: 'a css part', args: `{ 'panel-part': 'color: red;' }` },
    { name: 'an arg the component does not declare', args: `{ nope: 1 }` },
    { name: 'a listener without an event', args: `{ anything: () => {} }` },
  ])('leaves the static snippet for $name', async ({ args }) => {
    const doc = await firstStoryWithTemplate(story(`{ args: ${args} }`));
    expect(doc.template).toBeUndefined();
  });

  it('is the html of the render as written, with destructured and aliased args as args paths', async () => {
    const doc = await firstStoryWithTemplate(
      story(`{
        args: { label: 'Hi', disabled: true, heading: 'Head' },
        render: ({ label, disabled, heading: title }) => {
          const heading = title;
          return html\`<test-element label=\${label} ?disabled=\${disabled} .heading=\${heading}>
            <span>\${label}</span>
          </test-element>\`;
        },
      }`)
    );
    expect(doc.template).toMatchInlineSnapshot(`
      "<test-element label=\${args.label} ?disabled=\${args.disabled} .heading=\${args.heading}>
        <span>\${args.label}</span>
      </test-element>"
    `);
    expect(fillTemplate(doc.template!, { label: 'a < b', disabled: false, heading: 'Head' }))
      .toMatchInlineSnapshot(`
        "<test-element label="a &lt; b" .heading=\${"Head"}>
          <span>a &lt; b</span>
        </test-element>"
      `);
  });

  it('keeps conditionals and maps as code, with the args filled in', async () => {
    const doc = await firstStoryWithTemplate(
      story(`{
        args: { loading: false, items: ['a'] },
        render: (args) => html\`<test-element>
          \${args.loading ? html\`<x-spinner></x-spinner>\` : nothing}
          <ul>\${args.items.map((item) => html\`<li>\${item}</li>\`)}</ul>
        </test-element>\`,
      }`)
    );
    expect(fillTemplate(doc.template!, { loading: true, items: ['a', 'b'] }))
      .toMatchInlineSnapshot(`
        "<test-element>
          \${true ? html\`<x-spinner></x-spinner>\` : nothing}
          <ul>\${["a", "b"].map(item => html\`<li>\${item}</li>\`)}</ul>
        </test-element>"
      `);
  });

  it('writes values with replacement patterns as they are', async () => {
    const doc = await firstStoryWithTemplate(
      story(`{
        args: { label: '$&' },
        render: (args) => html\`<test-element label=\${args.label}>\${args.label}</test-element>\`,
      }`)
    );
    expect(fillTemplate(doc.template!, { label: '$`' })).toBe(
      '<test-element label="$`">$`</test-element>'
    );
  });

  it('leaves the static snippet for a render it cannot read', async () => {
    const doc = await firstStoryWithTemplate(
      story(`{ args: { label: 'Hi' }, render: () => document.createElement('test-element') }`)
    );
    expect(doc.template).toBeUndefined();
  });

  it('leaves the static snippet for a render that collects the rest of the args', async () => {
    const doc = await firstStoryWithTemplate(
      story(`{
        args: { label: 'Hi', heading: 'Head' },
        render: ({ label, ...rest }) => html\`<test-element label=\${label} .heading=\${rest.heading}></test-element>\`,
      }`)
    );
    expect(doc.template).toBeUndefined();
  });

  it.each([
    { name: 'passes the args along whole', hole: '\${renderLabel(args)}' },
    { name: 'reads an arg under a computed key', hole: '\${args[key]}' },
    { name: 'binds an arg name again', hole: '\${[1].map((label) => label)}' },
    { name: 'writes a regex literal', hole: "\${label.replace(/'/g, '')} \${label}" },
    { name: 'writes an arg path in a string', hole: "\${label + ' (args.count)'}" },
  ])('leaves the static snippet for a render that $name', async ({ hole }) => {
    const doc = await firstStoryWithTemplate(
      story(`{
        args: { label: 'Hi' },
        render: ({ label }) => html\`<test-element label=\${label}>${hole}</test-element>\`,
      }`)
    );
    expect(doc.template).toBeUndefined();
  });

  it('leaves out the template of a render that reads no args', async () => {
    const doc = await firstStoryWithTemplate(
      story(`{ render: () => html\`<test-element label="static"></test-element>\` }`)
    );
    expect(doc.template).toBeUndefined();
  });
});

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
    host.addEventListener('shape-change', event => event.preventDefault());
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
    host.addEventListener('shape-change', event => first(event));
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
