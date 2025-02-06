import { expect, test } from 'vitest';

import { toStartCaseStr } from './toStartCaseStr';

test.each([
  ['snake_case', 'Snake Case'],
  ['AAAaaaAAAaaa', 'AA Aaaa AA Aaaa'],
  ['kebab-case', 'Kebab Case'],
  ['camelCase', 'Camel Case'],
  ['camelCase1', 'Camel Case 1'],
  ['camelCase1a', 'Camel Case 1 A'],
  ['camelCase1A', 'Camel Case 1 A'],
  ['camelCase1A2', 'Camel Case 1 A 2'],
  ['camelCase1A2b', 'Camel Case 1 A 2 B'],
  ['camelCase1A2B', 'Camel Case 1 A 2 B'],
  ['camelCase1A2B3', 'Camel Case 1 A 2 B 3'],
  ['__FOOBAR__', 'FOOBAR'],
  ['__FOO_BAR__', 'FOO BAR'],
  ['__FOO__BAR__', 'FOO BAR'],
  [' FOO BAR', 'FOO BAR'],
  ['1. Fooo', '1 Fooo'],
  ['ZIndex', 'Z Index'],
])('%s', (str, expected) => {
  const outcome = toStartCaseStr(str);
  expect(outcome).toEqual(expected);
});
