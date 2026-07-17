import { expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { extractJSDocInfo } from './jsdocTags.ts';

it('should extract @summary tag', () => {
  const code = dedent`description\n@summary\n my summary`;
  const tags = extractJSDocInfo(code);
  expect(tags).toMatchInlineSnapshot(`
    {
      "description": "description",
      "tags": {
        "summary": [
          " my summary",
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

it('preserves line breaks in @example values with language-tagged code fences', () => {
  const code = dedent`
    Renders a button.

    @example
    \`\`\`tsx
    <Button label="Click" />
    \`\`\``;
  const { tags } = extractJSDocInfo(code);

  expect(tags.example).toEqual(['```tsx\n<Button label="Click" />\n```']);
});

it('preserves line breaks in @example values with untagged code fences', () => {
  const code = dedent`
    Renders a button.

    @example
    \`\`\`
    <Button label="Click" />
    \`\`\``;
  const { tags } = extractJSDocInfo(code);

  expect(tags.example).toEqual(['```\n<Button label="Click" />\n```']);
});

it('still collapses multi-line tag values without code fences onto a single line', () => {
  const code = dedent`
    Renders a button.

    @deprecated Use the new Button
    component instead.`;
  const { tags } = extractJSDocInfo(code);

  expect(tags.deprecated).toEqual(['Use the new Button component instead.']);
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
