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
