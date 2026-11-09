import { describe, expect, it } from 'vitest';

import { extractArgTypes } from '../extractArgTypes.ts';
import { normalizeReactDocgenTypescriptProps } from './reactDocgenTypescript.ts';

// react-docgen-typescript token contract: string-literal enum members arrive as
// `'"' + decodedValue + '"'` (plain quote-wrap, no JSON escaping) — a member whose value
// contains a backslash keeps that backslash as data, not as an escape.
const rdtProps = {
  path: {
    name: 'path',
    description: '',
    required: false,
    defaultValue: null,
    type: {
      name: 'enum',
      raw: '"C:\\users\\bob" | "\\d+"',
      value: [{ value: '"C:\\users\\bob"' }, { value: '"\\d+"' }],
    },
  },
};

describe('normalizeReactDocgenTypescriptProps', () => {
  it('re-serializes quoted enum members to the JSON contract without mutating the input', () => {
    const normalized = normalizeReactDocgenTypescriptProps(rdtProps);
    expect(normalized.path?.type?.value).toEqual([
      { value: '"C:\\\\users\\\\bob"' },
      { value: '"\\\\d+"' },
    ]);
    // RDT's parser caches ComponentDocs — the raw tokens must stay untouched.
    expect(rdtProps.path.type.value).toEqual([{ value: '"C:\\users\\bob"' }, { value: '"\\d+"' }]);
  });

  // Regression: decoding the raw wrap a second time corrupted backslash values (`\d+` lost
  // its backslash, `C:\users\bob` threw RangeError on `\u`) and Controls passed values the
  // component never declared.
  it('keeps backslashes in react-docgen-typescript enum members through argTypes conversion', () => {
    const normalized = normalizeReactDocgenTypescriptProps(rdtProps);
    const argTypes = extractArgTypes({ __docgenInfo: { props: normalized } });
    expect(argTypes?.path?.type).toMatchObject({
      name: 'enum',
      value: ['C:\\users\\bob', '\\d+'],
    });
  });
});
