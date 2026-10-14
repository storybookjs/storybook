import type { IndexEntry } from 'storybook/internal/types';

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

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

const story = (body: string) => `
  import { html } from 'lit';
  export default { title: 'Example/TestElement', component: 'test-element' };
  export const Primary = ${body};
`;

const template = async (body: string) => (await firstStoryWithTemplate(story(body))).template;

const templateOf = async (stories: string, files: Record<string, string> = {}) => {
  const source = `
    import { html, nothing } from 'lit';
    export default { title: 'Example/TestElement', component: 'test-element' };
    ${stories}`;
  return (await firstStoryWithTemplate(source, { files })).template;
};

describe('buildStoryDocsPayload template', () => {
  it('is the element with a props hole for a story without a render function', async () => {
    const written = (await template(`{ args: { label: 'Hi', isOpen: true } }`))!;
    expect(written).toMatchInlineSnapshot(
      `"<test-element ⟦props label=label is-open=isOpen --accent=--accent .items=items count=count disabled=disabled active=active variant=variant heading=heading⟧></test-element>"`
    );
    expect(
      fillTemplate(written, { label: 'Bye', isOpen: true, items: [1], '--accent': 'red' })
    ).toBe(
      '<test-element label="Bye" is-open .items=${[1]} style="--accent: red;"></test-element>'
    );
  });

  it('keeps the listener script of the static snippet', async () => {
    expect(await template(`{ args: { label: 'Hi', onShapeChange: () => {} } }`))
      .toMatchInlineSnapshot(`
        "<test-element ⟦props label=label --accent=--accent is-open=isOpen .items=items count=count disabled=disabled active=active variant=variant heading=heading⟧></test-element>
        <script>
          {
            const host = document.currentScript.previousElementSibling;
            host.addEventListener('shape-change', () => {});
          }
        </script>"
      `);
  });

  it('is the html of a render function as written, with a hole for each arg it reads', async () => {
    const written = await template(`{
      render: ({ label, disabled, heading: title, items }) => {
        const heading = title;
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
    }`);
    expect(written).toMatchInlineSnapshot(`
      "<test-element
        ⟦attr label label⟧
        ⟦bool disabled disabled⟧
        ⟦prop heading heading⟧
      >
        <span>⟦text label⟧ \\u2014 \${⟦operand items⟧.map((item) => html\`<i>\${item}</i>\`)}</span>
      </test-element>"
    `);
    expect(fillTemplate(written!, { label: 'a < b', disabled: true, heading: 'H', items: [1] }))
      .toMatchInlineSnapshot(`
        "<test-element
          label="a &lt; b"
          disabled
          .heading=\${"H"}
        >
          <span>a &lt; b \\u2014 \${[1].map((item) => html\`<i>\${item}</i>\`)}</span>
        </test-element>"
      `);
  });

  it('keeps the indentation of the lines after the first', async () => {
    const written = await template(`{
      render: (args) => html\`
        <test-element
          label=\${args.label}
          variant="a"></test-element>
      \`,
    }`);
    expect(written).toBe('<test-element\n  ⟦attr label label⟧\n  variant="a"></test-element>');
  });

  it.each([
    ['slot content', `{ args: { 'default-slot': 'Body' } }`],
    ['a css part', `{ args: { 'panel-part': 'color: red;' } }`],
    ['a string template', '{ render: (args) => `<test-element label="${args.label}">` }'],
    ['a render that reads no args', '{ render: () => html`<test-element></test-element>` }'],
    ['args passed along whole', '{ render: (args) => html`<p>${String(args)}</p>` }'],
    ['an arg name bound again', '{ render: ({ a }) => html`${[1].map((a) => a)}` }'],
    ['an arg in a shorthand property', '{ render: ({ a }) => html`${JSON.stringify({ a })}` }'],
  ])('is not there for %s', async (_, body) => {
    expect(await template(body)).toBeUndefined();
  });

  it('reads the args a rest param holds, without the ones named before it', async () => {
    expect(
      await template('{ render: ({ label, ...rest }) => html`<p>${rest.count} ${rest.label}</p>` }')
    ).toBe('<p>⟦text count⟧ </p>');
  });

  it('writes a constant of the render body where it is read', async () => {
    const written = await template(`{
      render: (args) => {
        const title = args.label.toUpperCase();
        const icon = html\`<i>\${args.count}</i>\`;
        const size = 2;
        return html\`<test-element label=\${title} count=\${size}>\${icon}</test-element>\`;
      },
    }`);
    expect(written).toBe(
      '<test-element label=${⟦operand label⟧.toUpperCase()} count="2"><i>⟦text count⟧</i></test-element>'
    );
  });

  it('reads a function the render calls for its html as if written in place', async () => {
    const written = await templateOf(`
      const Card = (props) => html\`<test-element label=\${props.label}></test-element>\`;
      export const Primary = { render: (args) => Card(args) };
    `);
    expect(written).toBe('<test-element ⟦attr label label⟧></test-element>');
  });

  it('binds the parameters of a function to what the call passes, with their defaults', async () => {
    const written = (await templateOf(`
      const Card = ({ label = 'Place Dog', count = 1, heading = fallbackHeading, disabled = true }) => html\`
        <test-element label=\${label} count=\${count} ?disabled=\${disabled}>
          \${heading} \${count > 1 ? 'many' : 'one'}
        </test-element>
      \`;
      export const Primary = (args) => Card({ ...args, count: 5 });
    `))!;
    expect(written).toMatchInlineSnapshot(`
      "<test-element ⟦attr label label ?label%3D%22Place%20Dog%22⟧ count="5" ⟦bool disabled disabled ?disabled⟧>
        ⟦text heading ?%24%7BfallbackHeading%7D⟧ \${5 > 1 ? 'many' : 'one'}
      </test-element>"
    `);
    expect(fillTemplate(written, {})).toMatchInlineSnapshot(`
      "<test-element label="Place Dog" count="5" disabled>
        \${fallbackHeading} \${5 > 1 ? 'many' : 'one'}
      </test-element>"
    `);
    expect(fillTemplate(written, { label: 'Hi', heading: 'H', disabled: false }))
      .toMatchInlineSnapshot(`
        "<test-element label="Hi" count="5">
          H \${5 > 1 ? 'many' : 'one'}
        </test-element>"
      `);
  });

  it('reads a function another file exports, and one the html calls with the args', async () => {
    const written = await templateOf(
      `
        import { Item, Row as Line } from './markup.js';
        export const Primary = {
          render: (args) => html\`<ul>\${Item(args)}\${Line({ ...args, label: args.heading }, html\`<b>!</b>\`)}</ul>\`,
        };
      `,
      {
        'markup.ts': `
          import { html } from 'lit';
          export const Item = ({ label }) => html\`<li>\${label}</li>\`;
          function Row(props, content) {
            return html\`<li title=\${props.label}>\${props.count}\${content}</li>\`;
          }
          export { Row };
        `,
      }
    );
    expect(written).toBe(
      '<ul><li>⟦text label⟧</li><li ⟦attr title heading⟧>⟦text count⟧<b>!</b></li></ul>'
    );
  });

  it('keeps a call that reads single args as written, and writes one inside code as html', async () => {
    const written = await templateOf(`
      const Badge = (label) => html\`<b>\${label}</b>\`;
      const Card = (props) => html\`<i>\${props.label}</i>\`;
      export const Primary = {
        render: (args) => html\`\${Badge(args.label)}\${args.active ? Card(args) : nothing}\`,
      };
    `);
    expect(written).toBe(
      '${Badge(⟦value label⟧)}${⟦value active⟧ ? html`<i>⟦text label⟧</i>` : nothing}'
    );
  });

  it('writes what a spread of the args passes to the element as a props hole', async () => {
    const written = (await templateOf(`
      import { spread, spreadProps, spreadEvents } from '@open-wc/lit-helpers';
      const Card = (props) => html\`<test-element \${spreadProps(props)}></test-element>\`;
      export const Primary = {
        render: ({ count, ...rest }) => html\`
          <test-element \${spread(rest)} \${spreadEvents(rest)}></test-element>
          <test-element heading="Fixed" \${spread(rest, ['label', 'variant'])}></test-element>
          \${Card({ ...rest, label: 'Written', heading: rest.variant })}
        \`,
      };
    `))!;
    expect(written).toMatchInlineSnapshot(`
      "<test-element ⟦props --accent=--accent is-open=isOpen .items=items label=label disabled=disabled active=active variant=variant heading=heading⟧></test-element>
      <test-element heading="Fixed" ⟦props --accent=--accent is-open=isOpen .items=items disabled=disabled active=active ^heading⟧></test-element>
      <test-element ⟦props --accent=--accent is-open=isOpen .items=items disabled=disabled active=active variant=variant heading=variant⟧ label="Written"></test-element>"
    `);
    expect(fillTemplate(written, { label: 'Hi', variant: 'a', count: 2 })).toMatchInlineSnapshot(`
      "<test-element label="Hi" variant="a"></test-element>
      <test-element heading="Fixed"></test-element>
      <test-element variant="a" heading="a" label="Written"></test-element>"
    `);
    expect(() => fillTemplate(written, { heading: 'Set' })).toThrow(UnprintableArgError);
  });

  it('leaves out a listener that takes the args whole', async () => {
    expect(
      await template(
        '{ render: (args) => html`<test-element @change=${track(args)} label=${args.label}></test-element>` }'
      )
    ).toBe('<test-element ⟦attr label label⟧></test-element>');
  });

  it.each([
    ['lit/html.js', `import { html } from 'lit/html.js';`, {}],
    [
      'a module that exports lit again',
      `import { html } from './base.js';`,
      { 'base.ts': `export * from './directives.js';\nexport * from 'lit';`, 'directives.ts': '' },
    ],
    [
      'a module that exports the html it imports',
      `import { html } from './base.js';`,
      { 'base.ts': `import { html as h } from 'lit-html';\nexport { h as html };` },
    ],
  ])('reads the html tag of %s', async (_, imports, files) => {
    const source = `${imports}
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = { render: (args) => html\`<p>\${args.label}</p>\` };`;
    expect((await firstStoryWithTemplate(source, { files })).template).toBe('<p>⟦text label⟧</p>');
  });

  it.each([
    [
      'a html tag that is not lit',
      `import { html as own } from './own.js';`,
      'own`<p>${args.label}</p>`',
    ],
    ['a function that branches', '', 'Branch(args)'],
    ['a function that is not in reach', `import { Far } from 'far';`, 'Far(args)'],
    ['args written over an entry', '', 'Card({ label: 1, ...args })'],
    ['a spread on another element', '', 'html`<p ${spread(args)}></p>`'],
    ['a call read twice', '', 'Twice(args, next())'],
    ['code that names what the html binds', '', 'html`${Each(args, (item) => item)}`'],
  ])('is not there for %s', async (_, imports, returned) => {
    const written = await templateOf(
      `${imports}
      const Card = (props) => html\`<p>\${props.label}</p>\`;
      const Branch = (props) => {
        if (props.active) {
          return html\`<b>\${props.label}</b>\`;
        }
        return html\`<i>\${props.label}</i>\`;
      };
      const Twice = (props, id) => html\`<p id=\${id} title=\${id}>\${props.label}</p>\`;
      const Each = (props, render) => html\`\${props.items.map((item) => render)}\`;
      export const Primary = { render: (args) => ${returned} };`,
      { 'own.ts': 'export const html = (strings) => strings.join("");' }
    );
    expect(written).toBeUndefined();
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
