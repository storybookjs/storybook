import type { IndexEntry } from 'storybook/internal/types';

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

const firstStory = async (...args: Parameters<typeof firstStoryWithTemplate>) => {
  const { template: _template, argCode: _argCode, ...doc } = await firstStoryWithTemplate(...args);
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

const story = (body: string) => `
  import { html } from 'lit';
  export default { title: 'Example/TestElement', component: 'test-element' };
  export const Primary = ${body};
`;

const template = async (body: string) => (await firstStoryWithTemplate(story(body))).template;

describe('buildStoryDocsPayload template', () => {
  it('is the element next prints for a story without a render, with a hole for each arg it prints', async () => {
    const { template: written, snippet } = await firstStoryWithTemplate(
      story(`{ args: { label: 'Hi', isOpen: true, items: [1] } }`)
    );
    expect(written).toMatchInlineSnapshot(
      `"⟦style test-element ::part(panel)=panel-part :state(active)=active-state⟧<test-element ⟦attr label label field⟧ ⟦attr is-open isOpen field⟧ ⟦attr count count field⟧ ⟦attr disabled disabled field⟧ ⟦attr active active field⟧ ⟦attr variant variant⟧ ⟦attr heading heading field⟧ ⟦css --accent=--accent⟧>⟦slot default default-slot⟧⟦slot actions actions-slot⟧</test-element>"`
    );
    expect(snippet).toBe(fillTemplate(written!, { label: 'Hi', isOpen: true, items: [1] }));
    expect(fillTemplate(written!, { label: '', '--accent': 'red', variant: 'a' })).toBe(
      '<test-element label="" variant="a" style="--accent: red;"></test-element>'
    );
  });

  it('writes a listener the story writes as the script next prints after the element', async () => {
    const { template: written } = await firstStoryWithTemplate(
      story(`{ args: { 'shape-change-event': (event) => event.preventDefault() } }`)
    );
    expect(written).toMatchInlineSnapshot(`
      "⟦style test-element ::part(panel)=panel-part :state(active)=active-state⟧<test-element ⟦attr is-open isOpen field⟧ ⟦attr label label field⟧ ⟦attr count count field⟧ ⟦attr disabled disabled field⟧ ⟦attr active active field⟧ ⟦attr variant variant⟧ ⟦attr heading heading field⟧ ⟦css --accent=--accent⟧>⟦slot default default-slot⟧⟦slot actions actions-slot⟧</test-element>
      <script>
        {
          const host = document.currentScript.previousElementSibling;
          host.addEventListener('shape-change', event => event.preventDefault());
        }
      </script>"
    `);
  });

  it('is the element next prints for a render it cannot read, also one that reads the story context', async () => {
    const source = `import { html } from './own.js';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        args: { label: 'Hi' },
        render: (args, context) => {
          const open = context.viewMode !== 'docs';
          return html\`<test-element ?open=\${open} label=\${args.label}></test-element>\`;
        },
      };`;
    const doc = await firstStoryWithTemplate(source, {
      files: { 'own.ts': 'export const html = (strings) => strings.join("");' },
    });
    expect(doc).toMatchObject({ snippet: '<test-element label="Hi"></test-element>' });
    expect(doc.template).toMatchInlineSnapshot(
      `"⟦style test-element ::part(panel)=panel-part :state(active)=active-state⟧<test-element ⟦attr label label field⟧ ⟦attr is-open isOpen field⟧ ⟦attr count count field⟧ ⟦attr disabled disabled field⟧ ⟦attr active active field⟧ ⟦attr variant variant⟧ ⟦attr heading heading field⟧ ⟦css --accent=--accent⟧>⟦slot default default-slot⟧⟦slot actions actions-slot⟧</test-element>"`
    );
  });

  it('writes slot content as html and part and state styles as a style element', async () => {
    const written = (await template(`{ args: { 'default-slot': 'Body' } }`))!;
    expect(
      fillTemplate(written, {
        'default-slot': '<b>Body</b>',
        'actions-slot': 'Go',
        'panel-part': 'color: red;',
        'active-state': 'outline: none;',
      })
    ).toMatchInlineSnapshot(`
      "<style>
        test-element::part(panel) { color: red; }
        test-element:state(active) { outline: none; }
      </style>
      <test-element><b>Body</b><span slot="actions">Go</span></test-element>"
    `);
  });

  it('is the html next prints of a render, with a hole wherever it prints an arg', async () => {
    const { template: written, snippet } = await firstStoryWithTemplate(
      story(`{
        args: { label: 'a < b', disabled: true, heading: 'H', items: [1] },
        render: ({ label, disabled, heading, items }) => {
          return html\`
            <test-element
              label="\${label}"
              ?disabled=\${disabled}
              .heading=\${heading}
              @shape-change=\${() => console.log(label)}
            >
              <span>\${label} \\u2014 \${items.map((item) => html\`<i>\${item}</i>\`)}</span>
            </test-element>
          \`;
        },
      }`)
    );
    expect(written).toMatchInlineSnapshot(`
      "<test-element label="⟦quoted label⟧" ⟦bool disabled disabled⟧ ⟦attr heading heading field⟧>
        <span>⟦text label⟧ \\u2014</span>
      </test-element>
      <script>
        {
          const host = document.currentScript.previousElementSibling;
          host.addEventListener('shape-change', () => console.log(label));
        }
      </script>"
    `);
    expect(snippet).toMatchInlineSnapshot(`
      "<test-element label="a &lt; b" disabled heading="H">
        <span>a &lt; b \\u2014</span>
      </test-element>
      <script>
        {
          const host = document.currentScript.previousElementSibling;
          host.addEventListener('shape-change', () => console.log(label));
        }
      </script>"
    `);
    expect(fillTemplate(written!, { label: 'Hi', disabled: false })).toMatchInlineSnapshot(`
      "<test-element label="Hi">
        <span>Hi \\u2014</span>
      </test-element>
      <script>
        {
          const host = document.currentScript.previousElementSibling;
          host.addEventListener('shape-change', () => console.log(label));
        }
      </script>"
    `);
  });

  it('emits the code the story writes each arg with that a hole prints as code', async () => {
    const { template, argCode, snippet } = await firstStoryWithTemplate(
      story(`{
        args: { label: 'Hi', count: 2, items: [new Date(0)], heading: shout, onShapeChange: () => {} },
        render: ({ label, count, items, heading }) =>
          html\`<test-element label=\${label} .count=\${count}>\${items} \${heading}</test-element>\`,
      }`)
    );
    expect(argCode).toEqual({
      items: '[new Date(0)]',
      heading: 'shout',
      onShapeChange: '() => {}',
    });
    expect(template).toMatchInlineSnapshot(`
      "<test-element label="⟦quoted label⟧" ⟦attr count count field⟧>
        ⟦text items⟧
        ⟦text heading⟧
      </test-element>"
    `);
    expect(snippet).toMatchInlineSnapshot(`
      "<test-element label="Hi" count="2">
        \${[new Date(0)]}
        \${shout}
      </test-element>"
    `);
  });

  it("lays the html out as next does with the story's own args", async () => {
    const written = await template(`{
      args: { label: 'A label long enough that the start tag wraps', variant: 'primary' },
      render: (args) => html\`<div><test-element label=\${args.label} variant=\${args.variant}>\${args.heading}</test-element></div>\`,
    }`);
    expect(written).toMatchInlineSnapshot(`
      "<div>
        <test-element
          label="⟦quoted label⟧"
          variant="⟦quoted variant⟧"
        >⟦text heading⟧</test-element>
      </div>"
    `);
    expect(fillTemplate(written!, { label: 'Hi', variant: 'a', heading: 'Go' }))
      .toMatchInlineSnapshot(`
      "<div>
        <test-element label="Hi" variant="a">Go</test-element>
      </div>"
    `);
  });

  it('is the snippet, without a hole, for a render that reads no args', async () => {
    const doc = await firstStoryWithTemplate(
      story('{ args: { label: "Hi" }, render: () => html`<test-element></test-element>` }')
    );
    expect(doc).toMatchObject({
      snippet: '<test-element></test-element>',
      template: '<test-element></test-element>',
    });
  });

  it.each([
    [
      'a string template, whose arg text is html',
      '(args) => `<test-element label="${args.label}">${args.heading}</test-element>`',
      '<test-element label="⟦quoted label⟧">⟦slot default heading⟧</test-element>',
      '<test-element label="Hi"></test-element>',
    ],
    [
      'an ifDefined attribute',
      '(args) => html`<p title=${ifDefined(args.label)}></p>`',
      '<p ⟦attr title label defined⟧></p>',
      '<p title="Hi"></p>',
    ],
    [
      'a conditional, whose branch the story args choose',
      '(args) => html`<p>${args.open ? html`<b>${args.label}</b>` : nothing}</p>`',
      '<p>\n  <b>⟦text label⟧</b>\n</p>',
      '<p>\n  <b>Hi</b>\n</p>',
    ],
    [
      'an arg read on, which next does not print',
      "(args) => html`<p title=${args.label.toUpperCase()} lang=${args.heading ?? 'en'}></p>`",
      '<p></p>',
      '<p></p>',
    ],
    [
      'an arg whose name is no hole word',
      "(args) => html`<p>${args['my label']}</p>`",
      '<p>⟦text %my%20label⟧</p>',
      '<p></p>',
    ],
  ])('prints %s as next does', async (_, render, written, snippet) => {
    const source = `
      import { html, nothing } from 'lit';
      import { ifDefined } from 'lit/directives/if-defined.js';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = { args: { label: 'Hi', open: true }, render: ${render} };
    `;
    expect(await firstStoryWithTemplate(source)).toMatchObject({ template: written, snippet });
  });

  it.each([
    ['a call of a function with the args', '(args) => Card(args)'],
    ['a copy of the args with an entry', "(args) => Card({ ...args, size: 's' })"],
    ['a toolkit template', '(args) => template(args)'],
    [
      'a render with statements',
      '(args) => { const upper = args.label.toUpperCase(); return html`<p>${upper}</p>`; }',
    ],
  ])('is the element next prints for %s, not the render as written', async (_, render) => {
    const { template: written, snippet } = await firstStoryWithTemplate(
      story(`{ args: { label: 'Hi' }, render: ${render} }`)
    );
    expect(written).toMatch(/^⟦style test-element .*⟧<test-element ⟦attr label label field⟧ /);
    expect(snippet).toBe('<test-element label="Hi"></test-element>');
  });

  it('is not there where next shows no snippet', async () => {
    const doc = await firstStoryWithTemplate(
      story(`{ args: { a: 1 }, render: ({ a }) => html\`\${JSON.stringify({ a })}\` }`)
    );
    expect(doc.snippet).toBeUndefined();
    expect(doc.template).toBeUndefined();
  });

  it('has no hole for args a helper takes whole, which next does not print', async () => {
    const doc = await firstStoryWithTemplate(
      story('{ args: { label: "Hi" }, render: (args) => html`<div>${card(args)}</div>` }')
    );
    expect(doc).toMatchObject({ snippet: '<div></div>', template: '<div></div>' });
  });

  it('writes a listener as next does, also one that reads the args', async () => {
    expect(
      await template(
        '{ render: (args) => html`<test-element @change=${track(args)} label=${args.label}></test-element>` }'
      )
    ).toMatchInlineSnapshot(`
      "<test-element label="⟦quoted label⟧"></test-element>
      <script>
        {
          const host = document.currentScript.previousElementSibling;
          host.addEventListener('change', () => {});
        }
      </script>"
    `);
  });

  it('reads the html tag of lit-html', async () => {
    const source = `import { html } from 'lit-html';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = { render: (args) => html\`<p>\${args.label}</p>\` };`;
    expect((await firstStoryWithTemplate(source)).template).toBe('<p>⟦text label⟧</p>');
  });

  it('is the element next prints for a html tag that is not lit', async () => {
    const source = `import { html } from './own.js';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = { args: { label: 'Hi' }, render: (args) => html\`<p>\${args.label}</p>\` };`;
    const doc = await firstStoryWithTemplate(source, {
      files: { 'own.ts': 'export const html = (strings) => strings.join("");' },
    });
    expect(doc.template).toMatch(/^⟦style test-element .*⟧<test-element ⟦attr label label field⟧ /);
    expect(doc.snippet).toBe('<test-element label="Hi"></test-element>');
  });
});

describe('buildStoryDocsPayload static snippet from the template', () => {
  it('names what the code of an arg it prints reads', async () => {
    const doc = await firstStoryWithTemplate(
      `import { html } from 'lit';
      const ITEMS = ['a'];
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        args: { items: [ITEMS[0], new Date(0)] },
        render: (args) => html\`<test-element>\${args.items}</test-element>\`,
      };`
    );
    expect(doc).toMatchObject({
      snippet: '<test-element>${[ITEMS[0], new Date(0)]}</test-element>',
      warning: 'Incomplete snippet: names the snippet does not import or declare: `ITEMS`.',
    });
  });

  it("does not name lit's own names in the code of an arg", async () => {
    const doc = await firstStoryWithTemplate(
      `import { html } from 'lit';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        args: { icon: html\`<b>Go</b>\` },
        render: (args) => html\`<p>\${args.icon}</p>\`,
      };`
    );
    expect(doc.snippet).toBe('<p>${html`<b>Go</b>`}</p>');
    expect(doc.warning).toBeUndefined();
  });

  it('prints the code of an arg it cannot read, and names what the snippet does not declare', async () => {
    const doc = await firstStoryWithTemplate(
      `import { html } from 'lit';
      import { label } from './label.js';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = { args: { label }, render: (args) => html\`<p>\${args.label}</p>\` };`,
      { files: { 'label.ts': 'export const label = String(Date.now());' } }
    );
    expect(doc.template).toBe('<p>⟦text label⟧</p>');
    expect(doc.snippet).toBe('<p>${label}</p>');
    expect(doc.warning).toBe(
      'Incomplete snippet: names the snippet does not import or declare: `label`.'
    );
  });

  it('fills the template with the args it can read while a spread it cannot read may set an arg it reads', async () => {
    const doc = await firstStoryWithTemplate(
      `import { html } from 'lit';
      import { baseArgs } from 'some-package';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        args: { ...baseArgs, label: 'Hi' },
        render: (args) => html\`<p>\${args.variant} \${args.label}</p>\`,
      };`
    );
    expect(doc.snippet).toBe('<p>\n  Hi\n</p>');
    expect(doc.snippet).toBe(fillTemplate(doc.template!, { label: 'Hi' }));
    expect(doc.warning).toContain('`...baseArgs`');
  });

  it('shows no element the story never renders', async () => {
    const doc = await firstStoryWithTemplate(
      `import { html } from 'lit';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        args: { label: 'Hi', count: 2 },
        render: () => html\`\${['a', 'b'].map((s) => html\`<other-el size=\${s}></other-el>\`)}\`,
      };`
    );
    expect(doc.snippet).toBeUndefined();
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
