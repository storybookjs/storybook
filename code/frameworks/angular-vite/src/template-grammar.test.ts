import { describe, expect, it } from 'vitest';

import type { BuildTemplateInput } from './template-grammar.ts';
import {
  buildComponentOutletTemplate,
  buildTemplate,
  formatInputValue,
  formatTemplateMarkup,
} from './template-grammar.ts';

describe('formatInputValue', () => {
  it('renders primitives as their literal text and strings single-quoted', () => {
    expect(formatInputValue(7)).toBe('7');
    expect(formatInputValue(true)).toBe('true');
    expect(formatInputValue(null)).toBe('null');
    expect(formatInputValue(undefined)).toBe('undefined');
    expect(formatInputValue('Save')).toBe("'Save'");
  });

  it('renders objects and arrays with unquoted identifier keys and spaced separators', () => {
    expect(formatInputValue({ id: 7, tags: ['a', 'b'], nested: { deep: true } })).toBe(
      "{id: 7, tags: ['a', 'b'], nested: {deep: true}}"
    );
  });

  it('quotes a key that is not an identifier', () => {
    expect(formatInputValue({ 'data-id': 1 })).toBe("{'data-id': 1}");
  });

  it('keeps a comma inside a string value intact', () => {
    expect(formatInputValue({ hello: '1,2' })).toBe("{hello: '1,2'}");
  });

  it('preserves typographic quotes instead of collapsing them into escapes', () => {
    expect(formatInputValue({ text: 'it’s “great”' })).toBe("{text: 'it’s “great”'}");
  });

  it('escapes the quoting it introduces and entity-encodes the attribute delimiter', () => {
    expect(formatInputValue("it's")).toBe("'it\\'s'");
    expect(formatInputValue('say "hi"')).toBe("'say &quot;hi&quot;'");
    expect(formatInputValue({ path: 'a\\b' })).toBe("{path: 'a\\\\b'}");
    expect(formatInputValue('line\nbreak')).toBe("'line\\nbreak'");
  });

  it('caps a circular reference instead of recursing forever', () => {
    const value: Record<string, unknown> = { name: 'loop' };
    value.self = value;
    expect(formatInputValue(value)).toBe("{name: 'loop', self: '[Circular]'}");
  });
});

describe('buildTemplate', () => {
  const LONG_LABEL = {
    name: 'label',
    expression: "'a label long enough to push the tag past the limit'",
  };
  const one: BuildTemplateInput = {
    inputs: [{ name: 'label', expression: "'x'" }],
    outputs: [],
    style: 'snippet',
  };
  const two: BuildTemplateInput = { inputs: [LONG_LABEL], outputs: ['clicked'], style: 'snippet' };
  const three: BuildTemplateInput = {
    inputs: [LONG_LABEL, { name: 'kind', expression: "'primary'" }],
    outputs: ['clicked'],
    style: 'snippet',
  };

  it('keeps the closing tag in the legacy shape', () => {
    expect(buildTemplate('sb-button', { ...one, style: 'legacy' })).toBe(
      `<sb-button [label]="'x'"></sb-button>`
    );
  });

  it('self-closes a dashed element in the snippet shape', () => {
    expect(buildTemplate('sb-button', one)).toBe(`<sb-button [label]="'x'" />`);
  });

  it('breaks a snippet at three bindings, however short they are', () => {
    expect(
      buildTemplate('sb-shape-button', {
        ...three,
        inputs: [
          { name: 'label', expression: "'x'" },
          { name: 'kind', expression: "'primary'" },
        ],
      })
    ).toBe(
      [
        '<sb-shape-button',
        `    [label]="'x'"`,
        `    [kind]="'primary'"`,
        '    (clicked)="clicked($event)"',
        '/>',
      ].join('\n')
    );
  });

  it('keeps a snippet of two bindings inline, however wide they are', () => {
    expect(buildTemplate('sb-shape-button', two)).toBe(
      `<sb-shape-button [label]="'a label long enough to push the tag past the limit'" (clicked)="clicked($event)" />`
    );
  });

  it('breaks the legacy shape on width rather than on binding count', () => {
    expect(buildTemplate('sb-button', { ...two, style: 'legacy' })).toBe(
      [
        '<sb-button',
        `    [label]="'a label long enough to push the tag past the limit'"`,
        '    (clicked)="clicked($event)">',
        '</sb-button>',
      ].join('\n')
    );
    expect(
      buildTemplate('input[appInput]', {
        ...three,
        style: 'legacy',
        inputs: [
          { name: 'label', expression: "'x'" },
          { name: 'kind', expression: "'primary'" },
        ],
      })
    ).toBe(`<input appInput [label]="'x'" [kind]="'primary'" (clicked)="clicked($event)" />`);
  });

  it('keeps the closing tag for a selector naming an element with an attribute', () => {
    expect(buildTemplate('button[sb-button]', one)).toBe(
      `<button sb-button [label]="'x'"></button>`
    );
  });

  it('keeps the closing tag for a selector that names no element', () => {
    expect(buildTemplate('.card', one)).toBe(`<div class="card" [label]="'x'"></div>`);
  });

  it('keeps a void element inline while it carries fewer than three bindings', () => {
    expect(buildTemplate('input[appInput]', one)).toBe(`<input appInput [label]="'x'" />`);
  });

  it('moves the bracket of a broken void element onto its own line only in the snippet shape', () => {
    expect(buildTemplate('input[appInput]', three)).toBe(
      [
        '<input appInput',
        `    [label]="'a label long enough to push the tag past the limit'"`,
        `    [kind]="'primary'"`,
        '    (clicked)="clicked($event)"',
        '/>',
      ].join('\n')
    );
    expect(buildTemplate('input[appInput]', { ...three, style: 'legacy' })).toBe(
      [
        '<input appInput',
        `    [label]="'a label long enough to push the tag past the limit'"`,
        `    [kind]="'primary'"`,
        '    (clicked)="clicked($event)" />',
      ].join('\n')
    );
  });

  it('keeps the closing tag when the element carries inner content', () => {
    expect(buildTemplate('sb-button', { ...one, innerTemplate: 'hi' })).toBe(
      `<sb-button [label]="'x'">hi</sb-button>`
    );
  });
});

