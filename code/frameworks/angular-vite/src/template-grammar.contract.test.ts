import { describe, expect, it } from 'vitest';

import { DomElementSchemaRegistry, HtmlParser } from '@angular/compiler';

import { buildComponentOutletTemplate, buildTemplate } from './template-grammar.ts';

interface ParsedRoot {
  errors: string[];
  tag: string | undefined;
  attributes: string[];
}

// Angular's parser accepts both an empty string and an unclosed tag without complaint, so an
// error-free parse on its own would also pass for a generator that emitted nothing. Reading the
// root's name and attribute names back out is what makes this an oracle rather than a smoke test.
const parseRoot = (template: string): ParsedRoot => {
  const { rootNodes, errors } = new HtmlParser().parse(template, 'contract.html');
  const root = rootNodes[0] as { name?: string; attrs?: { name: string }[] } | undefined;
  return {
    errors: errors.map((error) => error.msg),
    tag: root?.name,
    attributes: (root?.attrs ?? []).map((attribute) => attribute.name),
  };
};

const short = { inputs: [{ name: 'label', expression: "'Save'" }], outputs: ['clicked'] };
const long = {
  inputs: [{ name: 'label', expression: "'a label long enough to push the tag past the limit'" }],
  outputs: ['clicked'],
};

const generated: [string, string, string, string[]][] = [
  [
    'dashed selector',
    buildTemplate('sb-button', { ...short, selfClosing: true }),
    'sb-button',
    ['[label]', '(clicked)'],
  ],
  [
    'dashed selector broken over lines',
    buildTemplate('sb-button', { ...long, selfClosing: true }),
    'sb-button',
    ['[label]', '(clicked)'],
  ],
  [
    'dashed selector with inner content',
    buildTemplate('sb-button', { ...short, innerTemplate: 'hi', selfClosing: true }),
    'sb-button',
    ['[label]', '(clicked)'],
  ],
  [
    'element selector',
    buildTemplate('button[sb-button]', { ...short, selfClosing: true }),
    'button',
    ['sb-button', '[label]', '(clicked)'],
  ],
  [
    'selector naming no element',
    buildTemplate('.card', { ...short, selfClosing: true }),
    'div',
    ['class', '[label]', '(clicked)'],
  ],
  [
    'void selector',
    buildTemplate('input[appInput]', { ...short, selfClosing: true }),
    'input',
    ['appInput', '[label]', '(clicked)'],
  ],
  [
    'void selector broken over lines',
    buildTemplate('input[appInput]', { ...long, selfClosing: true }),
    'input',
    ['appInput', '[label]', '(clicked)'],
  ],
  [
    'component outlet',
    buildComponentOutletTemplate('ButtonComponent', { selfClosing: true }),
    'ng-container',
    ['*ngComponentOutlet'],
  ],
];

describe('the snippet generator against Angular', () => {
  it.each(generated)(
    'parses the %s form as the element it names',
    (_, template, tag, attributes) => {
      expect(parseRoot(template)).toEqual({ errors: [], tag, attributes });
    }
  );

  it('rejects a self-closed element whose name carries no dash', () => {
    const { errors } = parseRoot('<div class="card" />');

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/self closed/);
  });

  // `buildTemplate` self-closes on the strength of a dash alone. That is safe only while no element
  // Angular knows carries one; were that to change, snippets would turn invalid with nothing else
  // failing first.
  it('holds the assumption the dash predicate rests on', () => {
    const known = new DomElementSchemaRegistry().allKnownElementNames();

    expect(known.filter((name) => name.includes('-'))).toEqual([]);
    expect(known.length).toBeGreaterThan(100);
  });
});
