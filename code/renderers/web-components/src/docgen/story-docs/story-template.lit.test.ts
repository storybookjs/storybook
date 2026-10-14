// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import { loadCsf, resolveEffectiveRender } from 'storybook/internal/csf-tools';
import type { Args } from 'storybook/internal/types';

import { html, nothing, render } from 'lit';
import { choose } from 'lit/directives/choose.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { when } from 'lit/directives/when.js';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import { fillTemplate } from '../../docs/fill-template.ts';
import { litTemplate } from './story-template.ts';
import { templateModule } from './template-calls.ts';

// happy-dom leaves `&lt;` in an attribute value as written, so only text gets a `<`.
const HOSTILE = 'a"b\'c`d${e}&g';
const HOSTILE_TEXT = `${HOSTILE}<f>`;

// `set` names the args the story sets, so a branch an unset one takes is known; `unprintable` are
// args the template has no snippet for.
const stories: [
  name: string,
  source: string,
  args: Args[],
  options?: { set?: string[]; unprintable?: Args[] },
][] = [
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
    [{}, { label: 'Hi', open: false, note: 'N', size: 70 }, { label: HOSTILE, note: HOSTILE_TEXT }],
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
       return html\`<p title=\${title} lang=\${rest.lang}>\${rest.label}\${rest.count}</p>\`;
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
    [{ label: 'Hi' }, { label: HOSTILE_TEXT }],
    { set: ['label'], unprintable: [{ href: '/', label: 'Hi' }] },
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
// and the text between them as one, as lit renders each binding into a text node of its own. A run of
// whitespace renders as one space, and the snippet indents a function body less than the story does.
const outline = (element: Element): string =>
  `<${element.localName} ${[...element.attributes]
    .map(({ name, value }) => `${name}=${JSON.stringify(value)}`)
    .sort()
    .join(' ')}>${[...element.childNodes]
    .filter((child) => child.nodeType !== Node.COMMENT_NODE)
    .map((child) =>
      child instanceof Element
        ? outline(child)
        : JSON.stringify(child.nodeValue!.replace(/\s+/g, ' '))
    )
    .join('')
    .replaceAll('""', '')}`;

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
    const template =
      path.kind === 'resolved'
        ? litTemplate(
            path.path.node,
            templateModule({ program: csf._file.path, filePath: '' }, undefined),
            { tag: 'x-card', words: [], args: options?.set }
          )?.template
        : undefined;
    expect(template).toBeDefined();

    // A body that does more than return html is the snippet as a function body.
    const body = /^\s*return\b/m.test(template!);
    const scope = { html, nothing, ifDefined, classMap, styleMap, repeat, when, choose };
    for (const args of argsList) {
      const filled = fillTemplate(template!, args);
      const snippet = body ? `(() => {\n${filled}\n})()` : `html\`${filled}\``;
      // The filled template names what the story file declares, so it is run in the same scope.
      const run = new Function(
        ...Object.keys(scope),
        'args',
        `${source.replace('export ', '')}\nreturn [Primary(args), ${snippet}];`
      );
      const [story, written] = run(...Object.values(scope), args);
      expect(rendered(written), filled).toEqual(rendered(story));
    }
    for (const args of options?.unprintable ?? []) {
      expect(() => fillTemplate(template!, args)).toThrow(UnprintableArgError);
    }
  });
});
