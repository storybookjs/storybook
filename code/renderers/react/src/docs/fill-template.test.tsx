import { describe, expect, it, vi } from 'vitest';

import React from 'react';

import { UnprintableArgError, writtenArg } from 'storybook/internal/docs-tools';

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
    expect(fillTemplate('<Button ⟦props⟧ />', { a: undefined, onClick: vi.fn(), onBlur })).toBe(
      '<Button />'
    );
    expect(fillTemplate('<Button ⟦attr label text⟧ />', {})).toBe('<Button />');
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
    expect(fillTemplate('⟦element Chart⟧', args)).toBe(
      '<Chart render={(() => null)}><Icon /></Chart>'
    );
    expect(fillTemplate('⟦element Chart⟧', { children: writtenArg('f()') })).toBe(
      '<Chart>{f()}</Chart>'
    );
  });

  it('ends an element whose children a spread passes, with them as content', () => {
    const template = '<Button ⟦props -children⟧ size="sm"⟦close Button⟧';
    expect(fillTemplate(template, { label: 'Go' })).toBe('<Button label="Go" size="sm" />');
    expect(fillTemplate(template, { children: 'Save' })).toBe('<Button size="sm">Save</Button>');
  });

  it('ends an element without children as the story writes it', () => {
    const template = '<Button ⟦props -children⟧⟦close Button ?%0A%2F%3E⟧';
    expect(fillTemplate(template, { label: 'Go' })).toBe('<Button label="Go"\n/>');
  });

  it('prints an element on one line, a value of more lines indented as the line it is on', () => {
    const args = {
      title: 'A title long enough',
      description: 'to make the element too long',
      n: 1,
    };
    expect(fillTemplate('<div>\n  ⟦element Card⟧\n</div>', args)).toBe(
      '<div>\n  <Card title="A title long enough" description="to make the element too long" n={1} />\n</div>'
    );
    expect(fillTemplate('<Card\n  ⟦props⟧\n/>', { a: 'x', b: writtenArg('[\n  1,\n]') })).toBe(
      '<Card\n  a="x" b={[\n    1,\n  ]}\n/>'
    );
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
