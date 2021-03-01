import { extractId } from './extract-id';

describe('extract-id', () => {
  test('name with spaces', () => {
    expect(extractId({ name: 'Name with spaces' })).toBe('NameWithSpaces');
  });
});
