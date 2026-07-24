import { describe, expect, it } from 'vitest';

import { parseArgTypesSnapshot } from './parse-snapshot.ts';

describe('parseArgTypesSnapshot', () => {
  it('parses the pretty-format shape: 2-space indent, quoted keys, trailing commas', () => {
    const text = [
      '{',
      '  "label": {',
      '    "description": "The text.",',
      '    "name": "label",',
      '    "table": {',
      '      "category": "inputs",',
      '      "type": {',
      '        "required": true,',
      '        "summary": "string",',
      '      },',
      '    },',
      '    "type": {',
      '      "name": "string",',
      '    },',
      '  },',
      '}',
    ].join('\n');
    expect(parseArgTypesSnapshot(text)).toEqual({
      label: {
        description: 'The text.',
        name: 'label',
        table: { category: 'inputs', type: { required: true, summary: 'string' } },
        type: { name: 'string' },
      },
    });
  });

  it('reconstructs bare undefined as a real undefined property', () => {
    const parsed = parseArgTypesSnapshot(
      [
        '{',
        '  "data": {',
        '    "description": undefined,',
        '    "name": "data",',
        '  },',
        '}',
      ].join('\n')
    );
    expect('description' in parsed.data).toBe(true);
    expect(parsed.data.description).toBeUndefined();
  });

  it('reconstructs bare NaN as a real NaN', () => {
    const parsed = parseArgTypesSnapshot(
      [
        '{',
        '  "count": {',
        '    "name": "count",',
        '    "table": {',
        '      "defaultValue": {',
        '        "summary": NaN,',
        '      },',
        '    },',
        '  },',
        '}',
      ].join('\n')
    );
    expect(parsed.count.table?.defaultValue?.summary).toBeNaN();
  });

  it('keeps literal raw newlines inside strings', () => {
    const parsed = parseArgTypesSnapshot(
      ['{', '  "count": {', '    "description": "', '",', '    "name": "count",', '  },', '}'].join(
        '\n'
      )
    );
    expect(parsed.count.description).toBe('\n');
  });

  it('keeps text after a literal raw newline inside a string', () => {
    const parsed = parseArgTypesSnapshot(
      [
        '{',
        '  "label": {',
        '    "description": "',
        'The text shown on the badge.",',
        '    "name": "label",',
        '  },',
        '}',
      ].join('\n')
    );
    expect(parsed.label.description).toBe('\nThe text shown on the badge.');
  });

  it('keeps literal unescaped inner double quotes in union summaries', () => {
    const parsed = parseArgTypesSnapshot(
      [
        '{',
        '  "size": {',
        '    "name": "size",',
        '    "table": {',
        '      "type": {',
        '        "summary": ""small" | "medium" | "large"",',
        '      },',
        '    },',
        '  },',
        '}',
      ].join('\n')
    );
    expect(parsed.size.table?.type?.summary).toBe('"small" | "medium" | "large"');
  });

  it('keeps literal unescaped quotes in union member values', () => {
    const parsed = parseArgTypesSnapshot(
      [
        '{',
        '  "size": {',
        '    "name": "size",',
        '    "type": {',
        '      "name": "union",',
        '      "required": true,',
        '      "value": [',
        '        {',
        '          "name": "other",',
        '          "value": ""small"",',
        '        },',
        '      ],',
        '    },',
        '  },',
        '}',
      ].join('\n')
    );
    expect(parsed.size.type).toEqual({
      name: 'union',
      required: true,
      value: [{ name: 'other', value: '"small"' }],
    });
  });

  it('parses numbers, booleans, and enum arrays with trailing commas', () => {
    const parsed = parseArgTypesSnapshot(
      [
        '{',
        '  "variant": {',
        '    "control": {',
        '      "disable": true,',
        '    },',
        '    "name": "variant",',
        '    "table": {',
        '      "defaultValue": {',
        '        "summary": 5,',
        '      },',
        '    },',
        '    "type": {',
        '      "name": "enum",',
        '      "value": [',
        '        "primary",',
        '        "secondary",',
        '      ],',
        '    },',
        '  },',
        '}',
      ].join('\n')
    );
    expect(parsed.variant).toEqual({
      control: { disable: true },
      name: 'variant',
      table: { defaultValue: { summary: 5 } },
      type: { name: 'enum', value: ['primary', 'secondary'] },
    });
  });

  it('parses the empty-object baseline byte-for-byte', () => {
    // The committed cross-file-composed-utility and cross-file-runtime-props baselines
    // are exactly these two bytes, no trailing newline.
    expect(parseArgTypesSnapshot('{}')).toEqual({});
    expect(parseArgTypesSnapshot('{}\n')).toEqual({});
  });

  it('parses nested empty objects', () => {
    const parsed = parseArgTypesSnapshot(
      [
        '{',
        '  "shape": {',
        '    "name": "shape",',
        '    "type": {',
        '      "name": "object",',
        '      "value": {},',
        '    },',
        '  },',
        '}',
      ].join('\n')
    );
    expect(parsed.shape.type).toEqual({ name: 'object', value: {} });
  });

  it('keeps prose with quoted terms, commas, and colons inside one description string', () => {
    // A value string ends only at `",` + newline, so key-shaped prose fragments must not
    // terminate it early or fabricate sibling keys.
    const parsed = parseArgTypesSnapshot(
      [
        '{',
        '  "foo": {',
        '    "description": "Legend: "red", "warning": "amber", "ok": "green".",',
        '    "name": "foo",',
        '  },',
        '}',
      ].join('\n')
    );
    expect(parsed.foo).toEqual({
      description: 'Legend: "red", "warning": "amber", "ok": "green".',
      name: 'foo',
    });
  });

  it('fails loudly on an unterminated string, naming source and offset', () => {
    expect(() => parseArgTypesSnapshot('{\n  "a": "never closed\n', 'broken.snapshot')).toThrow(
      /broken\.snapshot.*offset \d+/s
    );
  });

  it('fails loudly on an unknown bare token', () => {
    expect(() => parseArgTypesSnapshot('{\n  "a": wat,\n}', 'broken.snapshot')).toThrow(
      /broken\.snapshot.*offset \d+/s
    );
  });

  it('fails loudly on trailing content after the top-level object', () => {
    expect(() => parseArgTypesSnapshot('{}garbage', 'broken.snapshot')).toThrow(
      /broken\.snapshot.*offset \d+/s
    );
  });

  it('fails loudly on a non-object top level', () => {
    expect(() => parseArgTypesSnapshot('[]', 'broken.snapshot')).toThrow(/broken\.snapshot/);
    expect(() => parseArgTypesSnapshot('"just a string"', 'broken.snapshot')).toThrow(
      /broken\.snapshot/
    );
  });

  it('fails loudly on an unterminated object', () => {
    expect(() =>
      parseArgTypesSnapshot('{\n  "a": {\n    "name": "a",\n  },\n', 'broken.snapshot')
    ).toThrow(/broken\.snapshot.*offset \d+/s);
  });

  it('fails loudly when prose mimics an entry boundary instead of fabricating keys', () => {
    // A multi-line description whose first line ends `"a",` satisfies the value-close rule
    // early; the leftover prose then reads as a plausible sibling key. The round-trip
    // verification must reject the parse instead of returning the fabricated object.
    const text = [
      '{',
      '  "arg": {',
      '    "description": "Options: "a",',
      '"default": "a"",',
      '    "name": "arg",',
      '  },',
      '}',
    ].join('\n');
    expect(() => parseArgTypesSnapshot(text, 'broken.snapshot')).toThrow(
      /broken\.snapshot.*round-trip/s
    );
  });

  it('resolves hand-edited trailing whitespace to the canonical reading', () => {
    // A stray space between `",` and the newline (hand-edit only; pretty-format never emits
    // trailing whitespace) is not a value terminator, so the next entry is absorbed into the
    // string. That absorbed object's canonical serialization IS this input, so the round-trip
    // check accepts it - the grammar is genuinely ambiguous here. The recorders' parsed-vs-live
    // toEqual rejects the hand-edit loudly on every normal and CI run.
    const text = '{\n  "foo": {\n    "description": "abc", \n    "name": "foo",\n  },\n}';
    expect(parseArgTypesSnapshot(text)).toEqual({
      foo: { description: 'abc", \n    "name": "foo' },
    });
  });

  it('fails loudly on a duplicate key instead of silently overwriting', () => {
    expect(() => parseArgTypesSnapshot('{\n  "a": {},\n  "a": {},\n}', 'broken.snapshot')).toThrow(
      /broken\.snapshot.*duplicate/s
    );
  });
});
