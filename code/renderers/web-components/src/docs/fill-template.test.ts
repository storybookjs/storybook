// @vitest-environment happy-dom
import { html, nothing, svg } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { describe, expect, it } from 'vitest';

import { fillTemplate } from './fill-template.ts';
import { spreadHole } from './template-format.ts';

const spread = (bindings: Record<string, string>) => `\${...args/* ${JSON.stringify(bindings)} */}`;

describe('fillTemplate', () => {
  describe('args spread', () => {
    const template = `<my-el ${spread({
      label: 'label',
      count: '=count',
      backgroundColor: '=background-color',
      disabled: '=disabled',
      items: '.items',
      '--accent': '--accent',
    })}></my-el>`;

    it('writes each arg the way the snippet shows it', () => {
      expect(
        fillTemplate(template, {
          label: 'Hi',
          count: 3,
          backgroundColor: 'red',
          disabled: true,
          items: [{ name: 'Alpha' }],
          '--accent': 'teal',
        })
      ).toMatchInlineSnapshot(`
        "<my-el
          label="Hi"
          count="3"
          background-color="red"
          disabled
          .items=\${[{ name: "Alpha" }]}
          style="--accent: teal;"
        ></my-el>"
      `);
    });

    it('keeps short attribute lists on the line', () => {
      expect(fillTemplate(template, { label: 'Hi', disabled: true })).toBe(
        '<my-el label="Hi" disabled></my-el>'
      );
    });

    it('leaves out unset, false and function args, and args it has no binding for', () => {
      expect(
        fillTemplate(template, {
          label: undefined,
          count: null,
          disabled: false,
          items: undefined,
          '--accent': '',
          backgroundColor: () => {},
          onClick: () => {},
          unknown: 'x',
        })
      ).toBe('<my-el></my-el>');
    });

    it('keeps the boolean binding for false on an attribute that defaults to true', () => {
      const open = `<my-el ${spread({ open: '?=open', modal: '?modal' })}></my-el>`;
      expect(fillTemplate(open, { open: false, modal: false })).toBe(
        '<my-el ?open=${false} ?modal=${false}></my-el>'
      );
      expect(fillTemplate(open, { open: true, modal: undefined })).toBe('<my-el open></my-el>');
    });

    it('prints a function set as a property', () => {
      expect(
        fillTemplate(`<my-el ${spread({ format: '.format' })}></my-el>`, { format: () => {} })
      ).toBe('<my-el .format=${format}></my-el>');
    });

    it('reads back an arg whose name closes a comment', () => {
      const bindings = new Map([
        [
          'a*/b',
          { kind: 'attribute', name: 'a', reflected: false, defaultsToTrue: false } as const,
        ],
      ]);
      expect(fillTemplate(`<my-el ${spreadHole(bindings)}></my-el>`, { 'a*/b': 'x' })).toBe(
        '<my-el a="x"></my-el>'
      );
    });

    it('keeps an empty string only for an attribute reflected from a field', () => {
      expect(fillTemplate(template, { label: '', count: '' })).toBe('<my-el count=""></my-el>');
    });

    it('prints a lit template set as a property as code', () => {
      const content = html`<b>${'Bold'}</b>`;
      expect(fillTemplate(`<my-el ${spread({ content: '.content' })}></my-el>`, { content })).toBe(
        '<my-el .content=${html`<b>${"Bold"}</b>`}></my-el>'
      );
      const binding = '<my-el .content=${args.content}></my-el>';
      expect(fillTemplate(binding, { content: html`<x-el .items=${[1]}></x-el>` })).toBe(
        '<my-el .content=${html`<x-el .items=${[1]}></x-el>`}></my-el>'
      );
      expect(fillTemplate(binding, { content: html`<i>\`${'a`${b}'}</i>` })).toBe(
        '<my-el .content=${html`<i>\\`${"a`${b}"}</i>`}></my-el>'
      );
    });

    it('throws for a lit value or DOM node set as an attribute', () => {
      const template = `<my-el ${spread({ label: 'label', '--accent': '--accent' })}></my-el>`;
      expect(() => fillTemplate(template, { label: html`<b>Bold</b>` })).toThrow();
      expect(() => fillTemplate(template, { '--accent': document.createElement('b') })).toThrow();
      expect(() =>
        fillTemplate('<my-el label=${args.label}></my-el>', { label: html`<b>Bold</b>` })
      ).toThrow();
      expect(() =>
        fillTemplate('<my-el .content=${args.content}></my-el>', { content: unsafeHTML('x') })
      ).toThrow();
    });

    it('throws for a set arg that only the static snippet can show', () => {
      const template = `<my-el ${spread({ label: 'label', footer: '' })}></my-el>`;
      expect(fillTemplate(template, { label: 'Hi' })).toBe('<my-el label="Hi"></my-el>');
      expect(fillTemplate(template, { label: 'Hi', footer: '' })).toBe(
        '<my-el label="Hi"></my-el>'
      );
      expect(fillTemplate(template, { label: 'Hi', footer: null })).toBe(
        '<my-el label="Hi"></my-el>'
      );
      expect(() => fillTemplate(template, { label: 'Hi', footer: 'Bye' })).toThrow();
    });

    it('writes objects set as attributes as JSON', () => {
      expect(fillTemplate(template, { label: { a: 1 }, count: [1, 2] })).toBe(
        '<my-el label="{&quot;a&quot;:1}" count="[1,2]"></my-el>'
      );
    });

    it('escapes attribute values', () => {
      expect(fillTemplate(template, { label: 'Say "hi" & <b>\n`${x}`' })).toBe(
        '<my-el label="Say &quot;hi&quot; &amp; &lt;b>\n`${x}`"></my-el>'
      );
    });

    it('prints the attributes in the order of the bindings', () => {
      expect(fillTemplate(template, { disabled: true, label: 'Hi' })).toBe(
        '<my-el label="Hi" disabled></my-el>'
      );
    });

    it('prints an attribute two args set once, with the last value', () => {
      expect(
        fillTemplate(
          `<my-el ${spread({ isOpen: '=is-open', label: 'label', 'is-open': 'is-open' })}></my-el>`,
          {
            isOpen: true,
            label: 'Hi',
            'is-open': false,
          }
        )
      ).toBe('<my-el label="Hi"></my-el>');
    });

    it('indents a long attribute list under a nested element', () => {
      expect(
        fillTemplate(
          `<div>\n  <my-el ${spread({ label: 'label', count: 'count' })}></my-el>\n</div>`,
          {
            label: 'A label that is long enough to wrap the whole start tag',
            count: 12,
          }
        )
      ).toMatchInlineSnapshot(`
        "<div>
          <my-el
            label="A label that is long enough to wrap the whole start tag"
            count="12"
          ></my-el>
        </div>"
      `);
    });

    it('fills a spread written next to other attributes in place', () => {
      const withOthers = `<my-el class="x" ${spread({ heading: '=heading' })} label=\${args.label}></my-el>`;
      expect(fillTemplate(withOthers, { heading: 'Head', label: 'Hi' })).toBe(
        '<my-el class="x" heading="Head" label="Hi"></my-el>'
      );
      expect(fillTemplate(withOthers, { heading: false, label: 'Hi' })).toBe(
        '<my-el class="x" label="Hi"></my-el>'
      );
    });

    it('drops the line of an empty spread in a tag laid out one attribute per line', () => {
      expect(
        fillTemplate(`<my-el\n  class="x"\n  ${spread({ heading: '=heading' })}\n></my-el>`, {})
      ).toBe('<my-el\n  class="x"\n></my-el>');
    });
  });

  describe('attribute bindings', () => {
    it('fills an attribute as lit sets it', () => {
      const template = '<my-el label=${args.label}></my-el>';
      expect(fillTemplate(template, { label: 'a "b" & c' })).toBe(
        '<my-el label="a &quot;b&quot; &amp; c"></my-el>'
      );
      expect(fillTemplate(template, { label: 2 })).toBe('<my-el label="2"></my-el>');
      expect(fillTemplate(template, { label: true })).toBe('<my-el label="true"></my-el>');
      expect(fillTemplate(template, { label: undefined })).toBe('<my-el label=""></my-el>');
      expect(fillTemplate(template, { label: () => {} })).toBe('<my-el></my-el>');
    });

    it('leaves an ifDefined attribute out when the arg is unset', () => {
      const template = '<my-el label=${ifDefined(args.label)} count=${args.count}></my-el>';
      expect(fillTemplate(template, { count: 1 })).toBe('<my-el count="1"></my-el>');
      expect(fillTemplate(template, { label: 'Hi', count: 1 })).toBe(
        '<my-el label="Hi" count="1"></my-el>'
      );
    });

    it('writes a boolean attribute bare when truthy and leaves it out otherwise', () => {
      const template = '<my-el ?disabled=${args.disabled} label="x"></my-el>';
      expect(fillTemplate(template, { disabled: true })).toBe('<my-el disabled label="x"></my-el>');
      expect(fillTemplate(template, { disabled: 0 })).toBe('<my-el label="x"></my-el>');
    });

    it('keeps property and listener bindings with the value printed', () => {
      const template = '<my-el .items=${args.items} @click=${args.onClick}></my-el>';
      expect(fillTemplate(template, { items: ['a', 'b'], onClick: () => {} })).toBe(
        '<my-el .items=${["a", "b"]} @click=${onClick}></my-el>'
      );
      expect(fillTemplate(template, {})).toBe('<my-el></my-el>');
    });

    it('writes values into a quoted attribute', () => {
      const template = '<my-el class="card ${args.tone} ${args.size}"></my-el>';
      expect(fillTemplate(template, { tone: 'warm', size: 'a"b' })).toBe(
        '<my-el class="card warm a&quot;b"></my-el>'
      );
      expect(fillTemplate(template, { tone: 'warm' })).toBe('<my-el class="card warm "></my-el>');
    });

    it('leaves out a quoted attribute a value of nothing is written into, as lit does', () => {
      const template =
        '<my-el class="card ${args.tone ? \'warm\' : nothing} big" label="x"></my-el>';
      expect(fillTemplate(template, { tone: true })).toBe(
        '<my-el class="card warm big" label="x"></my-el>'
      );
      expect(fillTemplate(template, { tone: false })).toBe('<my-el label="x"></my-el>');
      expect(
        fillTemplate('<my-el\n  label="x"\n  title="${args.title} ${args.label}"\n></my-el>', {
          title: nothing,
        })
      ).toBe('<my-el\n  label="x"\n></my-el>');
    });

    it('drops the line of an attribute left out in a tag laid out one attribute per line', () => {
      expect(
        fillTemplate('<my-el\n  ?disabled=${args.disabled}\n  label=${args.label}\n></my-el>', {
          label: 'Hi',
        })
      ).toBe('<my-el\n  label="Hi"\n></my-el>');
    });

    it('fills the args in other expressions and keeps the rest', () => {
      expect(
        fillTemplate(
          '<my-el class=${classMap({ active: Boolean(args.active) })} style=${styleMap({ color: "red" })}></my-el>',
          { active: true }
        )
      ).toBe(
        '<my-el class=${classMap({ active: Boolean(true) })} style=${styleMap({ color: "red" })}></my-el>'
      );
    });

    it('fills the branch a conditional on an arg picks', () => {
      const template =
        '<my-el label=${args.label ? args.label : nothing} ?open=${args.open ? true : false} tone=${args.warm ? \'warm\' : "cold"}></my-el>';
      expect(fillTemplate(template, { label: 'Hi', open: 1, warm: true })).toBe(
        '<my-el label="Hi" open tone="warm"></my-el>'
      );
      expect(fillTemplate(template, { label: '' })).toBe('<my-el tone="cold"></my-el>');
    });
  });

  describe('text', () => {
    it('writes the value as escaped text', () => {
      expect(fillTemplate('<p>${args.label}</p>', { label: 'a < b && c > d' })).toBe(
        '<p>a &lt; b &amp;&amp; c &gt; d</p>'
      );
      expect(fillTemplate('<p>${args.count}</p>', { count: 0 })).toBe('<p>0</p>');
      expect(fillTemplate('<p>${args.items}</p>', { items: ['a', null, 'b'] })).toBe('<p>ab</p>');
    });

    it('writes nothing for an unset or empty value', () => {
      expect(fillTemplate('<p>${args.label}</p>', {})).toBe('<p></p>');
      expect(fillTemplate('<p>${args.label}</p>', { label: '' })).toBe('<p></p>');
    });

    it('drops the line of a value that writes nothing', () => {
      expect(fillTemplate('<div>\n  <b>x</b>\n  ${args.label}\n</div>', {})).toBe(
        '<div>\n  <b>x</b>\n</div>'
      );
    });

    it('writes an html value as it is', () => {
      expect(fillTemplate('<p>${unsafeHTML(args.body)}</p>', { body: '<b>Hi</b>' })).toBe(
        '<p><b>Hi</b></p>'
      );
    });

    it('names a function after its arg', () => {
      expect(fillTemplate('<p>${args.onClick}</p>', { onClick: () => {} })).toBe(
        '<p>${onClick}</p>'
      );
    });

    it('writes the branch a conditional on an arg picks', () => {
      const template =
        '<p>${args.loading ? html`<x-spinner></x-spinner>` : html`<b>${args.label}</b>`}</p>';
      expect(fillTemplate(template, { loading: false, label: 'a < b' })).toBe(
        '<p><b>a &lt; b</b></p>'
      );
      expect(fillTemplate(template, { loading: true })).toBe('<p><x-spinner></x-spinner></p>');
      expect(
        fillTemplate("<p>${args.user.admin ? 'admin' : 'guest'}</p>", { user: { admin: false } })
      ).toBe('<p>guest</p>');
      expect(fillTemplate('<p>${args.a ? args.b ? 1 : 2 : nothing}</p>', { a: 1 })).toBe(
        '<p>2</p>'
      );
    });

    it('keeps a conditional it cannot decide, and code in the branch it picks', () => {
      expect(fillTemplate('<p>${args.label.length ? 1 : 2}</p>', { label: 'Go' })).toBe(
        '<p>${"Go".length ? 1 : 2}</p>'
      );
      expect(
        fillTemplate('<p>${args.show ? args.items.map((item) => item) : nothing}</p>', {
          show: true,
          items: ['a'],
        })
      ).toBe('<p>${["a"].map((item) => item)}</p>');
    });

    it('keeps a map over an arg with the items filled in', () => {
      expect(
        fillTemplate('<ul>${args.items.map((item) => html`<li>${item.name}</li>`)}</ul>', {
          items: [{ name: 'a' }],
        })
      ).toBe('<ul>${[{ name: "a" }].map((item) => html`<li>${item.name}</li>`)}</ul>');
    });

    it('writes a lit template as its html, with its values filled in', () => {
      const template = '<p>${args.label}</p>';
      expect(fillTemplate(template, { label: html`<b>Bold</b>` })).toBe('<p><b>Bold</b></p>');
      expect(
        fillTemplate(template, {
          label: html`<b title=${'a "b"'}>${'a < b'}${html`<i>${1}</i>`}${nothing}</b>`,
        })
      ).toBe('<p><b title="a &quot;b&quot;">a &lt; b<i>1</i></b></p>');
      expect(fillTemplate(template, { label: ['a', html`<i>b</i>`, svg`<circle></circle>`] })).toBe(
        '<p>a<i>b</i><circle></circle></p>'
      );
    });

    it('writes a DOM element as its html', () => {
      const element = document.createElement('b');
      element.textContent = 'Bold';
      expect(fillTemplate('<p>${args.label}</p>', { label: [element] })).toBe('<p><b>Bold</b></p>');
    });

    it('throws for a lit value it cannot write as html', () => {
      expect(() =>
        fillTemplate('<p>${args.label}</p>', { label: unsafeHTML('<b>Bold</b>') })
      ).toThrow();
      expect(() =>
        fillTemplate('<p>${args.label}</p>', { label: html`<b ${unsafeHTML('x')}></b>` })
      ).toThrow();
    });

    it('leaves expressions without args as written', () => {
      const template = "<p>${'}' + `${'{'}`} ${when(x, () => html`<b></b>`)}</p>";
      expect(fillTemplate(template, {})).toBe(template);
    });
  });

  it('reads escaped characters as text', () => {
    expect(fillTemplate('<p>\\${args.label} \\\\ ${args.label}</p>', { label: 'Hi' })).toBe(
      '<p>${args.label} \\ Hi</p>'
    );
  });

  it('does not read a filled value as part of the template', () => {
    expect(
      fillTemplate('<p title=${args.title}>${args.label}</p>', {
        title: '${args.label}',
        label: '${args.title} \\',
      })
    ).toBe('<p title="${args.label}">${args.title} \\</p>');
  });

  it('fills nested elements and the listener script after them', () => {
    const template = [
      '<my-card ${...args/* {"heading":"=heading"} */}>',
      '  <my-button ?primary=${args.primary}>${args.label}</my-button>',
      '</my-card>',
      '<script>',
      "  host.addEventListener('close', () => {});",
      '</script>',
    ].join('\n');
    expect(fillTemplate(template, { heading: 'Card', primary: true, label: 'OK' }))
      .toMatchInlineSnapshot(`
        "<my-card heading="Card">
          <my-button primary>OK</my-button>
        </my-card>
        <script>
          host.addEventListener('close', () => {});
        </script>"
      `);
  });
});
