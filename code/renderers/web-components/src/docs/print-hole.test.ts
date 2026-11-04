import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { UnprintableArgError, fillTemplate } from 'storybook/internal/docs-tools';
import type { IndexEntry } from 'storybook/internal/types';

import type { WebComponentsDocgenPayload } from '../docgen/component-docgen/build-docgen.ts';
import { mapArgTypes } from '../docgen/component-docgen/arg-types/map-arg-types.ts';
import type {
  ManifestClassField,
  ManifestDeclaration,
} from '../docgen/component-docgen/manifest/types.ts';
import { buildStoryDocsPayload } from '../docgen/story-docs/build-story-docs.ts';

import type { HtmlHolePlace, HtmlSnippetTemplate } from '../snippet-holes.ts';
import { childText, slotText } from '../snippet-values.ts';
import { printHole } from './print-hole.ts';

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

  const holePlaces: HtmlHolePlace[] = [
    { kind: 'attr', name: 'label', mode: 'render' },
    { kind: 'attr', name: 'label', mode: 'field' },
    { kind: 'attr', name: 'label', mode: 'bind' },
    { kind: 'attr', name: 'label', mode: 'defined' },
    { kind: 'css', property: '--accent' },
    { kind: 'cssattr', property: '--accent' },
    { kind: 'bool', name: 'disabled' },
    { kind: 'quoted' },
    { kind: 'text', trimStart: true, trimEnd: true },
    { kind: 'html' },
    { kind: 'slot', name: 'actions' },
    { kind: 'rule', selector: 'x-el::part(p)' },
    { kind: 'style', selector: 'x-el::part(p)' },
    { kind: 'guard' },
  ];

  // Each place a story prints an arg in, as the arg `x`, and the values whose static snippet next
  // prints there without laying the value out anew.
  const places: { name: string; story: string; values: (value: unknown) => boolean }[] = [
    { name: 'an attribute', story: '', values: () => true },
    {
      name: 'a css custom property',
      story: '',
      // A custom property a control clears leaves the `style` attribute empty.
      values: (value) => value !== '' && value !== null && value !== undefined,
    },
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
        const filled = fillTemplate(
          seed.template as HtmlSnippetTemplate,
          { initialArgs: { [arg]: 'Seed' }, unmappedArgs: { [arg]: value } },
          printHole
        );
        expect(filled, JSON.stringify(value)).toBe(story.snippet);
      }
    }
  );

  it.each(holePlaces)('cannot print a function or lit value in a hole of %j', (place) => {
    for (const value of unprintable) {
      expect(() => printHole({ place, arg: 'v' }, value)).toThrow(new UnprintableArgError('v'));
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
