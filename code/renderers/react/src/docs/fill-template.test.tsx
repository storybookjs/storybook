import { describe, expect, it, vi } from 'vitest';

import React from 'react';

import {
  UnprintableArgError,
  hole,
  holeWord,
  printValue,
  writtenArg,
  writtenCode,
} from 'storybook/internal/docs-tools';

import {
  type JsxValue,
  printArgsObject,
  printAttribute,
  printAttributes,
  printChildren,
  printClose,
  printElement,
} from '../snippet-values.ts';
import { fillTemplate } from './fill-template.ts';

describe('fillTemplate', () => {
  it('prints the component with every arg, its children as content', () => {
    expect(fillTemplate('⟦element Button⟧', { label: 'Go', primary: true, size: 2 })).toBe(
      '<Button label="Go" primary size={2} />'
    );
    expect(fillTemplate('⟦element Button⟧', { children: 'Save', disabled: false })).toBe(
      '<Button disabled={false}>Save</Button>'
    );
  });

  it('leaves out an unset arg and an action', () => {
    const onBlur = Object.assign(() => {}, { isAction: true });
    expect(fillTemplate('<Button⟦props ~%20⟧ />', { a: undefined, onClick: vi.fn(), onBlur })).toBe(
      '<Button />'
    );
    expect(fillTemplate('<Button⟦attr label text ~%20⟧ />', {})).toBe('<Button />');
  });

  it('prints a null arg, which a prop default does not stand for', () => {
    expect(fillTemplate('<Button ⟦props -icon⟧ ⟦attr icon icon⟧ />', { b: null, icon: null })).toBe(
      '<Button b={null} icon={null} />'
    );
  });

  it('throws for a function arg that is not an action', () => {
    const args = { title: 'T', formatter: (v: number) => v.toFixed(2) };
    for (const template of ['⟦element Chart⟧', '<Chart ⟦attr formatter formatter⟧ />', '⟦args⟧']) {
      expect(() => fillTemplate(template, args)).toThrow(UnprintableArgError);
    }
  });

  it('prints a written arg as its code, in every hole', () => {
    const formatter = writtenArg('shout');
    expect(fillTemplate('⟦element Chart⟧', { formatter })).toBe('<Chart formatter={shout} />');
    expect(fillTemplate('<Chart ⟦attr format formatter⟧ />', { formatter })).toBe(
      '<Chart format={shout} />'
    );
    expect(fillTemplate('<p>⟦text formatter⟧</p>', { formatter })).toBe('<p>{shout}</p>');
    expect(fillTemplate('use(⟦args⟧)', { formatter })).toBe('use({\n    "formatter": shout\n})');
  });

  it('leaves out the args a props hole names', () => {
    expect(fillTemplate('<Button ⟦props -children⟧>Hi</Button>', { children: 'x', a: 'b' })).toBe(
      '<Button a="b">Hi</Button>'
    );
  });

  it('writes a string an attribute cannot hold as an expression', () => {
    expect(fillTemplate('<Button ⟦attr label text⟧ />', { text: 'say "hi" & go' })).toBe(
      '<Button label={"say \\"hi\\" & go"} />'
    );
    // A line break would take the indentation of the line the attribute is on.
    expect(fillTemplate('<div>\n  <Button ⟦attr label text⟧ />\n</div>', { text: 'a\nb' })).toBe(
      '<div>\n  <Button label={"a\\nb"} />\n</div>'
    );
  });

  it('writes text JSX would read as code or collapse as an expression', () => {
    expect(fillTemplate('<p>⟦text label⟧</p>', { label: 'Go' })).toBe('<p>Go</p>');
    expect(fillTemplate('<p>⟦text label⟧</p>', { label: '{x} ' })).toBe('<p>{"{x} "}</p>');
    expect(fillTemplate('<p>⟦text label⟧</p>', { label: ['a', 1] })).toBe('<p>{["a", 1]}</p>');
  });

  it('leaves out the args an element hole names', () => {
    expect(fillTemplate('⟦element Button -label⟧', { label: 'x', children: 'Hi', a: 'b' })).toBe(
      '<Button a="b">Hi</Button>'
    );
  });

  it('prints the args as an object, one a line, without an action and the args it names', () => {
    const args = { label: 'Go', 'data-id': 1, onClick: vi.fn(), unset: undefined };
    expect(fillTemplate('use(⟦args⟧)', args)).toBe(
      'use({\n    "label": "Go",\n    "data-id": 1\n})'
    );
    expect(fillTemplate('use(⟦args -label⟧)', args)).toBe('use({\n    "data-id": 1\n})');
    expect(fillTemplate('use(⟦args⟧)', {})).toBe('use({})');
  });

  it('prints written code as it is, in braces, and written JSX as content as it is', () => {
    const args = { render: writtenArg('(() => null)'), children: writtenArg('<Icon />') };
    expect(fillTemplate('⟦element Chart jsx⟧', args)).toBe(
      '<Chart render={(() => null)}><Icon /></Chart>'
    );
    expect(fillTemplate('⟦element Chart⟧', { children: writtenArg('f()') })).toBe(
      '<Chart>{f()}</Chart>'
    );
  });

  it('ends an element whose children a spread passes, with them as content', () => {
    const template = '<Button⟦props -children ~%20⟧ size="sm"⟦close Button⟧';
    expect(fillTemplate(template, { label: 'Go' })).toBe('<Button label="Go" size="sm" />');
    expect(fillTemplate(template, { children: 'Save' })).toBe('<Button size="sm">Save</Button>');
  });

  it('ends an element without children as the story writes it', () => {
    const template = '<Button ⟦props -children⟧⟦close Button ?%0A%2F%3E⟧';
    expect(fillTemplate(template, { label: 'Go' })).toBe('<Button label="Go"\n/>');
  });

  it('prints an element on one line, however long', () => {
    const args = {
      title: 'A title long enough',
      description: 'to make the element too long',
      n: 1,
    };
    expect(fillTemplate('<div>\n  ⟦element Card⟧\n</div>', args)).toBe(
      '<div>\n  <Card title="A title long enough" description="to make the element too long" n={1} />\n</div>'
    );
  });

  it('prints a written arg as the code a word of its hole holds for this place', () => {
    const template = `<Card\n  ${hole('props', holeWord('=b=[\n    1,\n  ]'))}\n/>`;
    expect(fillTemplate(template, { a: 'x', b: writtenArg('[\n  1,\n]') })).toBe(
      '<Card\n  a="x" b={[\n    1,\n  ]}\n/>'
    );
    // A changed arg prints its value, which is on one line.
    expect(fillTemplate(template, { b: [1] })).toBe('<Card\n  b={[1]}\n/>');
  });

  it('throws for an arg it cannot print', () => {
    expect(() => fillTemplate('⟦element Chart⟧', { onClick: () => {} })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<p>⟦text icon⟧</p>', { icon: <span /> })).toThrow(
      UnprintableArgError
    );
  });

  it('spreads an arg no attribute can be named as', () => {
    expect(
      fillTemplate('<Button ⟦props⟧ />', { 'my prop': 1, label: 'Go', 'a b': undefined })
    ).toBe('<Button label="Go" {...{ "my prop": 1 }} />');
  });
});

