// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import { loadCsf, resolveEffectiveRender } from 'storybook/internal/csf-tools';
import type { Args } from 'storybook/internal/types';

import { LitElement, html, noChange, nothing, render } from 'lit';
import { Directive, type ElementPart, directive } from 'lit/directive.js';
import { choose } from 'lit/directives/choose.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { when } from 'lit/directives/when.js';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import { fillTemplate } from '../../docs/fill-template.ts';
import { litTemplate } from './story-template.ts';

class XCard extends LitElement {
  static override properties = {
    label: {},
    size: {},
    count: { type: Number },
    open: { type: Boolean },
    isOpen: { type: Boolean, attribute: 'is-open' },
    active: { type: Boolean },
    items: { attribute: false },
  };

  declare label?: string;
  declare size?: string;
  declare count?: number;
  declare open: boolean;
  declare isOpen: boolean;
  declare active: boolean;
  declare items?: unknown[];

  constructor() {
    super();
    this.open = false;
    this.isOpen = false;
    this.active = true;
    this.items = [];
  }
}
customElements.define('x-card', XCard);

// `@open-wc/lit-helpers`, which this package does not depend on, as it sets an object on its first
// render: `spreadProps` each key as a property, and `spread` each key as an attribute, a `.key` as a
// property and a `?key` as a boolean attribute; both pass over an `undefined` value.
class SpreadPropsDirective extends Directive {
  render(_data: Record<string, unknown>) {
    return nothing;
  }

  override update({ element }: ElementPart, [data]: [Record<string, unknown>]) {
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        (element as unknown as Record<string, unknown>)[key] = value;
      }
    }
    return noChange;
  }
}

class SpreadDirective extends SpreadPropsDirective {
  override update({ element }: ElementPart, [data]: [Record<string, unknown>]) {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || key.startsWith('@')) {
        continue;
      }
      if (key.startsWith('.')) {
        (element as unknown as Record<string, unknown>)[key.slice(1)] = value;
      } else if (key.startsWith('?')) {
        element.toggleAttribute(key.slice(1), Boolean(value));
      } else if (value !== null) {
        element.setAttribute(key, String(value));
      }
    }
    return noChange;
  }
}

const spread = directive(SpreadDirective);
const spreadProps = directive(SpreadPropsDirective);

// happy-dom leaves `&lt;` and `&#39;` in an attribute value as written, so only text gets a `<`,
// and a single-quoted value no `'`.
const HOSTILE = 'a"b\'c`d${e}&g';
const HOSTILE_TEXT = `${HOSTILE}<f>`;

