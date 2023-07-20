import { describe, expect, test } from 'vitest';

import { extractId } from './extract-id.js';

describe('extract-id', () => {
  test('name with spaces', () => {
    expect(extractId({ name: 'Name with spaces' })).toBe('NameWithSpaces');
  });
  test('name with parenthesis', () => {
    expect(extractId({ name: 'Name with (parenthesis)' })).toBe('NameWithParenthesis');
  });
  test('duplicates id', () => {
    expect(extractId({ name: 'Button' }, ['Button'])).toBe('Button77471352');
  });
  test('No negative hash', () => {
    expect(extractId({ name: 'Navbar' }, ['Navbar'])).toBe('Navbar7557f7d0');
  });
});
