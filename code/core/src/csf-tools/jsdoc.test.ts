import { expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { extractComponentDescription, extractJSDocInfo } from './jsdoc.ts';

it('should extract @summary tag', () => {
  const code = dedent`description\n@summary\n my summary`;
  const tags = extractJSDocInfo(code);
  expect(tags).toMatchInlineSnapshot(`
    {
      "description": "description",
      "tags": {
        "summary": [
          "my summary",
        ],
      },
    }
  `);
});

it('should extract @param tag with type', () => {
  const code = dedent`
 @param {Object} employee - The employee who is responsible for the project.
 @param {string} employee.name - The name of the employee.
 @param {string} employee.department - The employee's department.`;
  const tags = extractJSDocInfo(code);
  expect(tags).toMatchInlineSnapshot(`
    {
      "description": "",
      "tags": {
        "param": [
          "{Object} employee - The employee who is responsible for the project.",
          "{string} employee.name - The name of the employee.",
          "{string} employee.department - The employee's department.",
        ],
      },
    }
  `);
});

it('preserves blank lines and newlines in the description so Markdown survives', () => {
  const code = dedent`
    ## Example button component

    Comes in three sizes: \`small\`, \`medium\`, and \`large\`.

    Can be primary or secondary.

    _This description is written as a comment above the component_
    @summary short summary`;
  const { description, tags } = extractJSDocInfo(code);

  expect(description).toBe(
    [
      '## Example button component',
      '',
      'Comes in three sizes: `small`, `medium`, and `large`.',
      '',
      'Can be primary or secondary.',
      '',
      '_This description is written as a comment above the component_',
    ].join('\n')
  );
  expect(tags).toEqual({ summary: ['short summary'] });
});

it.each([
  {
    name: 'inline {@link}',
    input: 'Use {@link ToggleGroup} for accessibility.',
    expected: { description: 'Use {@link ToggleGroup} for accessibility.', tags: {} },
  },
  {
    name: 'inline {@linkcode}',
    input: 'Use {@linkcode NewButton} for the replacement implementation.',
    expected: {
      description: 'Use {@linkcode NewButton} for the replacement implementation.',
      tags: {},
    },
  },
  {
    name: 'inline {@linkplain}',
    input: 'Use {@linkplain PlainButton} for plain-text references.',
    expected: { description: 'Use {@linkplain PlainButton} for plain-text references.', tags: {} },
  },
  {
    name: 'mid-line bare @see',
    input: 'Also mid-line @see ToggleGroup for accessibility.',
    expected: { description: 'Also mid-line @see ToggleGroup for accessibility.', tags: {} },
  },
])('keeps $name text in the description', ({ input, expected }) => {
  expect(extractJSDocInfo(input)).toEqual(expected);
});

it('extracts line-leading block tags while preserving inline and mid-line tag text', () => {
  const code = dedent`
    Use {@link ToggleGroup} for accessibility.
    Also mid-line @see ToggleGroup for accessibility.
    @since 8.0`;

  expect(extractJSDocInfo(code)).toMatchInlineSnapshot(`
    {
      "description": "Use {@link ToggleGroup} for accessibility.
    Also mid-line @see ToggleGroup for accessibility.",
      "tags": {
        "since": [
          "8.0",
        ],
      },
    }
  `);
});

it('preserves inline tags inside block tag values', () => {
  const code = dedent`
    Deprecated component.
    @deprecated Use {@link NewButton} instead.`;

  expect(extractJSDocInfo(code)).toMatchInlineSnapshot(`
    {
      "description": "Deprecated component.",
      "tags": {
        "deprecated": [
          "Use {@link NewButton} instead.",
        ],
      },
    }
  `);
});

it('keeps fenced code block lines that start with @ in the description', () => {
  const code = dedent`
    Angular input example:

    \`\`\`ts
    @Input() value = true;
    \`\`\``;

  expect(extractJSDocInfo(code)).toMatchInlineSnapshot(`
    {
      "description": "Angular input example:

    \`\`\`ts
    @Input() value = true;
    \`\`\`",
      "tags": {},
    }
  `);
});

it('resolves component descriptions through the shared JSDoc extractor', () => {
  const code = dedent`
    Use {@link ToggleGroup} with Button.
    Also mid-line @see ToggleGroup for accessibility.
    @summary Button summary
    @since 8.0`;

  expect(extractComponentDescription(code, undefined)).toMatchInlineSnapshot(`
    {
      "description": "Use {@link ToggleGroup} with Button.
    Also mid-line @see ToggleGroup for accessibility.",
      "jsDocTags": {
        "since": [
          "8.0",
        ],
        "summary": [
          "Button summary",
        ],
      },
      "summary": "Button summary",
    }
  `);
});