// `unprintable` are args the template has no snippet for.
const stories: [name: string, source: string, args: Args[], options?: { unprintable?: Args[] }][] =
  [
    [
      'a function called with the args',
      `const Card = (props) => html\`<x-card title=\${props.label} ?open=\${props.open}>\${props.label}</x-card>\`;
     export const Primary = (args) => Card(args);`,
      [{ label: 'Hi' }, { label: 'Bye', open: true }, { label: HOSTILE, open: false }],
    ],
    [
      'parameter defaults and an entry written over the args',
      `const Card = ({ label = 'Place Dog', size = 100, open = true, note = Card.name } = {}) =>
       html\`<x-card title=\${label} size=\${size} ?open=\${open}>\${note}: \${size > 60 ? label : 'small'}</x-card>\`;
     export const Primary = (args) => Card({ ...args, size: 50 });`,
      [
        {},
        { label: 'Hi', open: false, note: 'N', size: 70 },
        { label: HOSTILE, note: HOSTILE_TEXT },
      ],
    ],
    [
      'functions called in the html, with html passed along',
      `const Item = ({ label }, content) => html\`<li>\${label}\${content}</li>\`;
     const Row = (props) => html\`<li title=\${ifDefined(props.label)}>\${props.count}</li>\`;
     export const Primary = (args) => {
       const mark = html\`<b>\${args.count}</b>\`;
       return html\`<ul>\${Item(args, mark)}\${args.open ? Row({ ...args, label: args.title }) : nothing}</ul>\`;
     };`,
      [{}, { label: 'Hi', count: 2, open: true, title: 'T' }, { label: HOSTILE, title: HOSTILE }],
    ],
    [
      'a rest param and a constant of the body',
      `export const Primary = ({ label, ...rest }) => {
       const title = \`\${label}!\`;
       return html\`<p title=\${title} lang=\${rest.lang}>\${label}\${rest.count}</p>\`;
     };`,
      [
        { label: 'Hi', lang: 'en' },
        { lang: 'nl', count: 3 },
        { label: HOSTILE_TEXT, lang: HOSTILE },
      ],
    ],
    [
      'a function that returns from each if',
      `const Card = (props) => {
       if (props.open) {
         return html\`<b title=\${props.label}>open</b>\`;
       } else if (props.size === 'l') {
         return html\`<i>\${props.label}</i>\`;
       }
       return html\`<p>\${props.label}</p>\`;
     };
     export const Primary = (args) => Card(args);`,
      [{ open: true, label: 'Hi' }, { size: 'l', label: HOSTILE_TEXT }, { size: 'm' }, {}],
    ],
    [
      'an if that an arg the story leaves unset decides',
      `const Card = ({ href, label }) => {
       if (href) {
         return html\`<a href=\${href}>\${label}</a>\`;
       }
       return html\`<button>\${label}</button>\`;
     };
     export const Primary = (args) => Card(args);`,
      [{ label: 'Hi' }, { label: HOSTILE_TEXT }, { href: '/', label: 'Hi' }],
    ],
    [
      'a body that branches, switches, assigns and maps over an arg',
      `export const Primary = (args) => {
       // The icon follows the size.
       let icon = 'dot';
       switch (args.size) {
         case 'l':
           icon = 'star';
           break;
         default:
           icon = args.label ? 'text' : 'dot';
       }
       if (!args.items) {
         return html\`<p class=\${classMap({ big: args.size === 'l' })}>\${icon}</p>\`;
       }
       return html\`
         <ul style=\${styleMap({ color: args.color })} title=\${ifDefined(args.label)}>
           \${repeat(args.items, (item) => item, (item) => html\`<li>\${item}\${icon}</li>\`)}
           \${args.items.map((item) => html\`<i>\${item}</i>\`)}
           \${when(args.open, () => html\`<b>\${args.label}</b>\`, () => nothing)}
           \${choose(args.size, [['l', () => html\`<em>big</em>\`]], () => html\`small\`)}
           \${args.open && html\`<hr />\`}
         </ul>
       \`;
     };`,
      [
        {},
        { size: 'l' },
        { items: ['a', HOSTILE_TEXT], color: 'red', label: HOSTILE, open: true, size: 'l' },
        { items: [], size: 'm', label: 'Hi' },
      ],
    ],
    [
      'a property binding of an arg, set or not',
      `export const Primary = (args) => html\`<x-card .items=\${args.items} .count=\${args.count}>\${args.label}</x-card>\`;`,
      // An unset property arg is set to `undefined`, as the story sets it.
      [{ items: [] }, { items: [1, 'a'], count: 0 }, { items: null, label: HOSTILE_TEXT }],
    ],
    [
      'an arg inside a larger attribute value, quoted or not',
      `export const Primary = (args) =>
       html\`<x-card title="\${args.label}!" size=\${args.size}-x lang='\${args.lang} \${args.size}'></x-card>\`;`,
      [{}, { label: 'Hi', size: 'l', lang: 'en' }, { label: HOSTILE, size: 7, lang: false }],
    ],
    [
      'an arg as the text of a style',
      `export const Primary = (args) => html\`<style>\${args.css}</style><x-card>\${args.label}</x-card>\`;`,
      [{}, { css: 'x-card > b { color: red }', label: 'a < b' }],
    ],
    [
      'a spread of the args',
      `import { spread } from '@open-wc/lit-helpers';
     export const Primary = (args) => html\`<x-card \${spread(args)}></x-card>\`;`,
      [
        { label: 'Hi', open: true },
        { label: HOSTILE, count: 0, active: false, items: [1, 2] },
        { '.items': ['a'], '?open': 1, label: null },
      ],
    ],
    [
      'a spread of the args as properties, with an entry written over them',
      `import { spreadProps } from '@open-wc/lit-helpers';
     export const Primary = (args) => {
       const props = { ...args, size: 'l' };
       return html\`<x-card label="Written" \${spreadProps(props)}></x-card>\`;
     };`,
      [
        { open: true, active: false },
        { items: [1], isOpen: true, size: 's', count: 2, label: 'Set' },
      ],
    ],
    [
      'a helper of the project that takes the args',
      `const renderSlots = (args) => args.label ? html\`<b slot="title">\${args.label}</b>\` : nothing;
     export const Primary = (args) => html\`<x-card \${spread(args)}>\${renderSlots(args)}</x-card>\`;`,
      [{ label: 'Hi', count: 1 }, {}],
      { unprintable: [{ label: () => 'Hi' }] },
    ],
    [
      'a copy of the args with an entry deleted and others assigned',
      `const Card = (props) => html\`<x-card title=\${ifDefined(props.label)} size=\${ifDefined(props.size)} ?open=\${!!props.open}></x-card>\`;
     export const Primary = (args) => {
       const copy = { ...args };
       delete copy.size;
       return Card(Object.assign({}, copy, { label: args.title }));
     };`,
      [{}, { title: 'T', size: 'l', open: 1 }, { title: HOSTILE, open: 0 }],
    ],
  ];

