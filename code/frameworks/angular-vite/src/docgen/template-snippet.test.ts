import type { types as t } from 'storybook/internal/babel';
import { babelParse } from 'storybook/internal/babel';

import { describe, expect, it } from 'vitest';

import type { AngularComponentTemplate } from './template-snippet.ts';
import { generateAngularSnippet, parseSelector, templateExpression } from './template-snippet.ts';

/** Parses one expression the way an arg value arrives from a story file. */
const expression = (source: string): t.Node => {
  const program = babelParse(`const value = ${source};`);
  const declaration = program.program.body[0] as t.VariableDeclaration;
  return declaration.declarations[0].init as t.Node;
};

const component = (
  overrides: Partial<AngularComponentTemplate> = {}
): AngularComponentTemplate => ({
  name: 'ButtonComponent',
  selector: 'sb-button',
  inputs: ['label', 'count'],
  outputs: ['clicked'],
  ...overrides,
});

const snippet = (
  args: Record<string, string>,
  overrides?: Partial<AngularComponentTemplate>,
  unresolvedArgs?: string[]
) =>
  generateAngularSnippet({
    component: component(overrides),
    args: Object.fromEntries(Object.entries(args).map(([key, src]) => [key, expression(src)])),
    unresolvedArgs,
  });

describe('parseSelector', () => {
  it.each([
    ['sb-button', '<sb-button></sb-button>'],
    // Compound selector: the directive belongs on its host element, not on an invented one.
    ['button[sb-harness-action], a[sb-harness-action]', '<button sb-harness-action></button>'],
    ['[myDirective]', '<div myDirective></div>'],
    ['.my-class', '<div class="my-class"></div>'],
    ['sb-button.a.b', '<sb-button class="a b"></sb-button>'],
    ['sb-button#main', '<sb-button id="main"></sb-button>'],
    // Void elements cannot carry a closing tag.
    ['input[myDir]', '<input myDir />'],
    // A comma inside an attribute value does not start a second selector.
    ['sb-button[data-tags="a,b"]', '<sb-button data-tags="a,b"></sb-button>'],
    // A pseudo-selector narrows when a directive applies; it is not part of the host element.
    ['sb-button:not([disabled])', '<sb-button></sb-button>'],
    ['[myDir]:not(.excluded)', '<div myDir></div>'],
    ['sb-button[type=submit]', '<sb-button type="submit"></sb-button>'],
  ])('%s renders as %s', (selector, expected) => {
    expect(snippet({}, { selector, inputs: [], outputs: [] })).toBe(expected);
  });

  it('reports the host element parts separately', () => {
    expect(parseSelector('a.link.external#home[href="/a,b"]')).toEqual({
      tag: 'a',
      id: 'home',
      classes: ['link', 'external'],
      attributes: ['href="/a,b"'],
    });
  });
});

describe('templateExpression', () => {
  it.each([
    [`'Save'`, `'Save'`],
    ['3', '3'],
    ['true', 'true'],
    ['null', 'null'],
    ['undefined', 'undefined'],
    [`['a', 'b']`, `['a', 'b']`],
    [
      `{ id: 7, tags: ['a', 'b'], nested: { deep: true } }`,
      `{ id: 7, tags: ['a', 'b'], nested: { deep: true } }`,
    ],
    // Functions print literally: Angular template expressions cannot hold one, and the browser
    // generator does the same, so the baselines encode it.
    ['() => {}', '() => {}'],
    ['(value) => value.toFixed(2)', 'value => value.toFixed(2)'],
    // Comments and line breaks would leave the attribute value spanning lines.
    ['{\n  id: 1, // note\n  other: 2\n}', '{ id: 1, other: 2 }'],
    // The value lives inside a double-quoted HTML attribute, so quotes and ampersands must survive
    // as entities or the snippet stops being well-formed markup.
    [`"it's fine"`, `&quot;it's fine&quot;`],
    [`'say "hi"'`, `'say &quot;hi&quot;'`],
    [`'a & b'`, `'a &amp; b'`],
    [`'&quot;'`, `'&amp;quot;'`],
  ])('%s serializes to %s', (source, expected) => {
    expect(templateExpression(expression(source))).toBe(expected);
  });
});

describe('generateAngularSnippet', () => {
  it('emits a property binding per declared arg the component accepts', () => {
    expect(snippet({ label: `'Save'`, count: '3' })).toBe(
      `<sb-button [label]="'Save'" [count]="3" (clicked)="clicked($event)"></sb-button>`
    );
  });

  it('drops args the component declares as neither an input nor an output', () => {
    expect(snippet({ label: `'Save'`, notAnInput: `'x'` })).toBe(
      `<sb-button [label]="'Save'" (clicked)="clicked($event)"></sb-button>`
    );
  });

  it('emits an event binding for every output, declared as an arg or not', () => {
    expect(snippet({})).toBe(`<sb-button (clicked)="clicked($event)"></sb-button>`);
  });

  it('keeps a function passed to an input as a property binding', () => {
    expect(snippet({ label: '() => {}' }, { inputs: ['label'], outputs: [] })).toBe(
      `<sb-button [label]="() => {}"></sb-button>`
    );
  });

  it('emits a model() as separate input and output bindings rather than banana-in-a-box', () => {
    expect(
      snippet(
        { value: `'hello'`, checked: 'true' },
        { inputs: ['value', 'checked'], outputs: ['valueChange', 'checkedChange'] }
      )
    ).toBe(
      `<sb-button [value]="'hello'" [checked]="true" (valueChange)="valueChange($event)" (checkedChange)="checkedChange($event)"></sb-button>`
    );
  });

  it('falls back to ngComponentOutlet when the component has no selector', () => {
    expect(snippet({ label: `'Save'` }, { selector: undefined })).toBe(
      `<ng-container *ngComponentOutlet="ButtonComponent"></ng-container>`
    );
  });

  it('references an output whose name is not an identifier through bracket notation', () => {
    expect(snippet({}, { inputs: [], outputs: ['data-changed'] })).toBe(
      `<sb-button (data-changed)="this['data-changed']($event)"></sb-button>`
    );
  });

  it('reports args it could not resolve instead of dropping them silently', () => {
    expect(snippet({ label: `'Save'` }, undefined, ['...sharedArgs'])).toBe(
      `<!-- unresolved args: ...sharedArgs -->\n<sb-button [label]="'Save'" (clicked)="clicked($event)"></sb-button>`
    );
  });
});
