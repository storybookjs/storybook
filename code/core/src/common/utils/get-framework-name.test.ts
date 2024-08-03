import { describe, expect, it } from 'vitest';
import { extractProperFrameworkName } from './get-framework-name';

describe('get-framework-name', () => {
  describe('extractProperFrameworkName', () => {
    it('should extract the proper framework name from the given framework field', () => {
      expect(extractProperFrameworkName('@storybook/angular')).toBe('@storybook/angular');
      expect(extractProperFrameworkName('/path/to/@storybook/angular')).toBe('@storybook/angular');
      expect(extractProperFrameworkName('\\path\\to\\@storybook\\angular')).toBe(
        '@storybook/angular'
      );
    });

    it('should return the given framework name if it is a third-party framework', () => {
      expect(extractProperFrameworkName('@third-party/framework')).toBe('@third-party/framework');
    });
  });
});