// The elements with their attributes in name order, as lit sets a bound one after the written ones,
// and the properties of an `x-card`, and the text between them as one, as lit renders each binding
// into a text node of its own. A run of whitespace renders as one space, and the snippet indents a
// function body less than the story does.
const outline = (element: Element): string =>
  `<${element.localName} ${[...element.attributes]
    .map(({ name, value }) => `${name}=${JSON.stringify(value)}`)
    .sort()
    .join(' ')}${element instanceof XCard ? ` ${properties(element)}` : ''}>${[
    ...element.childNodes,
  ]
    .filter((child) => child.nodeType !== Node.COMMENT_NODE)
    .map((child) =>
      child instanceof Element
        ? outline(child)
        : JSON.stringify(child.nodeValue!.replace(/\s+/g, ' '))
    )
    .join('')
    .replaceAll('""', '')}`;

const properties = (card: XCard) =>
  JSON.stringify({
    label: card.label,
    size: card.size,
    count: card.count,
    open: card.open,
    isOpen: card.isOpen,
    active: card.active,
    items: card.items,
    style: card.style.cssText,
  });

const rendered = (result: unknown) => {
  const container = document.createElement('div');
  render(result, container);
  return outline(container);
};

describe('litTemplate', () => {
  it.each(stories)('fills to code that renders what %s renders', (_, source, argsList, options) => {
    const code = `import { html, nothing } from 'lit';\nexport default { title: 'T' };\n${source}`;
    const csf = loadCsf(code, { makeTitle: () => 'T' });
    const path = resolveEffectiveRender(csf.parse(), 'Primary');
    const template = path.kind === 'resolved' ? litTemplate(path.path)?.template : undefined;
    expect(template).toBeDefined();

    // A body that does more than return html is the snippet as a function body, and a render that
    // returns no lit template as written the code it returns.
    const body = /^\s*return\b/m.test(template!);
    const returnsCode = !body && !/^(<|\$\{)/.test(template!);
    const scope = {
      html,
      nothing,
      ifDefined,
      classMap,
      styleMap,
      repeat,
      when,
      choose,
      spread,
      spreadProps,
    };
    for (const args of argsList) {
      const filled = fillTemplate(template!, args);
      const snippet = body
        ? `(() => {\n${filled}\n})()`
        : returnsCode
          ? filled
          : `html\`${filled}\``;
      // The filled template names what the story file declares, so it is run in the same scope,
      // but for the args, which it may not read.
      const run = new Function(
        ...Object.keys(scope),
        '__args',
        `${source.replace(/^\s*import .*$/gm, '').replace('export ', '')}\nreturn [Primary(__args), ${snippet}];`
      );
      const [story, written] = run(...Object.values(scope), args);
      expect(rendered(written), filled).toEqual(rendered(story));
    }
    for (const args of options?.unprintable ?? []) {
      expect(() => fillTemplate(template!, args)).toThrow(UnprintableArgError);
    }
  });
});

describe('litTemplate of a story that writes to its args', () => {
  it('has a hole at each read, and leaves each write as written, naming the args it writes to', () => {
    const render = `(args) => {
  args.label = 'X';
  args.count++;
  args.items.push('x');
  return html\`<x-card title=\${args.label} .items=\${args.items}>\${args.count}</x-card>\`;
}`;
    const code = `import { html } from 'lit';\nexport default { title: 'T' };\nexport const Primary = ${render};`;
    const csf = loadCsf(code, { makeTitle: () => 'T' });
    const path = resolveEffectiveRender(csf.parse(), 'Primary');
    const live = path.kind === 'resolved' && litTemplate(path.path);
    expect(live && live.template).toMatchInlineSnapshot(`
      "args.label = 'X';
      args.count++;
      ⟦operand items⟧.push('x');
      return html\`<x-card title="⟦quoted label⟧" ⟦prop items items⟧>⟦text count⟧</x-card>\`;"
    `);
    expect(live && live.free).toEqual(['args']);
    expect(live && fillTemplate(live.template, { label: 'Go', count: 1, items: ['a'] }))
      .toMatchInlineSnapshot(`
        "args.label = 'X';
        args.count++;
        ["a"].push('x');
        return html\`<x-card title="Go" .items=\${["a"]}>1</x-card>\`;"
      `);
  });
});
