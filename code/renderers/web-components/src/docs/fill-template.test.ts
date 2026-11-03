import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';
import type { IndexEntry } from 'storybook/internal/types';

import type { WebComponentsDocgenPayload } from '../docgen/component-docgen/build-docgen.ts';
import { mapArgTypes } from '../docgen/component-docgen/arg-types/map-arg-types.ts';
import type {
  ManifestClassField,
  ManifestDeclaration,
} from '../docgen/component-docgen/manifest/types.ts';
import { buildStoryDocsPayload } from '../docgen/story-docs/build-story-docs.ts';

import { childText, slotText } from '../snippet-values.ts';
import { fillTemplate } from './fill-template.ts';

describe('fillTemplate', () => {
  it('prints an attribute as Storybook sets it, and leaves out one that is unset or false', () => {
    const template =
      '<x-el⟦attr label label ~%20⟧⟦attr open open ~%20⟧⟦attr rows rows ~%20⟧></x-el>';
    expect(fillTemplate(template, { label: 'Go "now"', open: true, rows: [1] })).toBe(
      '<x-el label="Go &quot;now&quot;" open rows="[1]"></x-el>'
    );
    expect(fillTemplate(template, { label: '', open: false })).toBe('<x-el></x-el>');
  });

  it('keeps an empty attribute a field reflects', () => {
    expect(fillTemplate('<x-el⟦attr label label field ~%20⟧></x-el>', { label: '' })).toBe(
      '<x-el label=""></x-el>'
    );
  });

  it('prints a lit attribute binding as the text of its value', () => {
    const template = '<x-el⟦attr label label bind ~%20⟧⟦attr title title defined ~%20⟧></x-el>';
    expect(fillTemplate(template, { label: true, title: 'T' })).toBe(
      '<x-el label="true" title="T"></x-el>'
    );
    expect(fillTemplate(template, {})).toBe('<x-el label=""></x-el>');
  });

  it('prints a boolean binding while its value is truthy', () => {
    expect(fillTemplate('<x-el⟦bool disabled on ~%20⟧></x-el>', { on: 1 })).toBe(
      '<x-el disabled></x-el>'
    );
    expect(fillTemplate('<x-el⟦bool disabled on ~%20⟧></x-el>', { on: 0 })).toBe('<x-el></x-el>');
  });

  it('prints the custom properties of the style attribute', () => {
    const template = '<x-el⟦attr style - css --accent=accent --size=size ~%20⟧></x-el>';
    expect(fillTemplate(template, { accent: 'red', size: '' })).toBe(
      '<x-el style="--accent: red;"></x-el>'
    );
    expect(fillTemplate(template, {})).toBe('<x-el></x-el>');
  });

  it('escapes text and quoted attribute text', () => {
    expect(fillTemplate('<b title="a ⟦quoted t⟧">⟦text t⟧</b>', { t: '<"&>' })).toBe(
      '<b title="a &lt;&quot;&amp;>">&lt;"&amp;&gt;</b>'
    );
    expect(fillTemplate('<b>⟦text items⟧</b>', { items: ['a', null, 'b'] })).toBe('<b>ab</b>');
  });

  it('prints an array in a quoted attribute value as its text, as the static snippet does', () => {
    expect(fillTemplate('<b title="⟦quoted t⟧"></b>', { t: ['a', 'b'] })).toBe(
      '<b title="a,b"></b>'
    );
  });

  it('collapses the whitespace of text, trimmed where the snippet trims it', () => {
    expect(fillTemplate('<x-el>⟦text a ^ $⟧</x-el>', { a: '  spaced   text ' })).toBe(
      '<x-el>spaced text</x-el>'
    );
    expect(fillTemplate('<x-el>Hi ⟦text a $⟧</x-el>', { a: '  spaced   text ' })).toBe(
      '<x-el>Hi  spaced text</x-el>'
    );
  });

  it('prints the html of a string template as it is', () => {
    expect(fillTemplate('<x-el>⟦html a⟧</x-el>', { a: ['<b>', 'x', '</b>'] })).toBe(
      '<x-el><b>x</b></x-el>'
    );
  });

  it('puts named slot html in the slot, on its one element or in a span', () => {
    expect(fillTemplate('<x-el>⟦slot actions a⟧</x-el>', { a: '<button>Go</button>' })).toBe(
      '<x-el><button slot="actions">Go</button></x-el>'
    );
    expect(fillTemplate('<x-el>⟦slot actions a⟧</x-el>', { a: 'Go <b>now</b>' })).toBe(
      '<x-el><span slot="actions">Go <b>now</b></span></x-el>'
    );
    expect(fillTemplate('<x-el>⟦slot header a⟧</x-el>', { a: '<b class="x">Hi</b>' })).toBe(
      '<x-el><b class="x" slot="header">Hi</b></x-el>'
    );
    expect(fillTemplate('<x-el>⟦slot icon a⟧</x-el>', { a: '<img src="a.png">' })).toBe(
      '<x-el><img src="a.png" slot="icon"></x-el>'
    );
    expect(fillTemplate('<x-el>⟦slot box a⟧</x-el>', { a: '<div><div>x</div></div>' })).toBe(
      '<x-el><div slot="box"><div>x</div></div></x-el>'
    );
    expect(fillTemplate('<x-el>⟦slot default a⟧</x-el>', { a: 'Go <b>now</b>' })).toBe(
      '<x-el>Go <b>now</b></x-el>'
    );
    expect(fillTemplate('<x-el>⟦slot actions a⟧</x-el>', { a: '' })).toBe('<x-el></x-el>');
  });

  it('prints the style rules of part and state args, or nothing', () => {
    const template = '⟦style x-el::part(panel)=panel x-el:state(on)=on⟧<x-el></x-el>';
    expect(fillTemplate(template, { panel: 'color: red' })).toBe(
      '<style>\n  x-el::part(panel) { color: red }\n</style>\n<x-el></x-el>'
    );
    expect(fillTemplate(template, {})).toBe('<x-el></x-el>');
  });

  it('cannot print a function or a lit template', () => {
    expect(() => fillTemplate('<b>⟦text t⟧</b>', { t: () => {} })).toThrow(UnprintableArgError);
    expect(() =>
      fillTemplate('<b>⟦text t⟧</b>', { t: { ['_$litType$']: 1, strings: [] } })
    ).toThrow(UnprintableArgError);
  });
});

