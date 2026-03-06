import { expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { extractJSDocInfo } from './jsdocTags';

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

it('should extract plain description without tags', () => {
  const code = 'A simple description without any tags';
  const tags = extractJSDocInfo(code);
  expect(tags).toMatchInlineSnapshot(`
    {
      "description": "A simple description without any tags",
      "tags": {},
    }
  `);
});

it('should extract @import tag', () => {
  const code = dedent`A component
@import import { Foo } from '@my-lib/components';`;
  const tags = extractJSDocInfo(code);
  expect(tags.tags).toHaveProperty('import');
  expect(tags.tags.import[0]).toContain('Foo');
});

it('should handle multiple tags of same type', () => {
  const code = dedent`
@param {string} name - The name
@param {number} age - The age`;
  const tags = extractJSDocInfo(code);
  expect(tags.tags.param).toHaveLength(2);
});

it('should return empty tags for empty string', () => {
  const tags = extractJSDocInfo('');
  expect(tags).toEqual({ description: '', tags: {} });
});
