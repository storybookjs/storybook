import { describe, expect, it } from 'vitest';

import type { ElementSnippet } from './print-element.ts';
import { printElementSnippet } from './print-element.ts';

type ElementSnippetFixture = Omit<ElementSnippet, 'listeners'> & {
  listeners?: ListenerFixture[];
};

type ListenerFixture = Omit<ElementSnippet['listeners'][number], 'tag'> & { tag?: string };

interface PrintCase {
  name: string;
  snippet: ElementSnippetFixture;
  assert: (value: string) => void;
}

const withListeners = (snippet: ElementSnippetFixture): ElementSnippet => ({
  ...snippet,
  listeners: (snippet.listeners ?? []).map((listener) => ({
    ...listener,
    tag: listener.tag ?? snippet.tag,
  })),
});

describe('printElementSnippet', () => {
  const printCases: PrintCase[] = [
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
            <span slot="footer">
              <b>One</b>
              <i>Two</i>
            </span>
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
            <span slot="actions">
              <button slot="menu">Go</button>
            </span>
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
            <button slot="actions">
              <button>Inner</button>
            </button>
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
            <span slot="actions">
              <button></button>
            </span>
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
      name: 'root-only listeners',
      snippet: {
        tag: 'demo-card',
        attributes: [{ name: 'label', value: 'Save' }],
        cssProperties: [],
        listeners: [
          { event: 'my-change', handler: '(event) => {}' },
          { event: 'my-close', handler: '() => {}' },
        ],
        slots: [],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<demo-card label="Save"></demo-card>
          <script>
            {
              const host = document.currentScript.previousElementSibling;
              host.addEventListener('my-change', (event) => {});
              host.addEventListener('my-close', () => {});
            }
          </script>"
        `),
    },
    {
      name: 'duplicate listener event',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        listeners: [
          { event: 'my-change', handler: '(event) => first(event)' },
          { event: 'my-change', handler: '(event) => second(event)' },
          { event: 'my-close', handler: '() => {}' },
        ],
        slots: [],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<demo-card></demo-card>
          <script>
            {
              const host = document.currentScript.previousElementSibling;
              host.addEventListener('my-change', (event) => first(event));
              host.addEventListener('my-close', () => {});
            }
          </script>"
        `),
    },
    {
      name: 'nested-only listeners',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        listeners: [{ event: 'click', handler: '() => {}', tag: 'button' }],
        slots: [{ name: 'default', html: '<button>Go</button>' }],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<demo-card>
            <button>Go</button>
          </demo-card>"
        `),
    },
    {
      name: 'mixed listener targets',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        listeners: [
          { event: 'my-change', handler: '() => {}', tag: 'demo-card' },
          { event: 'click', handler: '() => {}', tag: 'button' },
          { event: 'click', handler: '() => second()', tag: 'button' },
        ],
        slots: [{ name: 'default', html: '<button>Go</button>' }],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<demo-card>
            <button>Go</button>
          </demo-card>
          <script>
            {
              const host = document.currentScript.previousElementSibling;
              host.addEventListener('my-change', () => {});
            }
          </script>"
        `),
    },
    {
      name: 'event name containing script close',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        listeners: [{ event: 'before</script>after', handler: '() => {}' }],
        slots: [],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<demo-card></demo-card>
          <script>
            {
              const host = document.currentScript.previousElementSibling;
              host.addEventListener('before\\x3C/script>after', () => {});
            }
          </script>"
        `),
    },
    {
      name: 'handler containing script close',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        listeners: [{ event: 'click', handler: "() => '</script>'" }],
        slots: [],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<demo-card></demo-card>
          <script>
            {
              const host = document.currentScript.previousElementSibling;
              host.addEventListener('click', () => '<\\/script>');
            }
          </script>"
        `),
    },
    {
      name: 'handler containing html comment open',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        listeners: [{ event: 'click', handler: "() => '<!--'" }],
        slots: [],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<demo-card></demo-card>
          <script>
            {
              const host = document.currentScript.previousElementSibling;
              host.addEventListener('click', () => '<\\!--');
            }
          </script>"
        `),
    },
    {
      name: 'handler containing script open',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        listeners: [{ event: 'click', handler: "() => '<!--<script>'" }],
        slots: [],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<demo-card></demo-card>
          <script>
            {
              const host = document.currentScript.previousElementSibling;
              host.addEventListener('click', () => '<\\!--<\\script>');
            }
          </script>"
        `),
    },
    {
      name: 'listener tag with quote',
      snippet: {
        tag: 'demo-card',
        attributes: [],
        cssProperties: [],
        listeners: [{ event: 'click', handler: '() => {}', tag: "x-'button" }],
        slots: [{ name: 'default', html: "<x-'button>Go</x-'button>" }],
        styleRules: [],
      },
      assert: (value) =>
        expect(value).toMatchInlineSnapshot(`
          "<demo-card>
            <x-'button>Go</x-'button>
          </demo-card>"
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
          <demo-card label="Save" style="--accent: teal;">Body</demo-card>"
        `),
    },
  ];

  it.each(printCases)('$name', ({ snippet, assert }) => {
    assert(printElementSnippet(withListeners(snippet)));
  });
});
