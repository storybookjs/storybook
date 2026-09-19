import { describe, expect, it } from 'vitest';

import { extractFrameworkPackageName } from './get-framework-name.ts';

describe('get-framework-name', () => {
  describe('extractProperFrameworkName', () => {
    it('should extract the proper framework name from the given framework field', () => {
      expect(extractFrameworkPackageName('@storybook/angular')).toBe('@storybook/angular');
      expect(extractFrameworkPackageName('/path/to/@storybook/angular')).toBe('@storybook/angular');
      expect(extractFrameworkPackageName('\\path\\to\\@storybook\\angular')).toBe(
        '@storybook/angular'
      );
    });

    it('should extract the proper framework name from pnpm virtual-store paths', () => {
      // pnpm resolves getAbsolutePath('@storybook/react-vite') to a path inside .pnpm
      expect(
        extractFrameworkPackageName(
          '/repo/node_modules/.pnpm/@storybook+react-vite@9.0.0/node_modules/@storybook/react-vite'
        )
      ).toBe('@storybook/react-vite');
      // ...or to the virtual-store dir itself, which does not end with the package name
      expect(
        extractFrameworkPackageName('/repo/node_modules/.pnpm/@storybook+react-vite@9.0.0')
      ).toBe('@storybook/react-vite');
    });

    it('should return the given framework name if it is a third-party framework', () => {
      expect(extractFrameworkPackageName('@third-party/framework')).toBe('@third-party/framework');
    });
  });
});
