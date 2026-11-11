import { describe, expect, it } from 'vitest';

import type { CompodocJson, Property } from './compodoc-types.ts';
import { extractArgTypesFromData, unwrapPlainText } from './extract-arg-types.ts';
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
    // is routinely declared once per component folder.
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
    expect(argTypes.value.action).toBeUndefined();
    expect(argTypes.valueChange).toMatchObject({
      action: 'valueChange',
      table: { category: 'outputs' },
    });
  });

  it('keeps the real output for an alias collision instead of reading it as a model()', () => {
    // `@Input('shared')` next to `@Output('shared')` puts one name in both arrays with no `model()`
    // anywhere.
    const argTypes = extractFrom({
      inputsClass: [{ name: 'shared', type: 'string', optional: false, line: 9 }],
      outputsClass: [{ name: 'shared', type: 'EventEmitter<string>', optional: false, line: 11 }],
    });

    expect(Object.keys(argTypes)).toEqual(['shared']);
    expect(argTypes.shared).toMatchObject({ action: 'shared', table: { category: 'outputs' } });
  });

  it('ignores the decorator IO arrays on an entry that is not a component or directive', () => {
    // The analyzer splits decorator IO onto plain classes too, so this fixture carries the `*Class`
    // arrays of a `model()` alongside its `properties`.
    const value = { name: 'value', type: 'string', optional: false, line: 9 };
    const argTypes = extractArgTypesFromData(
      {
        name: 'PlainHolder',
        type: 'class',
        properties: [{ name: 'other', type: 'number', optional: false, line: 3 }],
        methods: [],
        inputsClass: [value],
        outputsClass: [{ ...value }],
      } as never,
      {
        compodocJson: jsonWith({} as never),
        filterNonInputControls: false,
        logger,
        unwrapHtml: htmlToText,
      }
    );

    expect(Object.keys(argTypes)).toEqual(['other']);
  });
});

describe('required', () => {
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

    // The public ArgTypes type declares `table.type` as summary/detail only, so reading `required`
    // back needs an assertion.
    return (argTypes.value.table?.type as { required?: boolean } | undefined)?.required;
  };

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
    expect(requiredOf({ optional: true, required: true })).toBe(false);
  });

  it('falls back to `optional` when Compodoc omits `required`', () => {
    expect(requiredOf({ optional: true })).toBe(false);
    expect(requiredOf({ optional: false })).toBe(true);
  });

  it('is true for a plain `@Input()`, for which Compodoc emits neither flag (compodoc#863)', () => {
    expect(requiredOf({})).toBe(true);
  });
});

