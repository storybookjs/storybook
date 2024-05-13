import { describe, expect, test } from 'vitest';

import { extractStoryId } from './extract-id.js';

describe('extract-id', () => {
  test('name with spaces', () => {
    expect(extractStoryId({ name: 'Name with spaces' })).toBe('NameWithSpaces');
  });
  test('name with parenthesis', () => {
    expect(extractStoryId({ name: 'Name with (parenthesis)' })).toBe('NameWithParenthesis');
  });
  test('duplicates id', () => {
    expect(extractStoryId({ name: 'Button' }, ['Button'])).toBe('Button77471352');
  });
  test('No negative hash', () => {
    expect(extractStoryId({ name: 'Navbar' }, ['Navbar'])).toBe('Navbar7557f7d0');
  });
});
