import { expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { extractJSDocTags } from './jsdocTags';

it('should extract @summary tag', () => {
  const code = dedent`@summary This is the summary`;
  const tags = extractJSDocTags(code);
  expect(tags).toMatchInlineSnapshot(`
    {
      "summary": [
        "This is the summary",
      ],
    }
  `);
});

it('should extract @param tag with type', () => {
  const code = dedent`
 @param {Object} employee - The employee who is responsible for the project.
 @param {string} employee.name - The name of the employee.
 @param {string} employee.department - The employee's department.`;
  const tags = extractJSDocTags(code);
  expect(tags).toMatchInlineSnapshot(`
    {
      "param": [
        "{Object} employee - The employee who is responsible for the project.",
        "{string} employee.name - The name of the employee.",
        "{string} employee.department - The employee's department.",
      ],
    }
  `);
});
