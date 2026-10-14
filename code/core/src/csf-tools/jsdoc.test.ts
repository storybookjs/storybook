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

it('uses docblock tags when docgen JSDoc tags are empty', () => {
  const metaJsDoc = dedent`
    Meta description.

    @summary Meta summary.
    @describe Meta describe.
  `;

  expect(extractComponentDescription(metaJsDoc, 'Component description.', {})).toEqual({
    description: 'Meta describe.',
    summary: 'Meta summary.',
    jsDocTags: {
      describe: ['Meta describe.'],
      summary: ['Meta summary.'],
    },
  });
});

it('lets non-empty docgen JSDoc tags win over matching docblock tags', () => {
  const metaJsDoc = dedent`
    Meta description.

    @summary Meta summary.
    @describe Meta describe.
    @deprecated Use NewButton.
  `;

  expect(
    extractComponentDescription(metaJsDoc, 'Component description.', {
      describe: ['Component describe.'],
      summary: ['Component summary.'],
    })
  ).toEqual({
    description: 'Component describe.',
    summary: 'Component summary.',
    jsDocTags: {
      deprecated: ['Use NewButton.'],
      describe: ['Component describe.'],
      summary: ['Component summary.'],
    },
  });
});

it('trims a single-word tag value, whose name and empty description would otherwise join with a space', () => {
  expect(
    extractJSDocInfo('A button.\n\n@summary Clickable\n@deprecated Use NewButton.').tags
  ).toEqual({
    summary: ['Clickable'],
    deprecated: ['Use NewButton.'],
  });
});
