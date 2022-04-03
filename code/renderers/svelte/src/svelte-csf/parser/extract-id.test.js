import { extractId } from './extract-id';

describe('extract-id', () => {
  test('name with spaces', () => {
    expect(extractId({ name: 'Name with spaces' })).toBe('NameWithSpaces');
  });
  test('duplicates id', () => {
    expect(extractId({ name: 'Button' }, ['Button'])).toBe('Button77471352');
  });
  test('No negative hash', () => {
    expect(extractId({ name: 'Navbar' }, ['Navbar'])).toBe('Navbar7557f7d0');
  });
});
