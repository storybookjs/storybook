import { describe, expect, it } from 'vitest';

import { extractFrameworkPackageName } from './get-framework-name';

describe('get-framework-name', () => {
  describe('extractProperFrameworkName', () => {
    it('should extract the proper framework name from the given framework field', () => {
      expect(extractFrameworkPackageName('@storybook/angular')).toBe('@storybook/angular');
      expect(extractFrameworkPackageName('/path/to/@storybook/angular')).toBe('@storybook/angular');
      expect(extractFrameworkPackageName('\\path\\to\\@storybook\\angular')).toBe(
        '@storybook/angular'
      );
    });

    it('should return the given framework name if it is a third-party framework', () => {
      expect(extractFrameworkPackageName('@third-party/framework')).toBe('@third-party/framework');
    });
  });
});
