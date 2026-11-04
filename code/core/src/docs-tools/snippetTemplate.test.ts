import { describe, expect, it } from 'vitest';

import {
  type HoleRef,
  type PrintHole,
  type SnippetTemplate,
  type TemplateHole,
  UnprintableArgError,
  createHoleMarks,
  fillTemplate,
  formatTemplate,
  isSnippetTemplate,
  prependToTemplate,
  stripHoles,
  withHoleSpace,
} from './snippetTemplate.ts';

type Place =
  | { kind: 'attr'; name: string }
  | { kind: 'attrs'; except: string[] }
  | { kind: 'text' }
  | { kind: 'value' };

const hole = (ref: HoleRef<Place>, text: string, space?: string): TemplateHole<Place> => ({
  ...ref,
  text,
  ...(space !== undefined && { space }),
});

const echo: PrintHole<Place> = (ref, value) =>
  `[${ref.kind} ${ref.spread ? '*' : ref.arg}=${JSON.stringify(value)}]`;

describe('fillTemplate', () => {
  const template: SnippetTemplate<Place> = [
    '<Button',
    hole({ kind: 'attr', name: 'label', arg: 'label' }, ' label="Go"'),
    hole({ kind: 'attrs', except: ['label'], spread: true }, ''),
    ' />',
  ];

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
    ).toBe('<Button[attr label="Stop"][attrs *={"label":"Stop"}] />');
    expect(fillTemplate(template, { unmappedArgs: { theme: 'dark' }, initialArgs }, echo)).toBe(
      '<Button[attr label=undefined][attrs *={}] />'
    );
  });

  it('compares values deeply, so a copy of the initial value is unchanged', () => {
    const items = [hole({ kind: 'value', arg: 'items' }, '[1]')];
    expect(
      fillTemplate(items, { unmappedArgs: { items: [1] }, initialArgs: { items: [1] } }, echo)
    ).toBe('[1]');
  });

  it('gives a spread hole every arg a control set', () => {
    const initialArgs = { label: 'Go', theme: 'dark', onClick: () => {} };
    const unmappedArgs = { ...initialArgs, label: 'Stop', size: 'lg', unset: undefined };
    expect(fillTemplate(template, { unmappedArgs, initialArgs }, echo)).toBe(
      '<Button[attr label="Stop"][attrs *={"label":"Stop","size":"lg"}] />'
    );
    expect(
      fillTemplate(
        template,
        { unmappedArgs: { ...initialArgs, theme: 'light' }, initialArgs },
        echo
      )
    ).toBe('<Button label="Go"[attrs *={"theme":"light"}] />');
  });

  it('gives a spread hole an arg a control cleared, as undefined', () => {
    const initialArgs = { label: 'Go', theme: 'dark' };
    const seen: unknown[] = [];
    fillTemplate(template, { unmappedArgs: { label: 'Go' }, initialArgs }, (hole, value) => {
      if (hole.spread) {
        seen.push(value);
      }
      return '';
    });
    expect(seen).toEqual([{ theme: undefined }]);
    expect(Object.hasOwn(seen[0] as object, 'theme')).toBe(true);
  });

  it('prints the space before a print, and leaves it out with an empty one', () => {
    const spaced = withHoleSpace<SnippetTemplate<Place>>(
      ['<Button ', hole({ kind: 'attr', name: 'label', arg: 'label' }, 'label="Go"'), ' />'],
      (hole) => hole.kind === 'attr'
    );
    const clear: PrintHole<Place> = () => '';
    const initialArgs = { label: 'Go' };
    expect(fillTemplate(spaced, { unmappedArgs: {}, initialArgs }, clear)).toBe('<Button />');
    expect(fillTemplate(spaced, { unmappedArgs: { label: 'Hi' }, initialArgs }, echo)).toBe(
      '<Button [attr label="Hi"] />'
    );
    expect(fillTemplate(spaced, { unmappedArgs: initialArgs, initialArgs }, clear)).toBe(
      '<Button label="Go" />'
    );
  });

  it('gives the renderer the place and arg, not the code', () => {
    const seen: unknown[] = [];
    fillTemplate(template, { unmappedArgs: { label: 'Stop' }, initialArgs: {} }, (ref) => {
      seen.push(ref);
      return '';
    });
    expect(seen).toEqual([
      { kind: 'attr', name: 'label', arg: 'label' },
      { kind: 'attrs', except: ['label'], spread: true },
    ]);
  });

  it('passes on what the renderer cannot print', () => {
    const fail: PrintHole<Place> = (ref) => {
      throw new UnprintableArgError(ref.arg!);
    };
    expect(() =>
      fillTemplate(template, { unmappedArgs: { label: 'Stop' }, initialArgs: {} }, fail)
    ).toThrow(new UnprintableArgError('label'));
  });
});

