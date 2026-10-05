import { describe, expect, it } from 'vitest';

import type { ElementSnippet } from './print-element.ts';
import { printElementSnippet } from './print-element.ts';

interface PrintCase {
  name: string;
  snippet: ElementSnippet;
  assert: (value: string) => void;
}

describe('printElementSnippet', () => {
  it.each<PrintCase>([
    {
      name: 'attributes only',
      snippet: {
        tag: 'demo-card',
        attributes: [{ name: 'label', value: 'Save & <go>' }],
        cssProperties: [],
        slots: [],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`"<demo-card label="Save &amp; &lt;go>"></demo-card>"`),
    },
    {
      name: 'booleans',
      snippet: {
        tag: 'demo-card',
        attributes: [
          { name: 'disabled', value: true },
          { name: 'hidden', value: false },
          { name: 'empty', value: '' },
          { name: 'label', value: '', viaField: true },
        ],
        cssProperties: [],
        slots: [],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`"<demo-card disabled label=""></demo-card>"`),
    },
    {
      name: 'JSON',
      snippet: {
        tag: 'demo-card',
        attributes: [{ name: 'items', value: [{ label: 'A' }] }],
        cssProperties: [],
        slots: [],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(
          `"<demo-card items="[{&quot;label&quot;:&quot;A&quot;}]"></demo-card>"`
        ),
    },
    {
      name: 'css properties',
      snippet: {
        tag: 'demo-card',
        attributes: [{ name: 'label', value: 'Save' }],
        cssProperties: [
          { name: '--accent', value: 'teal' },
          { name: '--empty', value: '' },
          { name: '--gap', value: 2 },
        ],
        slots: [],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(
          `"<demo-card label="Save" style="--accent: teal; --gap: 2;"></demo-card>"`
        ),
    },
    {
      name: 'slots',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        slots: [
          { name: 'default', html: 'Body <b>text</b>' },
          { name: 'actions', html: '<button>Go</button>' },
          { name: 'footer', html: '<b>One</b><i>Two</i>' },
        ],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<demo-card>
            Body <b>text</b>
            <button slot="actions">Go</button>
            <span slot="footer"><b>One</b><i>Two</i></span>
          </demo-card>"
        `),
    },
    {
      name: 'existing slot attribute',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        slots: [{ name: 'actions', html: '<button slot="menu">Go</button>' }],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<demo-card>
            <span slot="actions"><button slot="menu">Go</button></span>
          </demo-card>"
        `),
    },
    {
      name: 'empty slot',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        slots: [
          { name: 'default', html: '' },
          { name: 'actions', html: null },
          { name: 'footer', html: undefined },
        ],
        styleRules: [],
      },
      assert: (value) => expect(value).toMatchInlineSnapshot(`"<demo-card></demo-card>"`),
    },
    {
      name: 'nested same tag slot',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        slots: [{ name: 'actions', html: '<button><button>Inner</button></button>' }],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<demo-card>
            <button slot="actions"><button>Inner</button></button>
          </demo-card>"
        `),
    },
    {
      name: 'two sibling element slot',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        slots: [{ name: 'actions', html: '<b>a</b> and <b>c</b>' }],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<demo-card>
            <span slot="actions"><b>a</b> and <b>c</b></span>
          </demo-card>"
        `),
    },
    {
      name: 'text then element slot',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        slots: [{ name: 'actions', html: 'before <button>Go</button>' }],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<demo-card>
            <span slot="actions">before <button>Go</button></span>
          </demo-card>"
        `),
    },
    {
      name: 'self-closing slot',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        slots: [{ name: 'actions', html: '<button />' }],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<demo-card>
            <span slot="actions"><button /></span>
          </demo-card>"
        `),
    },
    {
      name: 'parts and states',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        slots: [],
        styleRules: [
          { selector: 'demo-card::part(panel)', declarations: 'color: red;' },
          { selector: 'demo-card:state(active)', declarations: 'outline: 1px solid;' },
        ],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<style>
            demo-card::part(panel) { color: red; }
            demo-card:state(active) { outline: 1px solid; }
          </style>
          <demo-card></demo-card>"
        `),
    },
    {
      name: 'everything together',
      snippet: {
        tag: 'demo-card',
        attributes: [{ name: 'label', value: 'Save' }],
        cssProperties: [{ name: '--accent', value: 'teal' }],
        slots: [{ name: 'default', html: 'Body' }],
        styleRules: [{ selector: 'demo-card::part(panel)', declarations: 'color: red;' }],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<style>
            demo-card::part(panel) { color: red; }
          </style>
          <demo-card label="Save" style="--accent: teal;">
            Body
          </demo-card>"
        `),
    },
  ])('$name', ({ snippet, assert }) => {
    assert(printElementSnippet(snippet));
  });
});
