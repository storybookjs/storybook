import type { IndexEntry } from 'storybook/internal/types';

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { writtenArg } from 'storybook/internal/docs-tools';

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
  it('is the element with each arg bound as Storybook sets it for a story without a render', async () => {
    const written = (await template(`{ args: { label: 'Hi', isOpen: true } }`))!;
    expect(written).toMatchInlineSnapshot(
      `"⟦style test-element ::part(panel)=panel-part :state(active)=active-state⟧<test-element⟦css --accent=--accent⟧ ⟦prop label label ?⟧ ⟦prop isOpen isOpen ?⟧ ⟦prop items items ?⟧ ⟦prop count count ?⟧ ⟦prop disabled disabled ?⟧ ⟦prop active active ?⟧ ⟦attr is-open is-open⟧ ⟦attr variant variant⟧ ⟦prop heading heading ?⟧>⟦slot default default-slot⟧⟦slot actions actions-slot⟧</test-element>"`
    );
    expect(
      fillTemplate(written, {
        label: 'Bye',
        'is-open': true,
        items: [1],
        '--accent': 'red',
      })
    ).toBe(
      '<test-element style="--accent: red;" .label=${"Bye"} .items=${[1]} is-open></test-element>'
    );
  });

  it('writes a listener the story writes as a lit listener', async () => {
    const { snippet } = await firstStoryWithTemplate(
      story(`{ args: { 'shape-change-event': (event) => event.preventDefault() } }`)
    );
    expect(snippet).toBe(
      '<test-element @shape-change=${(event) => event.preventDefault()}></test-element>'
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

  it('is the html of a render function as written, with a hole for each arg it reads', async () => {
    const written = await template(`{
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
    }`);
    expect(written).toMatchInlineSnapshot(`
      "<test-element
        label="⟦quoted label⟧"
        ⟦bool disabled disabled⟧
        ⟦prop heading heading⟧
        @shape-change=\${() => console.log(label)}
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
        @shape-change=\${() => console.log(label)}
      >
        <span>a &lt; b \\u2014 \${[1].map((item) => html\`<i>\${item}</i>\`)}</span>
      </test-element>"
    `);
  });

  it('emits the code the story writes each arg with that a hole prints as code', async () => {
    const { template, argCode } = await firstStoryWithTemplate(
      story(`{
        args: { label: 'Hi', count: 2, items: [new Date(0)], heading: shout, onShapeChange: () => {} },
        render: ({ label, count, items, heading }) =>
          html\`<test-element label=\${label} .count=\${count} .items=\${items}>\${heading}</test-element>\`,
      }`)
    );
    expect(argCode).toEqual({
      items: '[new Date(0)]',
      heading: 'shout',
      onShapeChange: '() => {}',
    });
    expect(
      fillTemplate(template!, { label: 'Bye', count: 3, items: writtenArg(argCode!.items!) })
    ).toBe('<test-element label="Bye" .count=${3} .items=${[new Date(0)]}></test-element>');
  });

  it('keeps the indentation of the lines after the first', async () => {
    const written = await template(`{
      render: (args) => html\`
        <test-element
          label=\${args.label}
          variant="a"></test-element>
      \`,
    }`);
    expect(written).toBe('<test-element\n  label="⟦quoted label⟧"\n  variant="a"></test-element>');
  });

  it.each([
    ['a render that reads no args', '{ render: () => html`<test-element></test-element>` }'],
    ['an arg name bound again', '{ render: ({ a }) => html`${[1].map((a) => a)}` }'],
    [
      'a render that reads the story context',
      '{ render: (args, { id }) => html`<p id=${id}>${args.a}</p>` }',
    ],
  ])('is not there for %s', async (_, body) => {
    expect(await template(body)).toBeUndefined();
  });

  it.each([
    [
      'a string template',
      '(args) => `<test-element label="${args.label}">`',
      '`<test-element label="${⟦value label⟧}">`',
    ],
    [
      'an arg in a shorthand property',
      '({ a }) => html`${JSON.stringify({ a })}`',
      '${JSON.stringify({ a: ⟦value a⟧ })}',
    ],
    [
      'a rest param',
      '({ label, ...rest }) => html`<p>${rest.count} ${label}</p>`',
      '<p>⟦text count⟧ ⟦text label⟧</p>',
    ],
    ['a call of a function with the args', '(args) => Card(args)', 'Card(⟦args⟧)'],
    [
      'a copy of the args with an entry',
      "(args) => Card({ ...args, size: 's' })",
      "Card({ ...⟦args⟧, size: 's' })",
    ],
    ['a spread directive', '(args) => html`<p ${spread(args)}></p>`', '<p ${spread(⟦args⟧)}></p>'],
    [
      'a rest param passed whole',
      '({ label, ...rest }) => html`<p ${spread(rest)}>${label}</p>`',
      '<p ${spread(⟦args -label⟧)}>⟦text label⟧</p>',
    ],
    ['a toolkit template', '(args) => template(args)', 'template(⟦args⟧)'],
    [
      'a default of a parameter',
      "({ size = 'm' }) => html`<p size=${size}></p>`",
      '<p size="⟦quoted size ?%24%7B\'m\'%7D⟧"></p>',
    ],
    [
      'an arg whose name is no hole word',
      "(args) => html`<p>${args['my label']}</p>`",
      '<p>⟦text %my%20label⟧</p>',
    ],
  ])('keeps %s as written', async (_, render, expected) => {
    expect(await template(`{ render: ${render} }`)).toBe(expected);
  });

  it('writes a render with statements as its body, without the constant that takes the args apart', async () => {
    const written = await template(`{
      render: (args) => {
        const { label } = args;
        const upper = label.toUpperCase();
        return html\`<p>\${upper}</p>\`;
      },
    }`);
    expect(written).toBe(
      'const upper = ⟦operand label⟧.toUpperCase();\nreturn html`<p>${upper}</p>`;'
    );
  });

  it('keeps a listener that reads the args as written', async () => {
    expect(
      await template(
        '{ render: (args) => html`<test-element @change=${track(args)} label=${args.label}></test-element>` }'
      )
    ).toBe('<test-element @change=${track(args)} label="⟦quoted label⟧"></test-element>');
  });

  it('reads the html tag of lit-html', async () => {
    const source = `import { html } from 'lit-html';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = { render: (args) => html\`<p>\${args.label}</p>\` };`;
    expect((await firstStoryWithTemplate(source)).template).toBe('<p>⟦text label⟧</p>');
  });

  it('is the code as written for a html tag that is not lit', async () => {
    const source = `import { html } from './own.js';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = { render: (args) => html\`<p>\${args.label}</p>\` };`;
    const { template: written } = await firstStoryWithTemplate(source, {
      files: { 'own.ts': 'export const html = (strings) => strings.join("");' },
    });
    expect(written).toBe('html`<p>${⟦value label⟧}</p>`');
  });
});

describe('buildStoryDocsPayload static snippet from the template', () => {
  it('fills the template with the args the story sets, and does not name what the story file imports', async () => {
    const doc = await firstStoryWithTemplate(
      `import { html } from 'lit';
      import { spread } from '@open-wc/lit-helpers';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        args: { label: 'Hi', disabled: false },
        render: (args) => html\`<test-element \${spread(args)}></test-element>\`,
      };`
    );
    expect(doc).toMatchObject({
      snippet: '<test-element ${spread({ label: "Hi", disabled: false })}></test-element>',
      template: '<test-element ${spread(⟦args⟧)}></test-element>',
    });
    expect(doc.warning).toBeUndefined();
    expect(doc.templateWarning).toBeUndefined();
  });

  it('names what the code of an arg it prints reads, and the args a listener it keeps reads', async () => {
    const doc = await firstStoryWithTemplate(
      `import { html } from 'lit';
      import { fn } from 'storybook/test';
      const ITEMS = ['a'];
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        args: { items: [ITEMS[0], new Date(0)], onClick: fn() },
        render: (args) => html\`<test-element .items=\${args.items} @click=\${args.onClick}></test-element>\`,
      };`
    );
    expect(doc).toMatchObject({
      snippet:
        '<test-element .items=${[ITEMS[0], new Date(0)]} @click=${args.onClick}></test-element>',
      warning: 'Incomplete snippet: names the snippet does not import or declare: `args`, `ITEMS`.',
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

  it('names a module name that a parameter default reads', async () => {
    const doc = await firstStoryWithTemplate(
      `import { html } from 'lit';
      const SIZES = { md: 'medium' };
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        render: ({ heading = SIZES.md }) => html\`<p>\${heading}</p>\`,
      };`
    );
    expect(doc.snippet).toBe('<p>${SIZES.md}</p>');
    expect(doc.templateWarning).toBe(
      'Incomplete snippet: names the snippet does not import or declare: `SIZES`.'
    );
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

  it('keeps the static snippet of next while a spread of args that is not known may set an arg it reads', async () => {
    const doc = await firstStoryWithTemplate(
      `import { html } from 'lit';
      import { baseArgs } from 'some-package';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        args: { ...baseArgs, label: 'Hi' },
        render: (args) => html\`\${args.items.map((item) => html\`<li>\${item}</li>\`)}\`,
      };`
    );
    expect(doc.snippet ?? '').not.toContain('undefined');
    expect(doc.snippet).not.toBe('');
    expect(doc.warning).toContain('`...baseArgs`');
  });

  it('passes the args it can read whole, and names the spread it cannot read', async () => {
    const doc = await firstStoryWithTemplate(
      `import { html } from 'lit';
      import { baseArgs } from 'some-package';
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = {
        args: { ...baseArgs, label: 'Hi' },
        render: (args) => html\`<p \${spread(args)}></p>\`,
      };`
    );
    expect(doc.snippet).toBe('<p ${spread({ label: "Hi" })}></p>');
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

  it('is the render alone for a story without meta.component', async () => {
    const doc = await firstStoryWithTemplate(`
      import { html } from 'lit';
      export default { title: 'Example/TestElement' };
      export const Primary = { args: { label: 'Hi' }, render: (args) => html\`<p>\${args.label}</p>\` };
    `);
    expect(doc).toMatchObject({ snippet: '<p>Hi</p>', template: '<p>⟦text label⟧</p>' });
    expect(doc.warning).toBeUndefined();
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
        snippet: '<test-element .label=${"Meta"} .count=${2} .disabled=${true}></test-element>',
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
        snippet: `const heading = "Head";
const tag = html\`<b>Aliased</b>\`;
return html\`<test-element label="Aliased" count="7" .heading=\${heading}>\${tag}</test-element>\`;`,
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
      name: 'template expression the template fills with the static args',
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
        snippet: '<test-element class=${classMap({ active: Boolean(true) })}></test-element>',
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
        snippet: '<test-element @shape-change=${(event) => event.preventDefault()}></test-element>',
      },
    },
    {
      name: 'args on-convention function, which Storybook sets as a property',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: { onShapeChange: () => {} },
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: '<test-element .onShapeChange=${() => {}}></test-element>',
      },
    },
    {
      name: 'args event listener and on-convention function',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: { 'shape-change-event': (event) => first(event), onShapeChange: (event) => second(event) },
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet:
          '<test-element @shape-change=${(event) => first(event)} .onShapeChange=${(event) => second(event)}></test-element>',
      },
    },
    {
      name: 'args function without matching event, which Storybook sets as a property',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: { onUnknown: () => {} },
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: '<test-element .onUnknown=${() => {}}></test-element>',
      },
    },
    {
      name: 'function arg in non-event argTypes row, which Storybook sets as a property',
      source: `
        export default { title: 'Example/TestElement', component: 'test-element' };
        export const Primary = {
          args: { label: () => 'x' },
        };
      `,
      expected: {
        id: 'example-testelement--primary',
        name: 'Primary',
        snippet: "<test-element .label=${() => 'x'}></test-element>",
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
        snippet: '<test-element .label=${"Meta"}></test-element>',
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
      snippet: '<test-element .label=${"Shared"} .count=${2}></test-element>',
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
      snippet: '<test-element .label=${"Meta"} .items=${itemsFixture}></test-element>',
      warning: 'Incomplete snippet: names the snippet does not import or declare: `itemsFixture`.',
      templateWarning:
        'Incomplete snippet: names the snippet does not import or declare: `itemsFixture`.',
    });
  });

  it('sets an imported attribute identifier as written, and names it', async () => {
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
      snippet: '<test-element .label=${importedLabel}></test-element>',
      warning: 'Incomplete snippet: names the snippet does not import or declare: `importedLabel`.',
      templateWarning:
        'Incomplete snippet: names the snippet does not import or declare: `importedLabel`.',
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

  it('fills the render of a story without meta.component', async () => {
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
      snippet: '`<p>${"Page"}</p>`',
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
      expected: '<test-element .isOpen=${true}></test-element>',
    },
    {
      name: 'attribute false then property true',
      args: `{ 'is-open': false, isOpen: true }`,
      expected: '<test-element .isOpen=${true}></test-element>',
    },
    {
      name: 'property true then attribute string',
      args: `{ isOpen: true, 'is-open': 'later' }`,
      expected: '<test-element .isOpen=${true} is-open="later"></test-element>',
    },
    {
      name: 'attribute string then property false',
      args: `{ 'is-open': 'earlier', isOpen: false }`,
      expected: '<test-element is-open="earlier" .isOpen=${false}></test-element>',
    },
  ])(
    'sets the field and the attribute in the order the story writes them: $name',
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
      name: 'field-backed empty string',
      args: `{ label: '' }`,
      expected: '<test-element .label=${""}></test-element>',
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
        snippet: '<test-element .active=${false}></test-element>',
        warning: undefined,
      },
    },
    {
      name: 'no true default',
      args: `{ disabled: false }`,
      expected: {
        snippet: '<test-element .disabled=${false}></test-element>',
        warning: undefined,
      },
    },
  ])(
    'sets a false field as a property, as Storybook renders it: $name',
    async ({ args, expected }) => {
      const story = await firstStory(`
      export default { title: 'Example/TestElement', component: 'test-element' };
      export const Primary = { args: ${args} };
    `);

      expect({ snippet: story.snippet, warning: story.warning }).toEqual(expected);
    }
  );
});
