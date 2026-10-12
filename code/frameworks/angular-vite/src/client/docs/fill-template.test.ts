import { describe, expect, it } from 'vitest';

import {
  type TemplateItem,
  argMarker,
  bindingsMarker,
  elementMarker,
  handlerMarker,
} from '../../snippet-markers.ts';
import { hostTemplateLine, splitHostComponentTemplate } from '../../template-grammar.ts';
import { fillTemplate } from './fill-template.ts';

const host = (template: string, members: string[] = []) =>
  [
    "import { Component } from '@angular/core';",
    "import { ButtonComponent } from './button.component';",
    '',
    '@Component({',
    "  selector: 'app-demo',",
    '  imports: [ButtonComponent],',
    hostTemplateLine(template),
    '})',
    `export class DemoComponent ${members.length === 0 ? '{}' : `{\n${members.join('\n')}\n}`}`,
  ].join('\n');

const input = (name: string): TemplateItem => ({ kind: 'input', name });
const field = (name: string): TemplateItem => ({ kind: 'field', name });
const output = (name: string): TemplateItem => ({ kind: 'output', name });

const button = elementMarker('sb-button', [
  input('label'),
  input('count'),
  input('data'),
  output('pressed'),
]);

const fill = (template: string, args: Record<string, unknown>) =>
  splitHostComponentTemplate(fillTemplate(host(template), args))!.template;

