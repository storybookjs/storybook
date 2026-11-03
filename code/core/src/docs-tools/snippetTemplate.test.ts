import { describe, expect, it } from 'vitest';

import {
  type PrintHole,
  UnprintableArgError,
  fillTemplate,
  hole,
  stripHoles,
  withHoleSpace,
} from './snippetTemplate.ts';

const echo: PrintHole = ({ kind, arg, words }, value) =>
  `[${kind} ${arg ?? '*'} ${words.join(',')}=${JSON.stringify(value)}]`;

describe('fillTemplate', () => {
  const template = `<Button${hole({ kind: 'attr', arg: 'label', words: ['label'] }, ' label="Go"')}${hole({ kind: 'attrs', words: [] }, '')} />`;

  it('prints the text of a hole whose arg holds its initial value', () => {
    const args = { label: 'Go', theme: 'dark', onClick: () => {} };
    expect(fillTemplate(template, { unmappedArgs: args, initialArgs: args }, echo)).toBe(
      '<Button label="Go" />'
    );
  });

  it('asks the renderer for a changed or cleared value only', () => {
    const initialArgs = { label: 'Go', theme: 'dark' };
    expect(
      fillTemplate(template, { unmappedArgs: { ...initialArgs, label: 'Stop' }, initialArgs }, echo)
    ).toBe('<Button[attr label label="Stop"] />');
    expect(fillTemplate(template, { unmappedArgs: { theme: 'dark' }, initialArgs }, echo)).toBe(
      '<Button[attr label label=undefined] />'
    );
  });

  it('compares values deeply, so a copy of the initial value is unchanged', () => {
    const items = hole({ kind: 'value', arg: 'items', words: [] }, '[1]');
    expect(
      fillTemplate(items, { unmappedArgs: { items: [1] }, initialArgs: { items: [1] } }, echo)
    ).toBe('[1]');
  });

  it('gives a hole without an arg the args a control set that no other hole reads', () => {
    const initialArgs = { label: 'Go', theme: 'dark', onClick: () => {} };
    const unmappedArgs = { ...initialArgs, label: 'Stop', size: 'lg', unset: undefined };
    expect(fillTemplate(template, { unmappedArgs, initialArgs }, echo)).toBe(
      '<Button[attr label label="Stop"][attrs * ={"size":"lg"}] />'
    );
    expect(
      fillTemplate(
        template,
        { unmappedArgs: { ...initialArgs, theme: 'light' }, initialArgs },
        echo
      )
    ).toBe('<Button label="Go"[attrs * ={"theme":"light"}] />');
  });

  it('prints the space word before a print, and leaves it out with an empty one', () => {
    const spaced = withHoleSpace(template, (kind) => kind === 'attr');
    const clear: PrintHole = () => '';
    const initialArgs = { label: 'Go' };
    expect(fillTemplate(spaced, { unmappedArgs: {}, initialArgs }, clear)).toBe('<Button />');
    expect(fillTemplate(spaced, { unmappedArgs: initialArgs, initialArgs }, clear)).toBe(
      '<Button label="Go" />'
    );
  });

  it('passes on what the renderer cannot print', () => {
    const fail: PrintHole = ({ arg }) => {
      throw new UnprintableArgError(arg!);
    };
    expect(() =>
      fillTemplate(template, { unmappedArgs: { label: 'Stop' }, initialArgs: {} }, fail)
    ).toThrow(new UnprintableArgError('label'));
  });

  it('reads an arg named as hole syntax as that arg, and words as written', () => {
    for (const arg of ['*', 'a b', '%x', '~y', 'z⟫']) {
      const written = hole({ kind: 'value', arg, words: ['a b', '-c'] }, 'x');
      expect(fillTemplate(written, { unmappedArgs: { [arg]: 1 }, initialArgs: {} }, echo)).toBe(
        `[value ${arg} a b,-c=1]`
      );
    }
  });
});

describe('stripHoles', () => {
  it('is the static snippet the template is written from', () => {
    const snippet = '<Button\n  label="Go"\n  size="lg"\n/>';
    const template = withHoleSpace(
      `<Button\n  ${hole({ kind: 'attr', arg: 'label', words: [] }, 'label="Go"')}\n  ${hole({ kind: 'attr', arg: 'size', words: [] }, 'size="lg"')}${hole({ kind: 'attrs', words: [] }, '')}\n/>`,
      () => true
    );
    expect(template).toContain('~%0A%20%20⟫');
    expect(stripHoles(template)).toBe(snippet);
  });
});

describe('withHoleSpace', () => {
  it('moves the whitespace before a hole it names into it', () => {
    const template = `<B ${hole({ kind: 'attr', arg: 'a', words: [] }, 'a')}>\n  ${hole({ kind: 'text', arg: 'b', words: [] }, 'b')}`;
    expect(withHoleSpace(template, (kind) => kind === 'attr')).toBe(
      '<B⟦attr a ~%20⟫a⟧>\n  ⟦text b⟫b⟧'
    );
  });

  it('keeps the whitespace before a hole that prints no text', () => {
    const template = `<B ${hole({ kind: 'attrs', words: [] }, '')}/>`;
    expect(withHoleSpace(template, () => true)).toBe(template);
  });
});
