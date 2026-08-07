import { describe, expect, it } from 'vitest';

import type { CompodocJson } from './compodoc-types.ts';
import { extractArgTypesFromData } from './extract-arg-types.ts';
import { htmlToText } from './html-to-text.ts';

const logger = { warn: () => {}, debug: () => {} };

const componentWith = (type: string) =>
  ({
    name: 'StatusComponent',
    type: 'component',
    inputsClass: [{ name: 'status', type, optional: false }],
    outputsClass: [],
    propertiesClass: [],
    methodsClass: [],
  }) as never;

const jsonWith = (miscellaneous: CompodocJson['miscellaneous']): CompodocJson =>
  ({
    components: [],
    directives: [],
    pipes: [],
    injectables: [],
    classes: [],
    miscellaneous,
  }) as CompodocJson;

const extract = (type: string, miscellaneous: CompodocJson['miscellaneous']) => {
  const compodocJson = jsonWith(miscellaneous);
  return extractArgTypesFromData(componentWith(type), {
    compodocJson,
    filterNonInputControls: false,
    logger,
    unwrapHtml: htmlToText,
  });
};

describe('extractArgTypesFromData', () => {
  it('does not recurse forever on a cyclic type alias', () => {
    expect(() =>
      extract('Alpha', {
        typealiases: [
          { name: 'Alpha', rawtype: 'Beta' },
          { name: 'Beta', rawtype: 'Alpha' },
        ] as never,
      })
    ).not.toThrow();
  });

  it('still resolves a non-cyclic alias chain to its underlying enum', () => {
    const argTypes = extract('Alias', {
      typealiases: [
        { name: 'Alias', rawtype: 'Inner' },
        { name: 'Inner', rawtype: 'Status' },
      ] as never,
      enumerations: [
        {
          name: 'Status',
          childs: [
            { name: 'On', value: 'on' },
            { name: 'Off', value: 'off' },
          ],
        },
      ] as never,
    });

    expect(argTypes.status.type).toEqual({ name: 'enum', value: ['on', 'off'] });
  });

  it('does not throw for an enumeration entry with no `childs`', () => {
    expect(() => extract('Status', { enumerations: [{ name: 'Status' }] as never })).not.toThrow();
  });

  describe('same-named declarations in different files', () => {
    // Compodoc emits the same entries in a different order from run to run, and a name like `Size`
    // is routinely declared once per component folder. Resolving by array order therefore let a
    // control's type change with no source change at all.
    const inOwnFile = {
      name: 'Size',
      file: 'src/status/status.component.ts',
      rawtype: '"sm" | "lg"',
    };
    const elsewhere = {
      name: 'Size',
      file: 'src/other/other.component.ts',
      rawtype: '"wide" | "narrow"',
    };

    const extractFrom = (typealiases: unknown[]) =>
      extractArgTypesFromData(
        {
          name: 'StatusComponent',
          type: 'component',
          file: 'src/status/status.component.ts',
          inputsClass: [{ name: 'status', type: 'Size', optional: false }],
          outputsClass: [],
          propertiesClass: [],
          methodsClass: [],
        } as never,
        {
          compodocJson: jsonWith({ typealiases: typealiases as never }),
          filterNonInputControls: false,
          logger,
          unwrapHtml: htmlToText,
        }
      ).status.type;

    it('prefers the declaration in the component`s own file', () => {
      expect(extractFrom([elsewhere, inOwnFile])).toEqual({
        name: 'enum',
        value: ['sm', 'lg'],
      });
    });

    it('resolves the same way whatever order Compodoc listed them in', () => {
      expect(extractFrom([inOwnFile, elsewhere])).toEqual(extractFrom([elsewhere, inOwnFile]));
    });

    it('is stable across runs even when the component`s own file declares none of them', () => {
      const a = { name: 'Size', file: 'src/a/a.component.ts', rawtype: '"one" | "two"' };
      const b = { name: 'Size', file: 'src/b/b.component.ts', rawtype: '"three" | "four"' };

      expect(extractFrom([a, b])).toEqual(extractFrom([b, a]));
    });
  });
});

