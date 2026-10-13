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
    expect(fillTemplate('<Button⟦props⟧ />', { a: undefined, b: null, onClick: () => {} })).toBe(
      '<Button />'
    );
    expect(fillTemplate('<Button⟦attr label text⟧ />', {})).toBe('<Button />');
  });

  it('leaves out the args a props hole names', () => {
    expect(fillTemplate('<Button⟦props -children⟧>Hi</Button>', { children: 'x', a: 'b' })).toBe(
      '<Button a="b">Hi</Button>'
    );
  });

  it('writes a string an attribute cannot hold as an expression', () => {
    expect(fillTemplate('<Button⟦attr label text⟧ />', { text: 'say "hi" & go' })).toBe(
      '<Button label={"say \\"hi\\" & go"} />'
    );
  });

  it('writes text JSX would read as code or collapse as an expression', () => {
    expect(fillTemplate('<p>⟦text label⟧</p>', { label: 'Go' })).toBe('<p>Go</p>');
    expect(fillTemplate('<p>⟦text label⟧</p>', { label: '{x} ' })).toBe('<p>{"{x} "}</p>');
    expect(fillTemplate('<p>⟦text label⟧</p>', { label: ['a', 1] })).toBe('<p>{["a", 1]}</p>');
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
    expect(() => fillTemplate('<Button⟦props⟧ />', { 'my prop': 1 })).toThrow(UnprintableArgError);
  });
});
