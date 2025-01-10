import { expect, it } from 'vitest';

import { sanitizeName } from './utils';

it('should sanitize names', () => {
  expect(sanitizeName('basic')).toMatchInlineSnapshot(`"Basic"`);
  expect(sanitizeName('with space')).toMatchInlineSnapshot(`"WithSpace"`);
  expect(sanitizeName('default')).toMatchInlineSnapshot(`"Default"`);
  expect(sanitizeName('w/punctuation')).toMatchInlineSnapshot(`"WPunctuation"`);
  expect(sanitizeName('5')).toMatchInlineSnapshot(`"_5"`);
});