describe('model() two-way bindings', () => {
  const extractFrom = (members: {
    inputsClass: Record<string, unknown>[];
    outputsClass: Record<string, unknown>[];
  }) =>
    extractArgTypesFromData(
      {
        name: 'PickerComponent',
        type: 'component',
        propertiesClass: [],
        methodsClass: [],
        ...members,
      } as never,
      {
        compodocJson: jsonWith({} as never),
        filterNonInputControls: false,
        logger,
        unwrapHtml: htmlToText,
      }
    );

  it('records a model() once, as an input plus the synthesized change output', () => {
    // Compodoc pushes one `model()` into both arrays from a single source object, so both entries
    // describe the same declaration on the same line.
    const value = { name: 'value', type: 'string', optional: false, line: 9 };

    const argTypes = extractFrom({ inputsClass: [value], outputsClass: [{ ...value }] });

    expect(Object.keys(argTypes)).toEqual(['value', 'valueChange']);
    expect(argTypes.value.table?.category).toBe('inputs');
    // Compodoc's bare-name output duplicate is suppressed, so the input is not turned into one.
    expect(argTypes.value.action).toBeUndefined();
    expect(argTypes.valueChange).toMatchObject({
      action: 'valueChange',
      table: { category: 'outputs' },
    });
  });

  it('keeps the real output for an alias collision instead of reading it as a model()', () => {
    // `@Input('shared')` next to `@Output('shared')` puts one name in both arrays with no `model()`
    // anywhere. argTypes is keyed by binding name, so only one of the pair can have a row: the
    // output the component really declares, rather than a synthesized `sharedChange` it does not.
    const argTypes = extractFrom({
      inputsClass: [{ name: 'shared', type: 'string', optional: false, line: 9 }],
      outputsClass: [{ name: 'shared', type: 'EventEmitter<string>', optional: false, line: 11 }],
    });

    expect(Object.keys(argTypes)).toEqual(['shared']);
    expect(argTypes.shared).toMatchObject({ action: 'shared', table: { category: 'outputs' } });
  });
});

describe('required', () => {
  /** Extracts a single input declared with the given pair of Compodoc flags. */
  const requiredOf = (flags: { optional?: boolean; required?: boolean }) => {
    const componentData = {
      name: 'StatusComponent',
      type: 'component',
      inputsClass: [{ name: 'value', type: 'string', ...flags }],
      outputsClass: [],
      propertiesClass: [],
      methodsClass: [],
    } as never;

    const argTypes = extractArgTypesFromData(componentData, {
      compodocJson: jsonWith({} as never),
      filterNonInputControls: true,
      logger,
      unwrapHtml: (html: unknown) => String(html),
    });

    // `required` has always been written into `table.type`, which the public ArgTypes type
    // declares as summary/detail only, so reading it back needs an assertion.
    return (argTypes.value.table?.type as { required?: boolean } | undefined)?.required;
  };

  // One case per shape Compodoc can emit. Which declaration produces which pair is recorded here
  // because the pairs are not self-explanatory, and one of them is self-contradictory.
  it('is false for a signal input with a default: `input("")`', () => {
    expect(requiredOf({ optional: false, required: false })).toBe(false);
  });

  it('is true for `input.required<T>()`', () => {
    expect(requiredOf({ optional: false, required: true })).toBe(true);
  });

  it('is true for `@Input({ required: true })`', () => {
    expect(requiredOf({ optional: false, required: true })).toBe(true);
  });

  it('is false for `@Input({ required: false })`, which Compodoc reports as required and optional at once', () => {
    // Compodoc derives `required` from the presence of the key rather than its value, so this
    // declaration contradicts itself. Trusting `required` alone would call it required.
    expect(requiredOf({ optional: true, required: true })).toBe(false);
  });

  it('falls back to `optional` when Compodoc omits `required`', () => {
    expect(requiredOf({ optional: true })).toBe(false);
    expect(requiredOf({ optional: false })).toBe(true);
  });

  it('is true for a plain `@Input()`, for which Compodoc emits neither flag (compodoc#863)', () => {
    // The remaining upstream gap: with nothing to read, every plain decorator input reads as
    // required. Fixing it upstream makes `optional` appear, and this case corrects itself.
    expect(requiredOf({})).toBe(true);
  });
});
