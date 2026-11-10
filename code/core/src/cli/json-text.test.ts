import { describe, expect, it } from 'vitest';

import { appendJsonArrayItem, editJsonText, parseJsonText } from './json-text.ts';

describe('editJsonText', () => {
  const removeCompodoc = (text: string) =>
    editJsonText(text, ['targets', 'storybook', 'options', 'compodoc'], undefined);

  it('keeps tab indentation', () => {
    const tabbed =
      '{\n\t"targets": {\n\t\t"storybook": {\n\t\t\t"options": {\n\t\t\t\t"compodoc": true,\n\t\t\t\t"port": 6006\n\t\t\t}\n\t\t}\n\t}\n}\n';

    expect(removeCompodoc(tabbed)).toBe(
      '{\n\t"targets": {\n\t\t"storybook": {\n\t\t\t"options": {\n\t\t\t\t"port": 6006\n\t\t\t}\n\t\t}\n\t}\n}\n'
    );
  });

  it('keeps 4-space indentation', () => {
    const fourSpace =
      '{\n    "targets": {\n        "storybook": {\n            "options": {\n                "compodoc": true,\n                "port": 6006\n            }\n        }\n    }\n}\n';

    expect(removeCompodoc(fourSpace)).toBe(
      '{\n    "targets": {\n        "storybook": {\n            "options": {\n                "port": 6006\n            }\n        }\n    }\n}\n'
    );
  });

  it('keeps 2-space indentation', () => {
    const twoSpace =
      '{\n  "targets": {\n    "storybook": {\n      "options": {\n        "compodoc": true,\n        "port": 6006\n      }\n    }\n  }\n}\n';

    expect(removeCompodoc(twoSpace)).toBe(
      '{\n  "targets": {\n    "storybook": {\n      "options": {\n        "port": 6006\n      }\n    }\n  }\n}\n'
    );
  });
});

describe('editJsonText indentation', () => {
  it('reads it from a property on its own line, not from a header comment', () => {
    expect(editJsonText('/**\n * Config\n */\n{\n    "a": 1\n}\n', ['b'], [1])).toBe(
      '/**\n * Config\n */\n{\n    "a": 1,\n    "b": [\n        1\n    ]\n}\n'
    );
  });

  it('skips a first property on the opening line', () => {
    expect(editJsonText('{ "a": 1,\n    "b": {\n        "c": 1\n    }\n}\n', ['b', 'd'], 2)).toBe(
      '{ "a": 1,\n    "b": {\n        "c": 1,\n        "d": 2\n    }\n}\n'
    );
  });
});

describe('parseJsonText', () => {
  it('allows comments and trailing commas', () => {
    expect(parseJsonText('{\n  // comment\n  "a": [1,],\n}')).toEqual({ a: [1] });
  });

  it('ignores a byte order mark', () => {
    expect(parseJsonText('\uFEFF{ "a": 1 }')).toEqual({ a: 1 });
  });

  it('throws on invalid JSON', () => {
    expect(() => parseJsonText('{ "a": }')).toThrow(SyntaxError);
  });
});

describe('appendJsonArrayItem', () => {
  const append = (text: string) => appendJsonArrayItem(text, ['list'], 'new');

  it('keeps a line comment on the last item', () => {
    expect(append('{\n  "list": [\n    "a", // first\n    "b" // last\n  ]\n}\n')).toBe(
      '{\n  "list": [\n    "a", // first\n    "b", // last\n    "new"\n  ]\n}\n'
    );
  });

  it.each([
    ['a block comment', '"a" /* c */', '"a", /* c */'],
    ['two items on the line', '"a", "b" // c', '"a", "b", // c'],
    ['several comments', '/* x */ "a" /* y */ // z', '/* x */ "a", /* y */ // z'],
  ])('keeps %s on the last item', (_, line, expected) => {
    expect(append(`{\n  "list": [\n    ${line}\n  ]\n}\n`)).toBe(
      `{\n  "list": [\n    ${expected}\n    "new"\n  ]\n}\n`
    );
  });

  it('keeps a trailing comma after a commented last item', () => {
    expect(append('{\n  "list": [\n    "b", // last\n  ]\n}\n')).toBe(
      '{\n  "list": [\n    "b", // last\n    "new",\n  ]\n}\n'
    );
  });

  it('keeps CRLF line endings', () => {
    expect(append('{\r\n\t"list": [\r\n\t\t"b" // last\r\n\t]\r\n}\r\n')).toBe(
      '{\r\n\t"list": [\r\n\t\t"b", // last\r\n\t\t"new"\r\n\t]\r\n}\r\n'
    );
  });

  it('formats an inline array', () => {
    expect(append('{\n  "list": ["a"] // after\n}\n')).toBe(
      '{\n  "list": [\n    "a",\n    "new"\n  ] // after\n}\n'
    );
  });

  it('does not treat an object as an array', () => {
    expect(() =>
      appendJsonArrayItem('{\n  "list": {\n    "a": 1 // c\n  }\n}\n', ['list'], 'x')
    ).toThrow();
  });

  it('appends to an empty array', () => {
    expect(append('{\n  "list": []\n}\n')).toBe('{\n  "list": [\n    "new"\n  ]\n}\n');
  });
});
