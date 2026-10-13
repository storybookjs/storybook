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
    expect(fillTemplate('<Button ⟦props⟧ />', { a: undefined, b: null })).toBe('<Button />');
    expect(fillTemplate('<Button ⟦attr label text⟧ />', {})).toBe('<Button />');
    expect(fillTemplate('<Button ⟦props -children⟧>Hi</Button>', { children: 'x', a: 'b' })).toBe(
      '<Button a="b">Hi</Button>'
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

  it('prints a date as the code that makes it', () => {
    expect(fillTemplate('<Day ⟦props⟧ />', { when: new Date(0) })).toBe(
      '<Day when={new Date("1970-01-01T00:00:00.000Z")} />'
    );
  });

  it('prints a function, such as an action or a snippet, as its name', () => {
    const onclick = () => {};
    const snippet = createRawSnippet(() => ({ render: () => '<span></span>' }));
    expect(fillTemplate('<Button ⟦props⟧ />', { onclick, icon: snippet })).toBe(
      '<Button onclick={onclick} icon={() => {}} />'
    );
  });

  it('throws for an arg it cannot print or name as an attribute', () => {
    expect(() => fillTemplate('<p>⟦text lookup⟧</p>', { lookup: new Map() })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<Button ⟦props⟧ />', { 'my prop': 1 })).toThrow(UnprintableArgError);
  });
});