describe('stripHoles', () => {
  it('is the static snippet the template is written from', () => {
    const template = withHoleSpace<SnippetTemplate<Place>>(
      [
        '<Button\n  ',
        hole({ kind: 'attr', name: 'label', arg: 'label' }, 'label="Go"'),
        '\n  ',
        hole({ kind: 'attr', name: 'size', arg: 'size' }, 'size="lg"'),
        hole({ kind: 'attrs', except: [], spread: true }, '', ' '),
        '\n/>',
      ],
      () => true
    );
    expect(template[1]).toMatchObject({ text: '\n  label="Go"', space: '\n  ' });
    expect(stripHoles(template)).toBe('<Button\n  label="Go"\n  size="lg"\n/>');
  });
});

describe('withHoleSpace', () => {
  it('moves the whitespace before a hole it names into it', () => {
    const template: SnippetTemplate<Place> = [
      '<B ',
      hole({ kind: 'attr', name: 'a', arg: 'a' }, 'a'),
      '>\n  ',
      hole({ kind: 'text', arg: 'b' }, 'b'),
    ];
    expect(formatTemplate(withHoleSpace(template, (hole) => hole.kind === 'attr'))).toBe(
      '<B⟦attr a name="a" ~" "⟫ a⟧>\n  ⟦text b⟫b⟧'
    );
  });

  it('keeps the whitespace before a hole that prints no text', () => {
    const template: SnippetTemplate<Place> = [
      '<B ',
      hole({ kind: 'attrs', except: [], spread: true }, ''),
      '/>',
    ];
    expect(withHoleSpace(template, () => true)).toEqual(template);
  });
});

describe('prependToTemplate', () => {
  it('puts code before the template', () => {
    const value = hole({ kind: 'value', arg: 'a' }, '1');
    expect(prependToTemplate<Place>('import x;\n\n', ['a = ', value])).toEqual([
      'import x;\n\na = ',
      value,
    ]);
    expect(prependToTemplate<Place>('import x;\n\n', [value])).toEqual(['import x;\n\n', value]);
  });
});

describe('isSnippetTemplate', () => {
  it('accepts segments and holes with one arg or a spread', () => {
    expect(
      isSnippetTemplate([
        'a',
        { kind: 'x', arg: 'a', text: '' },
        { kind: 'x', spread: true, text: '', space: ' ' },
      ])
    ).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isSnippetTemplate('a⟦x a⟫b⟧')).toBe(false);
    expect(isSnippetTemplate([{ kind: 'x', text: '' }])).toBe(false);
    expect(isSnippetTemplate([{ kind: 'x', arg: 'a', spread: true, text: '' }])).toBe(false);
    expect(isSnippetTemplate([{ arg: 'a', text: '' }])).toBe(false);
    expect(isSnippetTemplate([{ kind: 'x', arg: 'a', spread: 1, text: '' }])).toBe(false);
  });
});

describe('createHoleMarks', () => {
  it('turns marked code into a template', () => {
    const marks = createHoleMarks<Place>([]);
    const marked = `<B${marks.mark({ kind: 'attr', name: 'a', arg: 'a' }, ' a="1"')}${marks.mark({ kind: 'attrs', except: ['a'], spread: true }, '', ' ')} />`;
    expect(marks.toTemplate(marked)).toEqual([
      '<B',
      { kind: 'attr', name: 'a', arg: 'a', text: ' a="1"' },
      { kind: 'attrs', except: ['a'], spread: true, text: '', space: ' ' },
      ' />',
    ]);
  });

  it('marks with characters the sources do not hold', () => {
    const source = ' ⟦text⟧ a="1"';
    const marks = createHoleMarks<Place>([source]);
    const marked = `${source}${marks.mark({ kind: 'text', arg: 'a' }, '1')}`;
    expect(marks.toTemplate(marked)).toEqual([source, { kind: 'text', arg: 'a', text: '1' }]);
  });

  it('writes marks where the code must still parse', () => {
    const marks = createHoleMarks<Place>([], (mark) => `/*${mark}*/`);
    const marked = `f(${marks.mark({ kind: 'value', arg: 'a' }, '1')})`;
    expect(marked).toMatch(/^f\(\/\*.+\*\/1\/\*.\*\/\)$/);
    expect(marks.toTemplate(marked)).toEqual(['f(', { kind: 'value', arg: 'a', text: '1' }, ')']);
  });

  it('marks the same hole alike, and leaves an empty space out', () => {
    const marks = createHoleMarks<Place>([]);
    const ref = { kind: 'value' as const, arg: 'a' };
    expect(marks.mark({ ...ref }, '1', '')).toBe(marks.mark({ ...ref }, '1'));
    expect(marks.mark(ref, '1')).not.toBe(marks.mark({ ...ref, arg: 'b' }, '1'));
    expect(marks.toTemplate(marks.mark(ref, '1', ''))).toEqual([{ ...ref, text: '1' }]);
  });

  it('gives no template for marks that do not pair up', () => {
    const marks = createHoleMarks<Place>([]);
    const inner = marks.mark({ kind: 'text', arg: 'b' }, 'b');
    expect(marks.toTemplate(marks.mark({ kind: 'text', arg: 'a' }, `a${inner}`))).toBe(undefined);
    expect(marks.toTemplate(inner.slice(0, -1))).toBe(undefined);
  });
});
