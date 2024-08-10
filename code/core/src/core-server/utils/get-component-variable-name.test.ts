import { describe, expect, it } from 'vitest';

import { getComponentVariableName } from './get-component-variable-name';

describe('get-variable-name', () => {
  it('should return a valid variable name for a given string', async () => {
    await expect(getComponentVariableName('foo-bar')).resolves.toBe('FooBar');
    await expect(getComponentVariableName('foo bar')).resolves.toBe('FooBar');
    await expect(getComponentVariableName('0-foo-bar')).resolves.toBe('FooBar');
    await expect(getComponentVariableName('*Foo-bar-$')).resolves.toBe('FooBar$');
  });
});