describe('buildComponentOutletTemplate', () => {
  it('keeps the closing tag in the legacy shape', () => {
    expect(buildComponentOutletTemplate('ButtonComponent', 'legacy')).toBe(
      '<ng-container *ngComponentOutlet="ButtonComponent"></ng-container>'
    );
  });

  it('self-closes the outlet in the snippet shape', () => {
    expect(buildComponentOutletTemplate('ButtonComponent', 'snippet')).toBe(
      '<ng-container *ngComponentOutlet="ButtonComponent" />'
    );
  });
});

describe('formatTemplateMarkup', () => {
  it('moves nested elements onto their own lines', () => {
    expect(formatTemplateMarkup('<div class="bound"><sb-button></sb-button></div>')).toBe(
      ['<div class="bound">', '    <sb-button></sb-button>', '</div>'].join('\n')
    );
  });

  it('keeps a short element with only text content as written', () => {
    expect(formatTemplateMarkup('<sb-button emphasis>hi</sb-button>')).toBe(
      '<sb-button emphasis>hi</sb-button>'
    );
  });

  it('breaks an over-wide attribute run one per line', () => {
    expect(
      formatTemplateMarkup(
        `<div class="wrap"><sb-button [label]="'Save'" [count]="7" (clicked)="clicked($event)"></sb-button></div>`
      )
    ).toBe(
      [
        '<div class="wrap">',
        '    <sb-button',
        `        [label]="'Save'"`,
        '        [count]="7"',
        '        (clicked)="clicked($event)">',
        '    </sb-button>',
        '</div>',
      ].join('\n')
    );
  });

  it('keeps static attributes as written, and breaks them only on width', () => {
    expect(formatTemplateMarkup('<div class="a" id="b" role="c">text</div>')).toBe(
      '<div class="a" id="b" role="c">text</div>'
    );
    expect(
      formatTemplateMarkup(`<div class="a" id="b" role="c">${'text '.repeat(20).trim()}</div>`)
    ).toBe(
      [
        '<div',
        '    class="a"',
        '    id="b"',
        '    role="c">',
        `    ${'text '.repeat(20).trim()}`,
        '</div>',
      ].join('\n')
    );
  });

  it('keeps short authored markup inline regardless of its binding count', () => {
    const markup = '<pre [a]="a" [b]="b" [c]="c">x</pre>';

    expect(formatTemplateMarkup(markup)).toBe(markup);
  });

  it('breaks authored markup on width', () => {
    const short = `<sb-button [label]="'Save'" [count]="7"></sb-button>`;
    expect(formatTemplateMarkup(short)).toBe(short);
    expect(
      formatTemplateMarkup(`<sb-button [label]="'${'x'.repeat(80)}'" [count]="7"></sb-button>`)
    ).toBe(
      ['<sb-button', `    [label]="'${'x'.repeat(80)}'"`, '    [count]="7">', '</sb-button>'].join(
        '\n'
      )
    );
  });

  it('keeps a self-closing child on its own line', () => {
    expect(formatTemplateMarkup('<div><sb-icon name="x" /></div>')).toBe(
      ['<div>', '    <sb-icon name="x" />', '</div>'].join('\n')
    );
  });

  it('places sibling text and elements on their own lines', () => {
    expect(formatTemplateMarkup('<sb-button [label]="\'Save\'"><span>Bye</span></sb-button>')).toBe(
      [`<sb-button [label]="'Save'">`, '    <span>Bye</span>', '</sb-button>'].join('\n')
    );
  });

  it('returns markup it cannot follow exactly as written', () => {
    expect(formatTemplateMarkup('<div><span></div>')).toBe('<div><span></div>');
    expect(formatTemplateMarkup('plain interpolated {{ text }}')).toBe(
      'plain interpolated {{ text }}'
    );
  });

  it('leaves a generated template alone, so a broken tag ends the same way whoever wrote it', () => {
    const generated = buildTemplate('sb-button', {
      inputs: [
        { name: 'label', expression: "'x'" },
        { name: 'count', expression: '7' },
      ],
      outputs: ['clicked'],
      style: 'snippet',
    });

    expect(generated).toContain('\n/>');
    expect(formatTemplateMarkup(generated)).toBe(generated);
  });
});
