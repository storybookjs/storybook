// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import { loadCsf, resolveEffectiveRender } from 'storybook/internal/csf-tools';
import type { Args } from 'storybook/internal/types';

import { html, nothing, render } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

import { fillTemplate } from '../../docs/fill-template.ts';
import { litTemplate } from './story-template.ts';
import { templateModule } from './template-calls.ts';

// happy-dom leaves `&lt;` in an attribute value as written, so only text gets a `<`.
const HOSTILE = 'a"b\'c`d${e}&g';
const HOSTILE_TEXT = `${HOSTILE}<f>`;

const stories: [name: string, source: string, args: Args[]][] = [
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
];

// The elements with their attributes in name order, as lit sets a bound one after the written ones,
// and the text between them as one, as lit renders each binding into a text node of its own.
const outline = (element: Element): string =>
  `<${element.localName} ${[...element.attributes]
    .map(({ name, value }) => `${name}=${JSON.stringify(value)}`)
    .sort()
    .join(' ')}>${[...element.childNodes]
    .filter((child) => child.nodeType !== Node.COMMENT_NODE)
    .map((child) => (child instanceof Element ? outline(child) : JSON.stringify(child.nodeValue)))
    .join('')
    .replaceAll('""', '')}`;

const rendered = (result: unknown) => {
  const container = document.createElement('div');
  render(result, container);
  return outline(container);
};

describe('litTemplate', () => {
  it.each(stories)('fills to code that renders what %s renders', (_, source, argsList) => {
    const code = `import { html, nothing } from 'lit';\nexport default { title: 'T' };\n${source}`;
    const csf = loadCsf(code, { makeTitle: () => 'T' });
    const path = resolveEffectiveRender(csf.parse(), 'Primary');
    const template =
      path.kind === 'resolved'
        ? litTemplate(
            path.path.node,
            templateModule({ program: csf._file.path, filePath: '' }, undefined),
            { tag: 'x-card', words: [] }
          )
        : undefined;
    expect(template).toBeDefined();

    for (const args of argsList) {
      const filled = fillTemplate(template!, args);
      // The filled template names what the story file declares, so it is run in the same scope.
      const run = new Function(
        'html',
        'nothing',
        'ifDefined',
        'args',
        `${source.replace('export ', '')}\nreturn [Primary(args), html\`${filled}\`];`
      );
      const [story, snippet] = run(html, nothing, ifDefined, args);
      expect(rendered(snippet), filled).toEqual(rendered(story));
    }
  });
});