describe('fillTemplate', () => {
  describe('the generated element', () => {
    it('binds the set inputs in marker order and keeps the outputs', () => {
      expect(
        fillTemplate(host(button, ['  pressed(event: unknown) {}']), {
          count: 2,
          label: 'Save',
          pressed: () => {},
        })
      ).toMatchInlineSnapshot(`
        "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button [label]="'Save'" [count]="2" (pressed)="pressed($event)" />\`,
        })
        export class DemoComponent {
          pressed(event: unknown) {}
        }"
      `);
    });

    it('leaves out an unset input and binds null, as the static snippet does', () => {
      expect(fill(button, { label: undefined })).toBe('<sb-button (pressed)="pressed($event)" />');
      expect(fill(button, { label: null })).toBe(
        '<sb-button [label]="null" (pressed)="pressed($event)" />'
      );
    });

    it('throws on a value no Angular expression can write, so the static snippet shows', () => {
      class Point {
        x = 1;
      }
      const cyclic: Record<string, unknown> = {};
      cyclic.self = cyclic;

      for (const label of [() => {}, new Point(), new Date(0), cyclic, [1n], Symbol('s')]) {
        expect(() => fill(button, { label })).toThrow('`label`');
      }
    });

    it('throws on data too long to read inline, as the static snippet names it instead', () => {
      const items = Array.from({ length: 200 }, (_, index) => `item ${index}`);

      expect(() => fill(button, { data: items })).toThrow('`data`');
      expect(fill(button, { label: 'x'.repeat(600) })).toContain(`[label]="'${'x'.repeat(600)}'"`);
    });

    it('binds an input the story keeps in a host field to that field', () => {
      expect(
        fill(elementMarker('sb-button', [input('label'), field('since')]), { label: 'Go' })
      ).toBe(`<sb-button [label]="'Go'" [since]="since" />`);
    });

    it('breaks a long element one binding per line, as the static snippet does', () => {
      expect(
        fill(button, {
          label: 'A label long enough to break the element',
          count: 3,
          data: { id: 7, 'data-id': 1, nested: { deep: true }, skipped: undefined },
        })
      ).toMatchInlineSnapshot(`
        "<sb-button
            [label]="'A label long enough to break the element'"
            [count]="3"
            [data]="{id: 7, 'data-id': 1, nested: {deep: true}}"
            (pressed)="pressed($event)"
        />"
      `);
    });

    it('writes the selector the way the static snippet does', () => {
      expect(fill(elementMarker('button[sbButton], .x', [input('label')]), { label: 'Go' })).toBe(
        `<button sbButton [label]="'Go'"></button>`
      );
    });
  });

  describe('values', () => {
    const label = elementMarker('sb-x', [input('label')]);

    it.each([
      ['a quote of either kind', `It's "here"`, String.raw`'It\'s &quot;here&quot;'`],
      ['a character reference', 'Tom &amp; Jerry', `'Tom &amp;amp; Jerry'`],
      ['markup and a bare ampersand', '<b> & co', `'<b> & co'`],
      ['a newline and a backslash', 'one\ntwo\\', String.raw`'one\ntwo\\'`],
      ['interpolation braces', '{{ x }}', `'{{ x }}'`],
      ['template literal syntax', '`${x}`', "'`${x}`'"],
      ['an array', ['a', 'b', 1, null, undefined], `['a', 'b', 1, null, null]`],
      ['a boolean', false, 'false'],
    ])('prints %s', (_name, value, expression) => {
      expect(fill(label, { label: value })).toBe(`<sb-x [label]="${expression}" />`);
    });

    it('keeps template literal syntax escaped in the host component', () => {
      expect(fillTemplate(host(label), { label: '`${x}`' })).toContain(
        String.raw`template: ${'`'}<sb-x [label]="'\`\${x}\`'" />${'`'},`
      );
    });

    it('fills host fields as TypeScript values', () => {
      const template = host('<p>{{ label }}</p>', [
        `  label = ${argMarker('label')};`,
        `  items = ${argMarker('items')};`,
        `  ['data-id'] = ${argMarker('data-id')};`,
        `  missing = ${argMarker('missing')};`,
      ]);

      expect(
        fillTemplate(template, {
          label: "It's",
          items: [{ id: 1 }],
          'data-id': 3,
        }).split('export class DemoComponent ')[1]
      ).toMatchInlineSnapshot(`
        "{
          label = 'It\\'s';
          items = [{id: 1}];
          ['data-id'] = 3;
          missing = undefined;
        }"
      `);
    });

    it('throws on a host field it could only invent code for', () => {
      const template = host('<p>{{ value }}</p>', [`  value = ${argMarker('value')};`]);

      for (const value of [() => {}, new Date(0), new (class Control {})()]) {
        expect(() => fillTemplate(template, { value })).toThrow('`value`');
      }
    });

    it('never reads a filled-in value as a marker', () => {
      const template = host(button, [`  other = ${argMarker('other')};`]);

      expect(fillTemplate(template, { label: argMarker('other') })).toContain(
        `[label]="'{{@args.other}}'"`
      );
      expect(fillTemplate(template, { other: argMarker('label') })).toContain(
        `other = '{{@args.label}}';`
      );
    });
  });

  describe("a story's own markup", () => {
    it('expands the bindings and lays the markup out like the static snippet', () => {
      const markup = `<div class="wrap"><sb-button ${bindingsMarker([input('label'), input('count'), output('pressed')])}></sb-button></div>`;

      expect(fill(markup, { label: 'Save', count: 7 })).toMatchInlineSnapshot(`
        "<div class="wrap">
            <sb-button [label]="'Save'" [count]="7"></sb-button>
        </div>"
      `);
    });

    it('closes up the tag when no binding is left', () => {
      expect(fill(`<sb-button ${bindingsMarker([input('label')])}></sb-button>`, {})).toBe(
        '<sb-button></sb-button>'
      );
    });

    it('binds an output while its arg holds a function, as argsToTemplate does', () => {
      const markup = `<sb-button ${bindingsMarker([input('label'), output('pressed')])}>`;

      expect(fill(markup, { pressed: () => {} })).toBe('<sb-button (pressed)="pressed($event)">');
      expect(fill(markup, { label: null })).toBe('<sb-button [label]="null">');
    });

    it('declares a handler for each output the bindings bind', () => {
      const template = host(
        `<sb-button ${bindingsMarker([output('pressed'), output('closed')])}>`,
        [
          '  clicked(event: unknown) {}',
          `  ${handlerMarker('pressed')}`,
          `  ${handlerMarker('closed')}`,
        ]
      );

      expect(fillTemplate(template, { pressed: () => {} }).split('export class DemoComponent ')[1])
        .toMatchInlineSnapshot(`
          "{
            clicked(event: unknown) {}
            pressed(event: unknown) {}
          }"
        `);
      expect(
        fillTemplate(host('<p></p>', [`  ${handlerMarker('pressed')}`]), {}).split(
          'export class DemoComponent '
        )[1]
      ).toBe('{}');
    });

    it('puts an interpolated arg in as text and leaves Angular syntax alone', () => {
      const markup = [
        `<sb-button ${bindingsMarker([input('label')])}>`,
        `@if (disabled) {<span>{{ label }}</span>}`,
        `@for (item of items; track item) {<i>{{ item }}</i>}`,
        `${argMarker('footer')}</sb-button>`,
      ].join('');

      expect(fill(markup, { label: 'Hi', footer: 'Bye' })).toMatchInlineSnapshot(`
        "<sb-button [label]="'Hi'">
            @if (disabled) {
            <span>{{ label }}</span>
            }@for (item of items; track item) {
            <i>{{ item }}</i>
            }Bye
        </sb-button>"
      `);
    });

    it('puts text in as the story renders it, markup included', () => {
      expect(fill(`<p>${argMarker('footer')}</p>`, { footer: 'Tom & <b>Jerry</b>' }))
        .toMatchInlineSnapshot(`
          "<p>
              Tom &
              <b>Jerry</b>
          </p>"
        `);
    });
  });
});