describe('modern', () => {
  const extractMember = (member: Partial<Property>, { modern = true } = {}) => {
    const componentData = {
      name: 'StatusComponent',
      type: 'component',
      inputsClass: [{ name: 'value', ...member }],
      outputsClass: [],
      propertiesClass: [],
      methodsClass: [],
    } as never;
    const argTypes = extractArgTypesFromData(componentData, {
      compodocJson: jsonWith({}),
      filterNonInputControls: false,
      logger,
      unwrapHtml: unwrapPlainText,
      modern,
    });
    return argTypes.value;
  };

  const summaryOf = (member: Partial<Property>, options?: { modern: boolean }) =>
    (extractMember(member, options).table?.defaultValue as { summary?: unknown } | undefined)
      ?.summary;

  describe('no invented defaults', () => {
    it('records no default for a number input without one, where legacy invents NaN', () => {
      expect(summaryOf({ type: 'number' })).toBeUndefined();
      expect(summaryOf({ type: 'number' }, { modern: false })).toBeNaN();
    });

    it('records no default for a boolean input without one, where legacy invents false', () => {
      expect(summaryOf({ type: 'boolean' })).toBeUndefined();
      expect(summaryOf({ type: 'boolean' }, { modern: false })).toBe(false);
    });

    it('keeps the raw source text of an expression default that is not the declared primitive', () => {
      expect(summaryOf({ type: 'number', defaultValue: '5 * 60 * 1000' })).toBe('5 * 60 * 1000');
      expect(summaryOf({ type: 'number', defaultValue: 'Math.max(1, 3)' })).toBe('Math.max(1, 3)');
      expect(summaryOf({ type: 'boolean', defaultValue: '!flag' })).toBe('!flag');
    });

    it('still casts literal defaults to their primitive', () => {
      expect(summaryOf({ type: 'number', defaultValue: '42' })).toBe(42);
      expect(summaryOf({ type: 'number', defaultValue: 'NaN' })).toBeNaN();
      expect(summaryOf({ type: 'boolean', defaultValue: 'true' })).toBe(true);
      expect(summaryOf({ type: 'boolean', defaultValue: 'false' })).toBe(false);
      expect(summaryOf({ type: 'string', defaultValue: "''" })).toBe('');
      expect(summaryOf({ type: 'EventEmitter', defaultValue: 'new EventEmitter()' })).toBe(
        undefined
      );
      expect(summaryOf({ type: 'User | null', defaultValue: 'null' })).toBe(null);
    });
  });

  describe('@default tags', () => {
    const defaultTag = (comment?: string) => ({
      tagName: { escapedText: 'default' },
      ...(comment === undefined ? {} : { comment }),
    });

    it('extracts the value clean: trimmed, surrounding quotes stripped', () => {
      expect(summaryOf({ type: 'string', jsdoctags: [defaultTag("'steelblue'\n")] })).toBe(
        'steelblue'
      );
      expect(summaryOf({ type: 'string', jsdoctags: [defaultTag('"quoted"')] })).toBe('quoted');
    });

    it('keeps plain text intact instead of HTML-stripping it', () => {
      expect(summaryOf({ type: 'string', jsdoctags: [defaultTag('[] as Array<string>')] })).toBe(
        '[] as Array<string>'
      );
    });

    it('ignores a bare @default with no comment, where legacy records "undefined"', () => {
      expect(summaryOf({ type: 'string', jsdoctags: [defaultTag()] })).toBeUndefined();
    });

    it('reaches the tag for a boolean member, where the legacy invented false shadowed it', () => {
      expect(summaryOf({ type: 'boolean', jsdoctags: [defaultTag('true')] })).toBe('true');
    });
  });

  describe('function sbTypes', () => {
    it('maps the bare function type and arrow signatures to { name: "function" }', () => {
      expect(extractMember({ type: 'function' }).type).toEqual({ name: 'function' });
      expect(extractMember({ type: '(value: number) => string' }).type).toEqual({
        name: 'function',
      });
    });

    it('maps a signature that leads with `new` or with type parameters', () => {
      expect(extractMember({ type: 'new (value: number) => Thing' }).type).toEqual({
        name: 'function',
      });
      expect(extractMember({ type: '<T>(value: T) => T' }).type).toEqual({ name: 'function' });
      expect(extractMember({ type: 'new <T>(value: T) => Thing' }).type).toEqual({
        name: 'function',
      });
    });

    it('does not read a type that merely mentions a signature as a function', () => {
      expect(extractMember({ type: 'Array<(value: number) => string>' }).type).not.toEqual({
        name: 'function',
      });
    });

    it('leaves them on the other/empty-enum catch-all with the flag off', () => {
      expect(extractMember({ type: 'function' }, { modern: false }).type).toEqual({
        name: 'other',
        value: 'empty-enum',
      });
    });
  });

  describe('literal-union enum sbTypes', () => {
    const design = '"Default" | "Positive" | "Negative" | undefined';

    it('drops undefined/null members and yields a real enum control', () => {
      expect(extractMember({ type: design }).type).toEqual({
        name: 'enum',
        value: ['Default', 'Positive', 'Negative'],
      });
      expect(extractMember({ type: '"a" | null' }).type).toEqual({ name: 'enum', value: ['a'] });
    });

    it('keeps the empty-enum catch-all for such unions with the flag off', () => {
      expect(extractMember({ type: design }, { modern: false }).type).toEqual({
        name: 'other',
        value: 'empty-enum',
      });
    });

    it('still falls through for unions with non-literal members', () => {
      expect(extractMember({ type: 'boolean | MyThing' }).type).toEqual({
        name: 'other',
        value: 'empty-enum',
      });
    });

    it('maps optional primitives to the primitive control, not empty-enum', () => {
      expect(extractMember({ type: 'string | undefined' }).type).toEqual({ name: 'string' });
      expect(extractMember({ type: 'boolean | null' }).type).toEqual({ name: 'boolean' });
      expect(extractMember({ type: 'number | null | undefined' }).type).toEqual({
        name: 'number',
      });
      expect(extractMember({ type: 'string | undefined' }, { modern: false }).type).toEqual({
        name: 'other',
        value: 'empty-enum',
      });
    });
  });

  describe('table.jsDocTags', () => {
    const tag = (name: string, comment?: string) => ({
      tagName: { escapedText: name },
      ...(comment === undefined ? {} : { comment }),
    });

    it('surfaces @deprecated and @returns in the shape the docs UI consumes', () => {
      const { table } = extractMember({
        type: 'string',
        jsdoctags: [
          tag('deprecated', 'Use `label` instead.'),
          tag('returns', 'The formatted text.'),
          tag('see', 'https://example.com'),
          tag('sbCategory', 'presentation'),
        ],
      });
      expect(table?.jsDocTags).toEqual({
        deprecated: 'Use `label` instead.',
        returns: { description: 'The formatted text.' },
      });
    });

    it('marks a bare @deprecated with an empty comment', () => {
      expect(
        extractMember({ type: 'string', jsdoctags: [tag('deprecated')] }).table?.jsDocTags
      ).toEqual({ deprecated: '' });
    });

    it('omits the key entirely when no displayable tag exists', () => {
      expect(extractMember({ type: 'string' }).table).not.toHaveProperty('jsDocTags');
      expect(
        extractMember({ type: 'string', jsdoctags: [tag('see', 'x')] }).table
      ).not.toHaveProperty('jsDocTags');
      expect(extractMember({ type: 'string' }, { modern: false }).table).not.toHaveProperty(
        'jsDocTags'
      );
    });
  });
});
