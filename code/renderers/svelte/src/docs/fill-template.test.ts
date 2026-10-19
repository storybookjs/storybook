import { describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';
import { createRawSnippet } from 'svelte';

import { fillTemplate } from './fill-template.ts';

describe('fillTemplate', () => {
  it('prints the props of a spread as attributes', () => {
    expect(fillTemplate('<Button ⟦props⟧ />', { label: 'Go', primary: true, size: 2 })).toBe(
      '<Button label="Go" primary size={2} />'
    );
    expect(fillTemplate('<Button ⟦props⟧ />', { disabled: false, items: ['a', { b: 1 }] })).toBe(
      '<Button disabled={false} items={["a", { b: 1 }]} />'
    );
  });

  it('leaves out an unset arg and the args a props hole names', () => {
    expect(fillTemplate('<Button ⟦props⟧ />', { a: undefined })).toBe('<Button />');
    expect(fillTemplate('<Button ⟦attr label text⟧ />', {})).toBe('<Button />');
    expect(fillTemplate('<Button ⟦props -children⟧>Hi</Button>', { children: 'x', a: 'b' })).toBe(
      '<Button a="b">Hi</Button>'
    );
  });

  it('prints a null arg, which a prop default does not stand for', () => {
    expect(fillTemplate('<Button icon={⟦value icon⟧}>⟦text icon⟧</Button>', { icon: null })).toBe(
      '<Button icon={null}></Button>'
    );
    expect(fillTemplate('<Button ⟦props -size⟧ ⟦attr size size⟧ />', { b: null, size: null })).toBe(
      '<Button b={null} size={null} />'
    );
  });

  it('writes a string an attribute cannot hold as an expression', () => {
    expect(fillTemplate('<Button ⟦attr label text⟧ />', { text: 'say "hi" {x} & go' })).toBe(
      '<Button label={"say \\"hi\\" {x} & go"} />'
    );
  });

  it('writes text Svelte would read as code or collapse as an expression', () => {
    expect(fillTemplate('<p>⟦text label⟧</p>', { label: 'Go' })).toBe('<p>Go</p>');
    expect(fillTemplate('<p>⟦text label⟧</p>', { label: '<b>{x}</b>' })).toBe(
      '<p>{"<b>{x}</b>"}</p>'
    );
    expect(fillTemplate('<p>⟦text label⟧</p>', { label: true })).toBe('<p>{true}</p>');
  });

  it('prints a value hole as a literal in the code around it', () => {
    expect(fillTemplate('{#if ⟦value loading⟧}…{/if}', { loading: false })).toBe(
      '{#if false}…{/if}'
    );
  });

  it('leaves out an action Storybook adds', () => {
    const onclick = Object.assign(() => {}, { getMockName: () => 'spy' });
    expect(
      fillTemplate('<Button ⟦props⟧ ⟦attr onhover hover⟧ />', { onclick, hover: onclick })
    ).toBe('<Button />');
  });

  it('throws for an arg it cannot print or name as an attribute', () => {
    expect(() => fillTemplate('<p>⟦text lookup⟧</p>', { lookup: new Map() })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<Button ⟦props⟧ />', { 'my prop': 1 })).toThrow(UnprintableArgError);
    // A function, a snippet or a date has no literal; the story writes the code that makes it.
    const snippet = createRawSnippet(() => ({ render: () => '<span></span>' }));
    for (const value of [() => {}, snippet, new Date(0)]) {
      expect(() => fillTemplate('<Button ⟦props⟧ />', { value })).toThrow(UnprintableArgError);
    }
  });
});