describe('fillTemplate prints each value with the printers of the static snippet', () => {
  const VALUES: [string, unknown][] = [
    ['a plain string', 'Go'],
    ['a string with quotes', `say "hi" it's`],
    ['a string with braces', '{x}'],
    ['a string with a tag', '<b>'],
    ['a string with an entity', 'a & b'],
    ['a string over two lines', 'a\nb'],
    ['an empty string', ''],
    ['zero', 0],
    ['a negative number', -1],
    ['an exponent', 1e3],
    ['a fraction', 1.5],
    ['true', true],
    ['false', false],
    ['null', null],
    ['an array', [1, 'a']],
    ['an object', { a: 1, 'b c': [2] }],
    ['written code', writtenArg('f(x)')],
    ['written code over lines', writtenArg('[\n  1,\n]')],
    ['written JSX', writtenArg('<Icon />')],
    ['a function', () => {}],
  ];

  // A current value as the printers read it.
  const described = (name: string, value: unknown, jsx = false): JsxValue => {
    const written = writtenCode(value);
    if (written !== undefined) {
      return { kind: jsx ? 'jsx' : 'code', code: written };
    }
    if (typeof value === 'boolean') {
      return { kind: 'boolean', value };
    }
    return typeof value === 'string'
      ? { kind: 'string', value, code: printValue(value, name) }
      : { kind: 'code', code: printValue(value, name) };
  };

  const both = (filled: () => string, printed: () => string) => {
    let expected: string | Error;
    try {
      expected = printed();
    } catch (error) {
      expected = error as Error;
    }
    if (expected instanceof Error) {
      expect(filled).toThrow(UnprintableArgError);
    } else {
      expect(filled()).toBe(expected);
    }
  };

  it.each(VALUES)('prints %s alike in every hole', (_, value) => {
    both(
      () => fillTemplate(hole('attr', 'title', 'x'), { x: value }),
      () => printAttribute('title', described('x', value))
    );
    both(
      () => fillTemplate(hole('text', 'children'), { children: value }),
      () => printChildren(described('children', value))
    );
    both(
      () => fillTemplate(hole('text', 'children', 'jsx'), { children: value }),
      () => printChildren(described('children', value, true))
    );
    both(
      () => fillTemplate(hole('props'), { x: value, 'a b': value }),
      () =>
        printAttributes([
          ['x', described('x', value)],
          ['a b', described('a b', value)],
        ]).join(' ')
    );
    both(
      () => fillTemplate(hole('element', 'Button'), { x: value, children: value }),
      () =>
        printElement(
          'Button',
          printAttributes([['x', described('x', value)]]),
          printChildren(described('children', value))
        )
    );
    both(
      () => fillTemplate(hole('close', 'Button'), { children: value }),
      () => printClose('Button', printChildren(described('children', value)))
    );
    both(
      () => fillTemplate(hole('args'), { x: value }),
      () => printArgsObject([['x', described('x', value)]])
    );
  });

  it('leaves out an unset arg in every hole', () => {
    expect(fillTemplate(hole('attr', 'title', 'x'), { x: undefined })).toBe('');
    expect(fillTemplate(hole('text', 'children'), {})).toBe('');
    expect(fillTemplate(hole('props'), { x: undefined })).toBe('');
    expect(fillTemplate(hole('element', 'Button'), { x: undefined })).toBe('<Button />');
    expect(fillTemplate(hole('close', 'Button'), {})).toBe(' />');
    expect(fillTemplate(hole('args'), { x: undefined })).toBe('{}');
  });
});