describe('a changed arg', () => {
  const values: unknown[] = [
    'Go',
    'say "hi" & <wave>',
    "it's",
    '  runs   of\n\twhitespace  ',
    'line\nbreak',
    '{x}',
    '',
    0,
    -1,
    1e3,
    1.5,
    true,
    false,
    null,
    undefined,
    [],
    ['a', null, 'b'],
    [1, [2]],
    {},
    { a: 1, b: 'x"y' },
    '<button>Go</button>',
    '<b>a</b><b>b</b>',
    '<img src="a.png">',
    'text <b>and</b> html',
  ];
  const unprintable: unknown[] = [() => {}, Symbol('s'), { ['_$litType$']: 1, strings: [] }];

  const holes = [
    '⟦attr label v⟧',
    '⟦attr label v field⟧',
    '⟦attr label v bind⟧',
    '⟦attr label v defined⟧',
    '⟦attr style - css --accent=v⟧',
    '⟦bool disabled v⟧',
    '⟦quoted v⟧',
    '⟦text v ^ $⟧',
    '⟦html v⟧',
    '⟦slot actions v⟧',
    '⟦style x-el::part(p)=v⟧',
  ];

  // Each place a story prints an arg in, as the arg `x`, and the values whose static snippet next
  // prints there without laying the value out anew.
  const places: { name: string; story: string; values: (value: unknown) => boolean }[] = [
    { name: 'an attribute', story: '', values: () => true },
    { name: 'a css custom property', story: '', values: () => true },
    {
      name: 'a lit binding',
      story: 'html`<test-element label=${args.x}></test-element>`',
      values: () => true,
    },
    {
      name: 'a lit ifDefined binding',
      story: 'html`<test-element label=${ifDefined(args.x)}></test-element>`',
      values: () => true,
    },
    {
      name: 'a lit boolean binding',
      story: 'html`<test-element ?disabled=${args.x}></test-element>`',
      values: () => true,
    },
    {
      name: 'a quoted lit value',
      story: 'html`<test-element title="a ${args.x}"></test-element>`',
      values: () => true,
    },
    {
      name: 'lit text',
      story: 'html`<test-element>${args.x}</test-element>`',
      values: (value) => childText(value).trim() !== '',
    },
    {
      name: 'a named slot',
      story: '',
      // An empty slot changes the element's layout, which a template keeps from the story's args.
      values: (value) =>
        slotText(value) !== '' &&
        (/^<(\w+)>[^<]*<\/\1>$/.test(slotText(value)) || !/[<\s]/.test(slotText(value))),
    },
  ];
  const argOf: Record<string, string> = {
    'an attribute': 'label',
    'a css custom property': '--accent',
    'a named slot': 'actions-slot',
  };

  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // The static snippet and the template of a story whose own arg is `value`, from the build.
  const build = async (place: (typeof places)[number], value: unknown) => {
    const arg = argOf[place.name] ?? 'x';
    const dir = mkdtempSync(join(tmpdir(), 'wc-fill-'));
    dirs.push(dir);
    const storyPath = join(dir, 'input.stories.ts');
    const literal = value === undefined ? 'undefined' : JSON.stringify(value);
    writeFileSync(
      storyPath,
      [
        "import { html } from 'lit';",
        "import { ifDefined } from 'lit/directives/if-defined.js';",
        "export default { title: 'Example/TestElement', component: 'test-element' };",
        `export const Primary = { args: { ${JSON.stringify(arg)}: ${literal} }${
          place.story ? `, render: (args) => ${place.story}` : ''
        } };`,
      ].join('\n')
    );
    const entry: IndexEntry = {
      id: 'example-testelement--primary',
      name: 'Primary',
      title: 'Example/TestElement',
      type: 'story',
      subtype: 'story',
      importPath: storyPath,
    };
    const payload = await buildStoryDocsPayload(
      { entry },
      { getDocgenPayload: async () => docgen, resolvePath: (path) => path }
    );
    return { arg, story: Object.values(payload!.stories)[0]! };
  };

  // A template is laid out for the story's own args; a changed value is printed in that layout.
  it.each(places.map((place) => [place.name, place] as const))(
    'prints a value in %s as the static snippet of a story written with it',
    async (_name, place) => {
      const { story: seed } = await build(place, 'Seed');
      for (const value of values.filter(place.values)) {
        const { arg, story } = await build(place, value);
        expect(fillTemplate(seed.template!, { [arg]: value }), JSON.stringify(value)).toBe(
          story.snippet
        );
      }
    }
  );

  it.each(holes)('cannot print a function or lit value in %s', (hole) => {
    for (const value of unprintable) {
      expect(() => fillTemplate(hole, { v: value })).toThrow(new UnprintableArgError('v'));
    }
  });
});

const declaration = {
  kind: 'class',
  name: 'TestElement',
  customElement: true,
  tagName: 'test-element',
  attributes: [{ name: 'label', fieldName: 'label' }],
  members: [
    { kind: 'field', name: 'label', attribute: 'label' } as ManifestClassField & {
      attribute: string;
    },
  ],
  slots: [{ name: '' }, { name: 'actions' }],
  cssProperties: [{ name: '--accent' }],
} satisfies ManifestDeclaration;

const docgen: WebComponentsDocgenPayload = {
  id: 'example-testelement',
  name: 'test-element',
  path: 'input.stories.ts',
  argTypes: mapArgTypes(declaration),
  jsDocTags: {},
  customElementsManifest: { manifestPath: 'custom-elements.json', declaration },
};
