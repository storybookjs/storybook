import { describe, expect, it } from 'vitest';

import React from 'react';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

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

  it('leaves out an unset arg and a function arg', () => {
    expect(fillTemplate('<Button ⟦props⟧ />', { a: undefined, b: null, onClick: () => {} })).toBe(
      '<Button />'
    );
    expect(fillTemplate('<Button ⟦attr label text⟧ />', {})).toBe('<Button />');
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

  it('prints the args as an object, without a function arg and the args it names', () => {
    const HeartIcon = () => null;
    const args = {
      label: 'Go',
      'data-id': 1,
      icon: HeartIcon,
      onClick: () => {},
      unset: undefined,
    };
    expect(fillTemplate('use(⟦args⟧)', args)).toBe(
      'use({ label: "Go", "data-id": 1, icon: HeartIcon })'
    );
    expect(fillTemplate('use(⟦args -label -icon⟧)', args)).toBe('use({ "data-id": 1 })');
    expect(fillTemplate('use(⟦args⟧)', {})).toBe('use({})');
  });

  it('prints the code after `=` for an unset arg', () => {
    const template =
      "<a ⟦attr size size ='md'⟧>⟦text label =a = b⟧</a> ⟦value n =1⟧ ⟦operand n =(1)⟧";
    expect(fillTemplate(template, {})).toBe("<a size={'md'}>{a = b}</a> 1 (1)");
    expect(fillTemplate(template, { size: 'lg', label: 'Go', n: 2 })).toBe(
      '<a size="lg">Go</a> 2 (2)'
    );
    expect(fillTemplate(template, { size: null, label: null, n: null })).toBe('<a></a> null null');
  });

  it('prints a value hole as a literal in the code around it', () => {
    expect(fillTemplate('⟦value loading⟧ ? a : b', { loading: true })).toBe('true ? a : b');
  });

  it('throws for an arg it cannot print or name as an attribute', () => {
    expect(() => fillTemplate('⟦value onClick⟧', { onClick: () => {} })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<p>⟦text icon⟧</p>', { icon: <span /> })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<Button ⟦props⟧ />', { 'my prop': 1 })).toThrow(UnprintableArgError);
  });
});
